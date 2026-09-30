import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

import type { LenisElement } from "~/components/Lenis/LenisElement";
import { prefersReducedMotion } from "~/lib/utils";
import { closeContentGate, openContentGate } from "./content-ready";
import { isInPlaceNavigation, keepsInPlaceScroll } from "./in-place";
import { PAGE_PRESETS, type PagePreset } from "./presets";

// Plays the named presets at each point of <ClientRouter />'s navigation lifecycle; ./presets is the catalog.
// Everything untagged cuts instantly, because <html> carries transition:animate="none".

const PAGE_OUT_ATTR = "data-page-out";

const PAGE_IN_ATTR = "data-page-in";

// `data-page-delay-*` is a STEP, not an offset: `playPhase` accumulates them in DOM order. Zero under reduced motion.
const PAGE_DELAY_ATTR = { in: "data-page-delay-in", out: "data-page-delay-out" } as const;

/** Steps are authored in seconds, the way a tween reads; the animation API wants milliseconds. */
const MS = 1000;

const readStep = (el: Element, phase: "in" | "out") => {
  if (prefersReducedMotion()) {
    return 0;
  }

  const seconds = Number.parseFloat(el.getAttribute(PAGE_DELAY_ATTR[phase]) ?? "");

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
};

const warnedPresets = new Set<string>();

// An empty value means no animation; an unknown name is a typo, so warn once in dev.
const resolvePreset = (name: string | null): PagePreset | undefined => {
  if (!name) {
    return undefined;
  }

  const preset = PAGE_PRESETS[name];

  if (!preset && import.meta.env.DEV && !warnedPresets.has(name)) {
    warnedPresets.add(name);
    console.warn(`[page-transitions] unknown transition preset "${name}"`);
  }

  return preset;
};

// Play every tagged element's animation for a phase and resolve once all of them have finished.
const playPhase = (attr: string, phase: "in" | "out") => {
  let accumulated = 0;

  const played = Array.from(document.querySelectorAll(`[${attr}]`)).flatMap((el) => {
    accumulated += readStep(el, phase);

    const animation = resolvePreset(el.getAttribute(attr))?.[phase]?.(el, accumulated * MS);

    if (!animation) {
      return [];
    }

    // A cancelled animation rejects, and a navigation must not hang on one the swap took away.
    return [
      animation.finished.then(
        () => undefined,
        () => undefined
      ),
    ];
  });

  return Promise.all(played);
};

// Set the pre-paint start state for every entering element, before the swapped-in page first paints.
const prepareEnter = () => {
  for (const el of Array.from(document.querySelectorAll(`[${PAGE_IN_ATTR}]`))) {
    resolvePreset(el.getAttribute(PAGE_IN_ATTR))?.prepare?.(el);
  }
};

// True only between a swap and its page-load, so the initial (non-swap) load leaves everything alone.
let entering = false;

// Where an in-place navigation left the document; 0 for one the page did not answer, which lands at the top.
let inPlaceScroll = 0;

// Overriding the loader lets the fade overlap the fetch yet still finish before the DOM is swapped.
document.addEventListener("astro:before-preparation", (event) => {
  const preparation = event as TransitionBeforePreparationEvent;
  const load = preparation.loader;

  // No phases and no content gate: an in-place navigation re-renders the page it is already on.
  if (isInPlaceNavigation()) {
    inPlaceScroll = keepsInPlaceScroll() ? window.scrollY : 0;
    return;
  }

  // Close the content gate and show the busy cursor for the whole navigation, through `data-vt-loading`.
  closeContentGate();
  document.documentElement.setAttribute("data-vt-loading", "");

  preparation.loader = async () => {
    await Promise.all([playPhase(PAGE_OUT_ATTR, "out"), load()]);
  };
});

// After the swap, before paint: hide the entering items so they don't flash at their final state.
document.addEventListener("astro:after-swap", () => {
  // Both go through the driver, because the router and the surviving `<lenis-scroll>` disagree about where the page lands.
  if (isInPlaceNavigation()) {
    window.scrollTo(0, inPlaceScroll);
    document.querySelector<LenisElement>("lenis-scroll")?.settleAt(inPlaceScroll);

    return;
  }

  prepareEnter();
  entering = true;
});

// Fade the tagged items in, then open the content gate so in-page intros start after the cross-fade.
document.addEventListener("astro:page-load", () => {
  if (isInPlaceNavigation()) {
    return;
  }

  if (!entering) {
    document.documentElement.removeAttribute("data-vt-loading");
    openContentGate();
    return;
  }

  entering = false;
  void playPhase(PAGE_IN_ATTR, "in").then(() => {
    document.documentElement.removeAttribute("data-vt-loading");
    openContentGate();
  });
});
