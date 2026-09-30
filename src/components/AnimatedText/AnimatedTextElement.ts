import { type SplitLevel, splitText, type TextSplit } from "kugiri";

import { CSS_EASING, REVEAL_EASING } from "~/lib/curves";
import { skipIntro, skipSplit, whenIntroReady } from "~/lib/intro";
import { prefersReducedMotion } from "~/lib/utils";

/** A resize settles for this long before a host is split again against its new width. */
const RESIZE_SETTLE_MS = 200;

const MS = 1000;

/** `translate` and `opacity` only, the pair the compositor carries. Both ends stated: a lone keyframe would be read as the end of the move. */
const REVEAL_FRAMES: Keyframe[] = [
  { translate: "0 100%", opacity: 0 },
  { translate: "0 0", opacity: 1 },
];

/** Per unit, when the host names none: a line takes a beat, a word or a char only a flicker of one. */
const DEFAULT_STAGGER: Record<SplitLevel, number> = { lines: 0.1, words: 0.03, chars: 0.015 };

/** The manual hand-over: short enough that the outgoing copy is gone before the next one rises. */
const EXIT_DURATION = 0.18;

/** A <details> takes a frame or two to stop skipping its content; the cap stops a host whose panel shut mid-wait from polling. */
const RENDER_WAIT_FRAMES = 10;

/** A quarter em, so a tight leading's descenders are not cut while a landed line waits out the rest of the reveal. */
const MASK_REACH = "0.25em";

/** Every split records a user-timing measure, so its cost reads off the Performance panel rather than being guessed. */
export const SPLIT_MEASURE = "animated-text:split";

function isSplitLevel(value: string | null): value is SplitLevel {
  return value === "lines" || value === "words" || value === "chars";
}

/** `checkVisibility` is missing in older WebKit; a host there is taken as rendered. */
function isRendered(element: HTMLElement): boolean {
  return typeof element.checkVisibility === "function" ? element.checkVisibility() : true;
}

export class AnimatedTextElement extends HTMLElement {
  #splits: TextSplit[] = [];
  /** Each mask's own clip, read back off it when it is made, so a replay restores it rather than restating it. */
  #clips = new WeakMap<HTMLElement, string>();
  /** One animation per unit: the stagger is each one's own delay, not a property of a shared tween. */
  #rise: Animation[] | null = null;
  /** The host's own fade, for a manual hand-over. */
  #fade: Animation | null = null;
  #observer: IntersectionObserver | null = null;
  #resize: ResizeObserver | null = null;
  #resizeTimer = 0;
  #cancelled = false;
  #masksClip = true;
  #fontsReady = false;
  #splitWidth = -1;
  #frame = 0;

