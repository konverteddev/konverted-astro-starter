# Verification and a11y companions

_War stories and code in this file come from Lighthouse passes on React sites. The measurement discipline, fix families, and pitfalls transfer; the React snippets and their config pointers do not. Find this repo's equivalent (a custom element, `lazyCustomElement`, `astro.config.mjs`) instead of transcribing a snippet._

## Verifying "visually identical" (do not skip)

Lighthouse says nothing about whether animations still play. In one pass, two real regressions shipped and were caught only by driving a browser: reveals degrading to un-staggered whole-block fades (split racing the reveal), and rich text popping in fully visible (the re-split orphaning bug; both in `lcp.md`). Method that worked, using `playwright-core` against installed Chrome (no browser download; it also hides in the npx cache):

- **Probe mid-flight, not end state.** Sampling computed opacities after the fact reads `1` for both "animated correctly" and "never animated" (un-animated split spans have no inline opacity, so they compute to 1). Instead, creep the scroll position and burst-sample target opacities at 45-90ms intervals: a correct stagger reads `0,0,0,0` then `1,0,0,0` then `1,1,0,0`; a broken one reads `1,1,1,1` from the first sample.
- **Bisect against the original build.** `git diff file > patch; git checkout -- file; build; probe; git apply patch; build; probe`. Comparing stagger timelines between builds (137/229/320/458ms vs 140/232/325/417ms) is definitive in a way reasoning about effects is not.
- **Know your scroller.** With Lenis or any custom scroll container, `window.scrollTo` silently does nothing and "after scroll" assertions test the un-scrolled page. Find the `.overflow-auto` container and scroll that.
- **MutationObserver on style attributes** pinpoints exactly when a reveal fires relative to element position (record `getBoundingClientRect()` in the callback).
- Headless Chrome's `--dump-dom --virtual-time-budget=N` is cheap but unreliable for animation-driven flows (CSS `animationend` may never fire under virtual time). Use real time via CDP/playwright for anything choreography-related.

## A11y companions every perf pass trips over

Perf work on reveal systems and decorative layers reliably surfaces these; fix them in the same pass.

- **Text hidden pre-reveal has no accessible name.** `visibility: hidden` removes the subtree from the accessibility tree, so links whose label is animated text have empty names (axe `link-name`). Fix: render an `sr-only` sibling with the resolved text while the visual text is hidden. It must be a _sibling_ of the split host (the split library would otherwise split it, and the wrapper's hiding would strip it too) and it must unmount once the text reveals, or screen readers hear everything twice. (The `opacity: 0.001` + `inert` approach avoids the empty-name problem differently; see `lcp.md` Family A.)
- **`aria-hidden` / decorative layers must not contain focusables.** 3D viewers and links are focusable; axe fails `aria-hidden-focus`. `inert` on the decorative wrapper fixes focus, interaction, and the audit in one attribute. `pointer-events-none` does not affect focusability.
- **Lines-only splits carry no aria pattern.** No host label, no `aria-hidden` lines: the split lines read in order as-is. `role="text"` + `aria-label` + `aria-hidden` lines is for word/char splits only, and never when the host contains focusable content (`lcp.md` Family A).
- **Visible text vs `aria-label` mismatch.** A visible-text button carrying a different `aria-label` fails `label-content-name-mismatch` (WCAG 2.5.3). If the button has visible text, delete the label and let the text be the name; the name then updates with state ("Open Menu" / "Close Menu").
- **Icon-only buttons need names.** `button-name` audit; e.g. `aria-label={"View media N of M in fullscreen"}` on media zoom buttons.
- **axe checks contrast on visible `aria-hidden` decoration** and split-text libraries may inject their own sr-only copies; see `pitfalls.md` before "fixing" either.

## Acceptance

- Re-run medians after the last change (3x simulated mobile, devtools throttling as tie-breaker).
- Drive the affected flows in a real browser; compare against the pre-change build when in doubt.
- PSI against the deployed URL is the final word; local numbers are a lower bound (HTTP/1.1, machine load).
