import { splitText, type TextSplit } from "kugiri";

import { skipSplit } from "~/lib/intro";
import { ScrollTrigger } from "~/lib/scroll-trigger";

/** The read opens as the statement's middle comes up the screen and is spent at the middle of it. */
const READ_START = "center 90%";

/** `clamp` is what stops a statement in the last screen asking to end past the page's own end. */
const READ_END = "clamp(center center)";

const RESIZE_SETTLE_MS = 200;

/** One string per word, recomputed from `--reading-progress`, so a frame costs one property write on the host. */
const WORD_OPACITY = `calc(
  var(--reading-unread) + (1 - var(--reading-unread)) * clamp(0, (var(--reading-progress, 0)
  - (var(--word) + var(--reading-offset, 0))
  * ((var(--reading-span) - var(--reading-fade)) / max(1, var(--reading-words) - 1)))
  / var(--reading-fade), 1))`;

export const SPLIT_MEASURE = "reading-text:split";

/** Every connected statement, so one resize restages all of them on one clock. */
const hosts = new Set<ReadingTextElement>();

let settle = 0;
let wired = false;
let splitWidth = 0;

// Dropped on the first resize, not debounced in place: a split bakes each word's width and the type is fluid.
function restage() {
  for (const host of hosts) {
    host.unsplit();
  }

  clearTimeout(settle);

  settle = window.setTimeout(() => {
    for (const host of hosts) {
      host.resplit();
    }
  }, RESIZE_SETTLE_MS);
}

// Width only: iOS resizes the window as its toolbar collapses mid-scroll, and a height change moves no line break.
function onResize() {
  if (window.innerWidth === splitWidth) {
    return;
  }

  splitWidth = window.innerWidth;
  restage();
}

function watch(host: ReadingTextElement) {
  if (!wired) {
    wired = true;
    splitWidth = window.innerWidth;
    // Not a ResizeObserver: a word-level split holds its own box open, so the width it reports never moves.
    window.addEventListener("resize", onResize, { passive: true });
    document.fonts.addEventListener("loadingdone", restage);
  }

  hosts.add(host);
}

/** The read is one number, `--reading-progress`; the inline styles the markup ships work it out from there. */
export class ReadingTextElement extends HTMLElement {
  #text: HTMLElement | null = null;
  #splits: TextSplit[] = [];
  #trigger: ScrollTrigger | null = null;
  #ramp = "";
  #progress = 0;
  #cancelled = false;

  connectedCallback() {
    this.#cancelled = false;
    this.#text = this.querySelector<HTMLElement>("[data-reading-text]");

    if (!this.#text) {
      return;
    }

    this.#ramp = this.#text.style.opacity;

    // The visual editor and reduced motion get the finished state, not the grey the markup ships.
    if (skipSplit()) {
      this.progress = 1;
      return;
    }

    if (!this.hasAttribute("data-driven")) {
      this.#drive();
    }

    // Line boxes only settle once the face the copy is read in has loaded.
    void document.fonts.ready.then(() => {
      if (this.#cancelled) {
        return;
      }

      this.#split();
      watch(this);
    });
  }

  disconnectedCallback() {
    this.#cancelled = true;
    hosts.delete(this);
    this.#trigger?.kill();
    this.#trigger = null;
    this.unsplit();
    this.style.removeProperty("--reading-progress");
    this.style.removeProperty("--reading-words");
    this.#text = null;
  }

  /** How far the read has come, 0 to 1. A driven host maps its own scroll window onto it. */
  get progress() {
    return this.#progress;
  }

  set progress(value: number) {
    this.#progress = Math.min(1, Math.max(0, value));
    this.style.setProperty("--reading-progress", String(this.#progress));
  }

  unsplit = () => {
    for (const split of this.#splits) {
      split.revert();
    }

    this.#splits = [];

    // The words carried the read; with them gone the copy takes it back as one piece.
    if (this.#text) {
      this.#text.style.opacity = this.#ramp;
    }
  };

  resplit = () => {
    if (this.#splits.length === 0 && !this.#cancelled) {
      this.#split();
    }
  };

  // Read off the trigger rather than tweened, so a parent and the element itself use the one setter.
  #drive() {
    const read = (self: ScrollTrigger) => {
      this.progress = self.progress;
    };

    this.#trigger = ScrollTrigger.create({
      trigger: this,
      start: READ_START,
      end: READ_END,
      onUpdate: read,
      onRefresh: read,
      onToggle: read,
    });
  }

  // kugiri restarts --word at zero in each block, so a block is told what ran before it.
  #split() {
    const text = this.#text;

    if (!text) {
      return;
    }

    const selector = this.getAttribute("data-split-selector");
    const matches = selector ? Array.from(text.querySelectorAll<HTMLElement>(selector)) : [];
    const targets = matches.length > 0 ? matches : [text];
    const start = performance.now();

    this.#splits = targets.map((target) => splitText(target, { type: ["words"] }));

    let before = 0;

    for (const [index, split] of this.#splits.entries()) {
      targets[index]?.style.setProperty("--reading-offset", String(before));
      before += split.words.length;

      for (const word of split.words) {
        word.style.opacity = WORD_OPACITY;
      }
    }

    this.style.setProperty("--reading-words", String(before));
    text.style.removeProperty("opacity");

    performance.measure(SPLIT_MEASURE, { start, detail: { words: before } });
  }
}

if (!customElements.get("reading-text")) {
  customElements.define("reading-text", ReadingTextElement);
}
