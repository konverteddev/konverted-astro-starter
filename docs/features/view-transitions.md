# View transitions

Route changes use **Astro's built-in `<ClientRouter />`** (mounted in `src/layouts/Web.astro`) with Web Animations layered on top. The router swaps the document client-side and re-upgrades every custom element; the in-repo layer only decides what animates during that swap.

## Files

| File                                        | Role                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/transitions/page-transitions.ts`   | Wires the presets into the navigation lifecycle: tagged elements fade out before the swap (by overriding the preparation `loader`, so the fade overlaps the fetch), are hidden pre-paint after `astro:after-swap`, then fade in on `astro:page-load`.                                         |
| `src/lib/transitions/presets.ts`            | The catalog of named animations (`fade`, `blink`), each with optional `prepare` / `out` / `in`. A phase returns the `Animation` it started and the wiring awaits its `finished`. Add an entry here to make a new animation available to any element.                                                                                                               |
| `src/lib/transitions/in-place.ts`           | Decides whether a navigation swaps the document at all. A navigation that lands on the pathname it started from, or inside a declared family of URLs, keeps the DOM it has: only the scope element is replaced, and the page fade and every intro are suppressed. Used by the filter bar and by the blog's author panel (see [Dialogs and overlay routes](./dialogs-and-overlay-routes.md)). |
| `src/lib/transitions/scroll-restoration.ts` | Keeps the saved position fresh: the router writes `history.state` only once scrolling fully rests, which Lenis's easing tail delays well past the visible settle, so a quick reload restored a stale offset. Stamps the position during the scroll (throttled) plus a trailing stamp at rest. |

## Usage

Tag any element in a page or layout:

```html
<section data-page-out="fade" data-page-in="fade">...</section>
```

- `data-page-out="<preset>"` plays the preset's `out` tween before the old page is swapped away.
- `data-page-in="<preset>"` hides the element pre-paint (`prepare`) and plays `in` once the new page is live.
- `data-page-delay-in` / `data-page-delay-out` (seconds) add a per-element stagger **step**: elements are walked in DOM order and the steps accumulate, so each item starts after the ones above it.

Everything untagged cuts instantly: `<html>` opts out of the browser's view-transition animation with `transition:animate="none"`, so the fixed frame and chrome never cross-fade.

The tags sit on the shell's parts (`SiteShell.astro`'s `<main>` and the footer root) rather than on `<body>`. Opacity cannot skip a descendant, so a single tag on `<body>` is the same thing as "everything fades", and the two pieces that hold still have to be left out of it.

## The header and the announcement do not fade

They are the two pieces a navigation holds still. Both are identical on every page, so fading them out and back in made every route change restate the chrome, when the chrome is exactly what did not change. Neither is tagged, so both cut, and the swap replaces each with markup that renders the same, which is no visible cut at all. The announcement's marquee keeps running across the navigation for the same reason: nothing ever touches it.

## No tween runtime

Everything in this folder animates through the Web Animations API. The presets and the list FLIP move `opacity` and `translate` and nothing else, which the compositor can carry on its own: a page fade keeps running through the swap's parse, where a tween writing styles from a rAF callback stalls with the main thread. It also keeps an animation library out of a page whose only motion is a fade.

Nothing needs cleaning up either. A `cancel()` drops an animation and its fill together, so an interrupted move leaves no inline styles behind, and a fill that ends without `forwards` hands the element back its own style on its own.

The curves are shared through `src/lib/curves.ts`, which holds the control points and the `cubic-bezier()` strings built from them.

## Notes

- **Reduced motion:** every preset collapses its durations to 0 via `prefersReducedMotion()`, and stagger steps are dropped, so users who prefer reduced motion get an instant swap.
- An unknown preset name warns once in dev (`[page-transitions] unknown transition preset`), so typos surface early.
- **In-place navigations:** mark the one subtree that may be replaced with `data-page-in-place-scope`, and (when the URL changes) list the URL roots the page answers in `data-page-in-place-family`, space separated. Both ends of the navigation must fall inside the family, so a link out of it is still a page change. When a page answers a navigation itself and never sets `newDocument`, the swap is skipped rather than replacing the scope with itself, which would re-upgrade every custom element inside it.
- **Scroll restoration:** `<ClientRouter />` sets `history.scrollRestoration` to `manual`, so a reload restores only what was saved into `history.state`; `scroll-restoration.ts` is what keeps that fresh under Lenis. The router, Lenis, and this module travel as a set.
