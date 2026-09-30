import { CSS_EASING } from "~/lib/curves";
import { prefersReducedMotion } from "~/lib/utils";

// The catalog of named page-transition animations; ./page-transitions runs and awaits them.
// `prepare` sets an entering element's start state pre-paint so it never flashes at its final state.

const MS = 1000;

// Collapsed to 0 under reduced motion, so every preset honours it without repeating the check.
const motionDuration = (seconds: number) => (prefersReducedMotion() ? 0 : seconds * MS);

/** The fill holds until the inline start state is dropped, so no frame of the pre-paint state shows. */
const releaseOnFinish = (el: Element, animation: Animation) => {
  void animation.finished.then(
    () => {
      (el as HTMLElement).style.removeProperty("opacity");
      animation.cancel();
    },
    () => undefined
  );

  return animation;
};

export type PagePreset = {
  prepare?: (el: Element) => void;
  /** `delay` is the element's step in the phase's stagger, in milliseconds. */
  out?: (el: Element, delay: number) => Animation;
  in?: (el: Element, delay: number) => Animation;
};

export const PAGE_PRESETS: Record<string, PagePreset> = {
  // Cross-fade timing: 0.3s out, 0.4s in, CSS `ease`.
  fade: {
    prepare: (el) => {
      (el as HTMLElement).style.opacity = "0";
    },
    // One keyframe, so the start is read off the element wherever it had got to.
    out: (el, delay) =>
      el.animate([{ opacity: 0 }], { duration: motionDuration(0.3), delay, easing: CSS_EASING, fill: "forwards" }),
    in: (el, delay) =>
      releaseOnFinish(
        el,
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: motionDuration(0.4),
          delay,
          easing: CSS_EASING,
          fill: "both",
        })
      ),
  },

  // Offsets rather than per-keyframe durations, so `motionDuration` collapses the whole strobe to an instant hide/show.
  blink: {
    prepare: (el) => {
      (el as HTMLElement).style.opacity = "0";
    },
    out: (el, delay) =>
      el.animate(
        [
          { opacity: 0, offset: 0.286 },
          { opacity: 0.45, offset: 0.429 },
          { opacity: 0, offset: 0.571 },
          { opacity: 0.45, offset: 0.714 },
          { opacity: 0, offset: 1 },
        ],
        { duration: motionDuration(0.35), delay, easing: "linear", fill: "forwards" }
      ),
    in: (el, delay) =>
      releaseOnFinish(
        el,
        el.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0.45, offset: 0.286 },
            { opacity: 0, offset: 0.429 },
            { opacity: 0.45, offset: 0.571 },
            { opacity: 0, offset: 0.714 },
            { opacity: 1, offset: 1 },
          ],
          { duration: motionDuration(0.35), delay, easing: "linear", fill: "both" }
        )
      ),
  },
};
