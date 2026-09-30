import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

import { CSS_EASING } from "~/lib/curves";
import { prefersReducedMotion } from "~/lib/utils";
import { inPlaceScope, isInPlaceNavigation } from "./in-place";

// The motion a list makes across an in-place navigation: dropped entries fade while the response is in
// flight, survivors FLIP to where they land, newcomers arrive behind them.

const MS = 1000;

const LIST = "[data-flip-list]";

const ITEM_KEY = "data-flip-key";

const EXIT_DURATION = 0.2;

const MOVE_DURATION = 0.5;

const ENTER_DURATION = 0.35;

/** Entries arrive once the survivors are most of the way home, so the two phases read as one move. */
const ENTER_DELAY = MOVE_DURATION * 0.45;

const ENTER_STAGGER = 0.04;

/** Relative to the list, not the viewport: the swapped-in document starts at the top until the scroll is put back. */
type Offset = { x: number; y: number };

/** The list inside the scope being swapped, not the first on the page: a page can carry more than one. */
const listOf = (root: ParentNode) => inPlaceScope(root)?.querySelector(LIST) ?? null;

/** The box eases from its old height to its new one, so the page below rides the move instead of jumping. */
const playHeight = (box: HTMLElement, from: number) => {
  const to = box.getBoundingClientRect().height;

  if (Math.abs(to - from) < 1) {
    return;
  }

  // Clipped for the tween only: a newcomer below the old edge is revealed as the box grows to meet it.
  box.style.overflow = "clip";

  const animation = box.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: MOVE_DURATION * MS,
    easing: CSS_EASING,
  });

  animation.finished.then(
    () => box.style.removeProperty("overflow"),
    () => box.style.removeProperty("overflow")
  );
};

const readItems = () => {
  const list = listOf(document);

  if (!list) {
    return null;
  }

  return { origin: list.getBoundingClientRect(), items: Array.from(list.querySelectorAll<HTMLElement>(`[${ITEM_KEY}]`)) };
};

const offsetsOf = (origin: DOMRect, items: HTMLElement[]) => {
  const offsets = new Map<string, Offset>();

  for (const item of items) {
    const rect = item.getBoundingClientRect();

    offsets.set(item.getAttribute(ITEM_KEY) ?? "", { x: rect.left - origin.left, y: rect.top - origin.top });
  }

  return offsets;
};

/** Fade out the entries the incoming list drops, while its response is already parsed and waiting. */
const playExit = (items: HTMLElement[], newDocument: Document) => {
  const surviving = new Set(
    Array.from(listOf(newDocument)?.querySelectorAll(`[${ITEM_KEY}]`) ?? [], (item) => item.getAttribute(ITEM_KEY))
  );

  const leaving = items.filter((item) => !surviving.has(item.getAttribute(ITEM_KEY)));

  if (leaving.length === 0) {
    return Promise.resolve();
  }

  // Opacity alone: a scale reads as a full-width row being sucked inward. One keyframe, so each leaves from where it was.
  const leaves = leaving.map((item) =>
    item.animate([{ opacity: 0 }], { duration: EXIT_DURATION * MS, easing: CSS_EASING, fill: "forwards" }).finished.then(
      () => undefined,
      () => undefined
    )
  );

  return Promise.all(leaves).then(() => undefined);
};

// Measured before the swap and consumed by it, so a navigation that never swaps leaves nothing behind.
let previous: { offsets: Map<string, Offset>; height: number | null } | null = null;

document.addEventListener("astro:before-preparation", (event) => {
  const preparation = event as TransitionBeforePreparationEvent;

  previous = null;

  if (!isInPlaceNavigation() || prefersReducedMotion()) {
    return;
  }

  const list = readItems();

  // An empty map still counts: arriving from the no-match state, every entry in the new list enters.
  previous = {
    offsets: list ? offsetsOf(list.origin, list.items) : new Map(),
    height: inPlaceScope(document)?.getBoundingClientRect().height ?? null,
  };

  if (!list || list.items.length === 0) {
    return;
  }

  const load = preparation.loader;

  // The exit runs after the loader parses the response, so the fade costs wall-clock the fetch already spent.
  preparation.loader = async () => {
    await load();
    await playExit(list.items, preparation.newDocument);
  };
});

document.addEventListener("astro:after-swap", () => {
  const before = previous;

  previous = null;

  if (!before) {
    return;
  }

  const scope = inPlaceScope(document);

  if (scope && before.height !== null) {
    playHeight(scope, before.height);
  }

  const list = readItems();

  if (!list) {
    return;
  }

  const after = offsetsOf(list.origin, list.items);
  const entering: HTMLElement[] = [];

  for (const item of list.items) {
    const key = item.getAttribute(ITEM_KEY) ?? "";
    const from = before.offsets.get(key);
    const to = after.get(key);

    if (!from || !to) {
      entering.push(item);
      continue;
    }

    const x = from.x - to.x;
    const y = from.y - to.y;

    if (x === 0 && y === 0) {
      continue;
    }

    // `translate` rather than a written `transform`, so the entry keeps whatever its own classes give it.
    item.animate([{ translate: `${x}px ${y}px` }, { translate: "0 0" }], {
      duration: MOVE_DURATION * MS,
      easing: CSS_EASING,
    });
  }

  entering.forEach((item, index) => {
    item.animate(
      [
        { opacity: 0, translate: "0 16px" },
        { opacity: 1, translate: "0 0" },
      ],
      {
        duration: ENTER_DURATION * MS,
        delay: (ENTER_DELAY + index * ENTER_STAGGER) * MS,
        easing: CSS_EASING,
        // Backwards only: the wait is covered and the entry's own style is the finished state.
        fill: "backwards",
      }
    );
  });
});
