// The gating every intro animation shares, so each `AnimatedText` on a page starts on exactly the
// same terms and the entrances read as one movement.

import { whenContentReady } from "./transitions/content-ready";
import { isInPlaceNavigation } from "./transitions/in-place";
import { prefersReducedMotion } from "./utils";

/** Play once the host is 10% short of the viewport bottom. */
const DEFAULT_VIEWPORT_MARGIN = "0px 0px -10% 0px";

/** Separate from `skipIntro`, because a reveal driven by hover outlives any one navigation. */
export function skipSplit(): boolean {
  return document.documentElement.hasAttribute("data-draft-mode") || prefersReducedMotion();
}

/** An in-place navigation, the visual editor and reduced motion all land on the finished state instead of animating to it. */
export function skipIntro(): boolean {
  return isInPlaceNavigation() || skipSplit();
}

/** Resolves the first time `element` is in view, and hands the observer back for teardown. */
function observeOnce(element: Element, rootMargin: string) {
  let resolve = () => {};

  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        resolve();
      }
    },
    { rootMargin }
  );

  observer.observe(element);

  return { promise, observer };
}

/** Fonts settle the line breaks a split measures, the content gate holds until the page fade ends, the observer until the host is on screen. */
export function whenIntroReady(host: HTMLElement): { ready: Promise<void>; observer: IntersectionObserver | null } {
  const viewport = viewportGate(host);

  return {
    ready: Promise.all([document.fonts.ready, whenContentReady(), viewport.promise]).then(() => undefined),
    observer: viewport.observer,
  };
}

function viewportGate(host: HTMLElement): { promise: Promise<void>; observer: IntersectionObserver | null } {
  if (host.hasAttribute("data-viewport-disabled")) {
    return { promise: Promise.resolve(), observer: null };
  }

  return observeOnce(host, host.getAttribute("data-viewport-margin") ?? DEFAULT_VIEWPORT_MARGIN);
}
