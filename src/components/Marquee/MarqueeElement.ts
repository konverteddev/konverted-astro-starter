import { prefersReducedMotion } from "~/lib/utils";

// Sub-pixel slack, so content a hair wider than its room does not become a barely-moving marquee.
const OVERFLOW_TOLERANCE = 1;

/** Measured, not configured: the server's single copy is repeated until one pass covers the line, and the track holds that pass twice. */
export class MarqueeElement extends HTMLElement {
  #viewport: HTMLElement | null = null;
  #track: HTMLElement | null = null;
  #content: HTMLElement | null = null;
  #clones: HTMLElement[] = [];
  #resizeObserver: ResizeObserver | null = null;
  #motionQuery: MediaQueryList | null = null;
  #frame = 0;

  #onResize = () => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(this.#measure);
  };

  connectedCallback() {
    this.#viewport = this.querySelector<HTMLElement>("[data-marquee-viewport]");
    this.#track = this.querySelector<HTMLElement>("[data-marquee-track]");
    this.#content = this.querySelector<HTMLElement>("[data-marquee-content]");

    if (!this.#viewport || !this.#track || !this.#content) {
      return;
    }

    // The content is observed too: a late web font rewidens the run without its room ever changing size.
    this.#resizeObserver = new ResizeObserver(this.#onResize);
    this.#resizeObserver.observe(this.#viewport);
    this.#resizeObserver.observe(this.#content);

    this.#motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.#motionQuery.addEventListener("change", this.#onResize);
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;

    this.#motionQuery?.removeEventListener("change", this.#onResize);
    this.#motionQuery = null;

    cancelAnimationFrame(this.#frame);
    this.#frame = 0;

    this.#viewport = null;
    this.#track = null;
    this.#content = null;
    this.#clones = [];
  }

  #number = (name: string, fallback: number) => {
    const value = Number(this.dataset[name]);

    return Number.isFinite(value) ? value : fallback;
  };

  #measure = () => {
    const viewport = this.#viewport;
    const track = this.#track;
    const content = this.#content;

    if (!viewport || !track || !content) {
      return;
    }

    const reserve = this.#number("reserve", 0);

    // `offsetWidth` excludes the loop's margin, so this is the natural width whether it is standing still or looping.
    const available = viewport.clientWidth - 2 * reserve;
    const overflows = content.offsetWidth - available > OVERFLOW_TOLERANCE;
    const loops = (this.hasAttribute("data-always") || overflows) && !prefersReducedMotion();

    // What a caller reads to fade the ends; the layout keys off the flags below, so a line set to loop still moves.
    this.toggleAttribute("data-overflow", overflows);

    // Exclusive with the animation: a line that overflows but must not move stays scrollable by hand instead.
    this.toggleAttribute("data-scroll", overflows && !loops);

    // The fallback needs the covered end as trailing room, or the last words stop under whatever covers them.
    track.style.paddingRight = overflows && !loops && reserve ? `${reserve}px` : "";

    if (loops) {
      this.#start(viewport, track, content);
    } else {
      this.#stop();
    }
  };

  #start = (viewport: HTMLElement, track: HTMLElement, content: HTMLElement) => {
    const gap = this.#number("gap", 0);

    content.style.marginRight = `${gap}px`;

    // One pass must cover the line or the track runs out before it wraps, leaving a gap at the trailing edge.
    const pass = content.offsetWidth + gap;
    const perPass = pass > 0 ? Math.max(1, Math.ceil(viewport.clientWidth / pass)) : 1;

    this.#setCopies(track, content, perPass * 2);

    // Set on the element, not a theme property: a theme property substitutes against the root, not the animated element.
    track.style.animationDuration = `${(perPass * pass) / this.#number("speed", 60)}s`;

    this.toggleAttribute("data-marquee", true);
  };

  #setCopies = (track: HTMLElement, content: HTMLElement, total: number) => {
    while (this.#clones.length > total - 1) {
      this.#clones.pop()?.remove();
    }

    while (this.#clones.length < total - 1) {
      const clone = content.cloneNode(true) as HTMLElement;

      clone.removeAttribute("data-marquee-content");
      clone.setAttribute("aria-hidden", "true");
      // The duplicates are decorative: they must not be read out, focused, or land in the tab order.
      clone.inert = true;

      track.appendChild(clone);
      this.#clones.push(clone);
    }
  };

  #stop = () => {
    for (const clone of this.#clones) {
      clone.remove();
    }

    this.#clones = [];

    this.#content?.style.removeProperty("margin-right");
    this.#track?.style.removeProperty("animation-duration");

    this.removeAttribute("data-marquee");
  };
}

if (!customElements.get("marquee-line")) {
  customElements.define("marquee-line", MarqueeElement);
}
