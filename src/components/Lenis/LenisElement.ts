import Lenis from "lenis";

/** easeInOutCubic, used for in-page anchor scrolls. */
const ANCHOR_SCROLL = {
  duration: 1.2,
  easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

// The links Lenis owns: a plain click on a hash that resolves on the page being viewed. Everything
// else (another page, a new tab, a download, a hash matching nothing) stays with <ClientRouter />
// and the browser.
const inPageTarget = (event: MouseEvent) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);

  if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) {
    return null;
  }

  const url = new URL(anchor.href);
  const samePage = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;

  if (!samePage || !url.hash) {
    return null;
  }

  const element = document.getElementById(decodeURIComponent(url.hash.slice(1)));

  return element ? { element, url } : null;
};

// The router drops the fragment scroll, so this lands on the hash once per document, and only with no saved position.
let hashApplied = false;

const applyHash = (lenis: Lenis) => {
  if (hashApplied) {
    return;
  }

  hashApplied = true;

  const id = decodeURIComponent(location.hash.slice(1));
  const element = id && !history.state?.scrollY ? document.getElementById(id) : null;

  if (element) {
    lenis.scrollTo(element, { immediate: true });
  }
};

// A trackpad keeps sending a flick for a second after the fingers lift, so wheel events in that tail are swallowed.
const WHEEL_TAIL_GAP_MS = 150;

let wheelTailUntil = 0;

document.addEventListener("astro:before-preparation", () => {
  wheelTailUntil = performance.now() + WHEEL_TAIL_GAP_MS;
});

window.addEventListener(
  "wheel",
  (event) => {
    const now = performance.now();

    if (now > wheelTailUntil) {
      return;
    }

    wheelTailUntil = now + WHEEL_TAIL_GAP_MS;
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  { capture: true, passive: false }
);

// Behaviour only: this drives Lenis over the window. Reduced motion drops it to a 1:1 lerp, so callers need no fallback.
export class LenisElement extends HTMLElement {
  #lenis: Lenis | null = null;
  #rafId = 0;

  #raf = (time: number) => {
    this.#lenis?.raf(time);
    this.#rafId = requestAnimationFrame(this.#raf);
  };

  // Cancelled in the capture phase so the router stands down: it jumps first, leaving Lenis measuring a position it never saw move.
  #onClick = (event: MouseEvent) => {
    const anchor = inPageTarget(event);

    if (!anchor) {
      return;
    }

    event.preventDefault();
    this.#lenis?.scrollTo(anchor.element, ANCHOR_SCROLL);

    // Replace, not push: an entry the router did not create sends `back` down its full swap path just to undo a scroll.
    history.replaceState(history.state, "", anchor.url.href);
  };

  connectedCallback() {
    this.#lenis = new Lenis();
    this.#rafId = requestAnimationFrame(this.#raf);
    document.addEventListener("click", this.#onClick, { capture: true });
    applyHash(this.#lenis);
  }

  // An in-place swap moved the document under it, so the old page's momentum would pull the new one off its landing.
  settleAt(y: number) {
    this.#lenis?.scrollTo(y, { immediate: true, force: true });
  }

  // Overlays (e.g. the modal) pause the page scroll through these instead of reaching into #lenis.
  stop() {
    this.#lenis?.stop();
  }

  start() {
    this.#lenis?.start();
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.#onClick, { capture: true });
    cancelAnimationFrame(this.#rafId);
    this.#lenis?.destroy();
    this.#lenis = null;
  }
}

if (!customElements.get("lenis-scroll")) {
  customElements.define("lenis-scroll", LenisElement);
}
