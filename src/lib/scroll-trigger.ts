import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Trailing, so a height that eases (a list re-sorting, a re-split) costs one refresh once it lands. */
const HEIGHT_SETTLE_MS = 100;

// ScrollTrigger's cached scroll lags the router's `scrollTo`, so the real position is written after a microtask.
document.addEventListener("astro:after-swap", () => {
  queueMicrotask(() => ScrollTrigger.getScrollFunc(window)(window.scrollY));
});

// A swap upgrades elements before the page fills in, and ScrollTrigger keeps those positions, so triggers re-measure once whole.
document.addEventListener("astro:page-load", () => {
  ScrollTrigger.refresh();
});

// Fonts settle line breaks after that, and only a document load gets ScrollTrigger's own refresh.
void document.fonts.ready.then(() => ScrollTrigger.refresh());

let heightSettle = 0;

// Only a window resize refreshes on its own; content settling after it (a re-split, a late image) moves every trigger below.
new ResizeObserver(() => {
  clearTimeout(heightSettle);

  heightSettle = window.setTimeout(() => ScrollTrigger.refresh(), HEIGHT_SETTLE_MS);
}).observe(document.documentElement);

export { ScrollTrigger };