  connectedCallback() {
    this.#cancelled = false;
    this.#masksClip = true;

    // A half-drawn focus ring is worse than ending the masking early, so the first focus in here does.
    this.addEventListener("focusin", this.#stopMaskingLines);

    // A manual host skips the one-shot intro gating; only fonts matter, and layout is the caller's problem.
    if (this.hasAttribute("data-manual")) {
      void document.fonts.ready.then(() => {
        this.#fontsReady = true;
      });

      return;
    }

    // Draft mode and reduced motion both skip the split and reveal the server-rendered text.
    if (skipIntro()) {
      this.#reveal();
      return;
    }

    void this.#play();
  }

  disconnectedCallback() {
    this.#cancelled = true;
    cancelAnimationFrame(this.#frame);
    this.removeEventListener("focusin", this.#stopMaskingLines);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#resize?.disconnect();
    this.#resize = null;
    clearTimeout(this.#resizeTimer);
    document.fonts.removeEventListener("loadingdone", this.#onLayoutChange);
    this.#fade?.cancel();
    this.#fade = null;
    this.#revert();
  }

  /** The units the reveal moves, at the level the host names (`data-unit`, lines by default). */
  get units(): Element[] {
    const level = this.#level();

    return this.#splits.flatMap((split) => split[level]);
  }

  get lines(): Element[] {
    return this.#splits.flatMap((split) => split.lines);
  }

  /** Manual mode: split up front, so a hand-over costs a tween instead of a tween plus a forced layout. Call once rendered. */
  prepare = () => {
    this.#whenRendered(() => {
      this.#ensureSplit();
    });
  };

  /** Manual mode: `fromTo` restates the start, so returning to a host still fading out replays the whole entrance. */
  show = () => {
    this.#fade?.cancel();
    this.#fade = null;
    this.style.opacity = "1";

    this.#whenRendered(this.#playUnits);
  };

  /** A just-opened panel measures against a size-contained box, so both entry points hold until the host is genuinely rendered. */
  #whenRendered = (run: () => void, framesLeft = RENDER_WAIT_FRAMES) => {
    cancelAnimationFrame(this.#frame);

    if (isRendered(this)) {
      run();
      return;
    }

    if (framesLeft > 0) {
      this.#frame = requestAnimationFrame(() => this.#whenRendered(run, framesLeft - 1));
    }
  };

  #playUnits = () => {
    if (!this.#ensureSplit()) {
      return;
    }

    this.#setMasksClipped(true);
    this.#animateUnits(0);
  };

  /** Manual mode: a plain fade, since reversing the rise would read as a second entrance. `show()` cancels it. */
  hide = () => {
    cancelAnimationFrame(this.#frame);
    this.#fade?.cancel();

    // One keyframe, so the start is read off the host wherever the reveal had got to.
    this.#fade = this.animate([{ opacity: 0 }], {
      duration: prefersReducedMotion() ? 0 : EXIT_DURATION * MS,
      easing: CSS_EASING,
      fill: "forwards",
    });
  };

  #reveal = () => {
    this.style.removeProperty("opacity");
  };

