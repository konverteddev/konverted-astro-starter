import gsap from "gsap";
import "~/lib/scroll-trigger";
import { prefersReducedMotion } from "~/lib/utils";

// The inner box is oversized by `--parallax-overflow` on every edge and slides across that slack as the
// window scrolls past, driven by a scrubbed ScrollTrigger over the element's full travel.
export class InnerParallaxElement extends HTMLElement {
  #inner: HTMLElement | null = null;
  #tween: gsap.core.Tween | null = null;

  #overflow = () => {
    const value = getComputedStyle(this).getPropertyValue("--parallax-overflow");
    return Math.abs(Number.parseFloat(value)) || 0;
  };

  connectedCallback() {
    // Reduced motion keeps the media centered in its window (no scroll-linked movement).
    if (prefersReducedMotion()) {
      return;
    }

    this.#inner = this.querySelector<HTMLElement>("[data-parallax-inner]");

    if (!this.#inner) {
      return;
    }

    const axis = this.dataset.direction === "x" ? "x" : "y";

    this.#tween = gsap.fromTo(
      this.#inner,
      { [axis]: () => -this.#overflow() },
      {
        [axis]: () => this.#overflow(),
        ease: "none",
        scrollTrigger: {
          trigger: this,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      }
    );
  }

  disconnectedCallback() {
    this.#tween?.scrollTrigger?.kill();
    this.#tween?.kill();
    this.#tween = null;
    this.#inner = null;
  }
}

if (!customElements.get("inner-parallax")) {
  customElements.define("inner-parallax", InnerParallaxElement);
}
