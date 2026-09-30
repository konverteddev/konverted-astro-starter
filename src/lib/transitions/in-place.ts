import { navigate, type TransitionBeforePreparationEvent, type TransitionBeforeSwapEvent } from "astro:transitions/client";

// A navigation that changes the URL but not the page: the fade and every intro are suppressed, and the
// only motion is the FLIP the list plays between its two server-rendered versions (./list-flip).
export const IN_PLACE_ATTR = "data-page-in-place";

/** With the page fade gone, nothing else is on screen between the click and the new list; `data-pending-target` opts an element in. */
export const PENDING_ATTR = "data-pending";

const PENDING_TARGET_ATTR = "data-pending-target";

/** Everything outside keeps its DOM: a full swap rebuilds the scroll driver, header and footer behind a list that wanted one slice of itself. */
export const SCOPE_ATTR = "data-page-in-place-scope";

/** Both ends of the navigation must fall inside the family, so a link that leaves it is still a page change. */
const FAMILY_ATTR = "data-page-in-place-family";

/** The scope's summary of what it now shows, and the region that announces it. See the page-load handler. */
const STATUS_ATTR = "data-page-in-place-status";

const ANNOUNCER_ATTR = "data-page-in-place-announcer";

let inPlace = false;

let keepsScroll = false;

// Every in-place suppression, but a full swap: the change that prompted it can live outside the scope.
const RELOAD_INFO = "in-place-reload";

let fullSwap = false;

/** Which scope the navigation is about: a page can carry several, and only the one the click came from changes. */
let scopeIndex = 0;

const scopesOf = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLElement>(`[${SCOPE_ATTR}]`));

/** The scope the running in-place navigation swaps, read off `root` (the live document or the incoming one). */
export function inPlaceScope(root: ParentNode): HTMLElement | null {
  return scopesOf(root)[scopeIndex] ?? null;
}

const isWithin = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

function isSamePage(from: URL, to: URL): boolean {
  if (to.pathname === from.pathname) {
    return true;
  }

  const roots = document.querySelector(`[${FAMILY_ATTR}]`)?.getAttribute(FAMILY_ATTR)?.split(/\s+/).filter(Boolean) ?? [];

  return roots.some((root) => isWithin(from.pathname, root)) && roots.some((root) => isWithin(to.pathname, root));
}

// The scroll is kept only when the page itself answered: a header link names a destination, which opens at its top.
function isAnsweredByPage(source: Element | undefined): boolean {
  return !source || Boolean(source.closest(`[${SCOPE_ATTR}], [${FAMILY_ATTR}]`));
}

// Owned here so ESM ordering settles the race: a dependency's body runs before its importer's listeners exist.
document.addEventListener("astro:before-preparation", (event) => {
  const preparation = event as TransitionBeforePreparationEvent;

  fullSwap = preparation.info === RELOAD_INFO;
  inPlace = fullSwap || (isSamePage(preparation.from, preparation.to) && Boolean(document.querySelector(`[${SCOPE_ATTR}]`)));
  keepsScroll = inPlace && isAnsweredByPage(preparation.sourceElement);

  // By position, which the incoming document shares: nothing else identifies a scope across the two.
  const clickedScope = preparation.sourceElement?.closest<HTMLElement>(`[${SCOPE_ATTR}]`) ?? null;
  scopeIndex = clickedScope ? Math.max(0, scopesOf(document).indexOf(clickedScope)) : 0;

  const source = preparation.sourceElement?.closest(`[${IN_PLACE_ATTR}]`);

  if (!inPlace || !source) {
    return;
  }

  // The swap discards these nodes, so the pending state ends exactly when the response lands.
  source.setAttribute(PENDING_ATTR, "");
  source.setAttribute("aria-busy", "true");

  for (const target of source.querySelectorAll(`[${PENDING_TARGET_ATTR}]`)) {
    target.setAttribute(PENDING_ATTR, "");
  }
});

document.addEventListener("astro:page-load", () => {
  // Only matches an abandoned navigation: on the usual path the marked nodes left with the old document.
  for (const pending of document.querySelectorAll(`[${PENDING_ATTR}]`)) {
    pending.removeAttribute(PENDING_ATTR);
    pending.removeAttribute("aria-busy");
  }

  // Nothing else tells assistive tech the list changed (WCAG 4.1.3), and a region inserted with its content is unreliably announced.
  if (inPlace) {
    const scope = inPlaceScope(document);
    const summary = scope?.getAttribute(STATUS_ATTR);
    // The scope's own region, or the one its section placed beside it; never another list's.
    const announcer = scope?.querySelector(`[${ANNOUNCER_ATTR}]`) ?? scope?.parentElement?.querySelector(`[${ANNOUNCER_ATTR}]`);

    if (summary && announcer) {
      announcer.textContent = summary;
    }
  }

  // A frame later: everything reconnected during the swap read the flag, while a lazily upgraded element still gets its intro.
  requestAnimationFrame(() => {
    inPlace = false;
    keepsScroll = false;
    fullSwap = false;
  });
});

document.addEventListener("astro:before-swap", (event) => {
  if (!inPlace || fullSwap) {
    return;
  }

  const swap = event as TransitionBeforeSwapEvent;
  const current = inPlaceScope(document);
  const next = inPlaceScope(swap.newDocument);

  // Missing on either side is not an error: the navigation falls back to Astro's own full swap.
  if (!current || !next) {
    return;
  }

  swap.swap = () => {
    // Replacing an element with itself would tear the subtree out and re-upgrade everything in it.
    if (current === next) {
      return;
    }

    current.replaceWith(next);

    // Nothing here replaces the head, so scripts that already ran are still unmarked and Astro would re-insert them.
    for (const script of document.querySelectorAll("script")) {
      script.setAttribute("data-astro-exec", "");
    }
  };
});

/** True for the duration of an in-place navigation, from `astro:before-preparation` to the frame after `astro:page-load`. */
export function isInPlaceNavigation(): boolean {
  return inPlace;
}

/** True while the running in-place navigation is one the page answered itself; see `isAnsweredByPage`. */
export function keepsInPlaceScroll(): boolean {
  return keepsScroll;
}

/** Re-fetch and swap in place for callers that know the server output changed; resolves once the page is live. */
export function reloadInPlace(): Promise<void> {
  return new Promise((resolve) => {
    document.addEventListener("astro:page-load", () => resolve(), { once: true });
    // No hash: the router answers a same-URL navigation carrying one with a scroll instead of a fetch.
    navigate(`${window.location.pathname}${window.location.search}`, { history: "replace", info: RELOAD_INFO });
  });
}