  /** The masks clip at the line box, so left on they cut the top off a focused link's ring; a replay puts them back. */
  #stopMaskingLines = () => {
    this.#setMasksClipped(false);
  };

  #setMasksClipped(clipped: boolean) {
    this.#masksClip = clipped;

    for (const split of this.#splits) {
      this.#applyMasking(split);
    }
  }

  #applyMasking = (split: TextSplit) => {
    for (const mask of split.masks) {
      mask.style.clipPath = this.#masksClip ? (this.#clips.get(mask) ?? "inset(0)") : "none";
    }
  };

  /** The wrappers the host asked for (`data-mask`): the animated unit's own by default, `none`, or any levels. */
  #maskLevels(level: SplitLevel): SplitLevel[] {
    const named = this.getAttribute("data-mask");

    if (named === null) {
      return [level];
    }

    return named.split(" ").filter(isSplitLevel);
  }

  #level(): SplitLevel {
    const level = this.getAttribute("data-unit");

    return isSplitLevel(level) ? level : "lines";
  }

  /** A reveal caught mid-flight carries on from the same moment on the new units; one at rest stays at rest. */
  #watchLayout() {
    if (this.#resize || typeof ResizeObserver === "undefined") {
      return;
    }

    this.#resize = new ResizeObserver(this.#onLayoutChange);
    this.#resize.observe(this);
    document.fonts.addEventListener("loadingdone", this.#onLayoutChange);
  }

  #onLayoutChange = () => {
    clearTimeout(this.#resizeTimer);

    this.#resizeTimer = window.setTimeout(() => {
      if (this.#splits.length === 0 || this.offsetWidth === this.#splitWidth) {
        return;
      }

      // Counted from its own start, waits included, so a unit sitting out its stagger reads as unfinished rather than unplayed.
      const running = this.#rise;
      const elapsed = running?.some((animation) => animation.playState !== "finished")
        ? Number(running[0]?.currentTime ?? 0)
        : null;

      this.#revert();
      this.#split();

      if (elapsed === null) {
        this.#setMasksClipped(false);
        return;
      }

      this.#setMasksClipped(true);
      this.#animateUnits(this.#number("data-delay", 0), elapsed);
    }, RESIZE_SETTLE_MS);
  };

  #number(attr: string, fallback: number) {
    const value = Number.parseFloat(this.getAttribute(attr) ?? "");
    return Number.isFinite(value) ? value : fallback;
  }

  /** One animation per unit, the stagger each one's own delay; `elapsed` is how a re-split picks up where it left off. */
  #animateUnits(delay: number, elapsed = 0) {
    const level = this.#level();
    const duration = this.#number("data-duration", 1) * MS;
    const stagger = this.#number("data-stagger", DEFAULT_STAGGER[level]) * MS;

    this.#cancelRise();

    const rise = this.units.map((unit, index) =>
      unit.animate(REVEAL_FRAMES, {
        duration,
        delay: delay * MS + index * stagger,
        easing: REVEAL_EASING,
        // Only the wait before the start needs covering; the unit's own style is the finished state.
        fill: "backwards",
      })
    );

    for (const animation of rise) {
      animation.currentTime = elapsed;
    }

    this.#rise = rise;

    // A cancel is deliberate, so a rejection is not an error; the identity check drops a run that has been replaced.
    void Promise.all(rise.map((animation) => animation.finished))
      .then(() => {
        if (this.#rise === rise) {
          this.#stopMaskingLines();
        }
      })
      .catch(() => {});
  }

  #cancelRise() {
    for (const animation of this.#rise ?? []) {
      animation.cancel();
    }

    this.#rise = null;
  }

  /** False while the copy has to stay whole: the visual editor, reduced motion, or fonts still loading. */
  #ensureSplit(): boolean {
    // A width that no longer matches is a stale split, so it is torn down and remade against the box on screen now.
    if (this.#splits.length > 0 && this.offsetWidth === this.#splitWidth) {
      return true;
    }

    if (skipSplit() || !this.#fontsReady) {
      return false;
    }

    this.#revert();
    this.#split();

    return this.units.length > 0;
  }

  #revert() {
    this.#cancelRise();

    for (const split of this.#splits) {
      split.revert();
    }

    this.#splits = [];
  }

  // Every split records the box it wrapped to, so `#ensureSplit` can spot one that went stale.
  #split() {
    const selector = this.getAttribute("data-split-selector");
    const matches = selector ? Array.from(this.querySelectorAll<HTMLElement>(selector)) : [];
    const targets = matches.length > 0 ? matches : [this];
    const level = this.#level();
    const mask = this.#maskLevels(level);
    const ignore = this.getAttribute("data-ignore") ?? undefined;
    const start = performance.now();

    const reach = Object.fromEntries(mask.map((maskLevel) => [maskLevel, MASK_REACH]));

    this.#splits = targets.map((target) => {
      const split = splitText(target, { type: [level], mask: reach, ignore });

      for (const maskElement of split.masks) {
        this.#clips.set(maskElement, maskElement.style.clipPath);
      }

      this.#applyMasking(split);

      return split;
    });

    this.#splitWidth = this.offsetWidth;
    performance.measure(SPLIT_MEASURE, { start, detail: { lines: this.lines.length } });
  }

  async #play() {
    const { ready, observer } = whenIntroReady(this);

    this.#observer = observer;

    await ready;

    if (this.#cancelled) {
      return;
    }

    this.#split();
    this.#watchLayout();

    // A CSS reveal keys off the hooks the split left and this attribute; the element stays out of it.
    if (this.getAttribute("data-reveal") === "css") {
      this.setAttribute("data-revealed", "");
      this.#reveal();
      return;
    }

    if (this.units.length > 0) {
      this.#animateUnits(this.#number("data-delay", 0));
    } else {
      this.#stopMaskingLines();
    }

    this.#reveal();
  }
}

if (!customElements.get("animated-text")) {
  customElements.define("animated-text", AnimatedTextElement);
}
