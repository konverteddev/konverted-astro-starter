# Animated content

In-page motion is the split-text intro: **`AnimatedText`** (`src/components/AnimatedText/`), used directly and through `SanityRichText`'s `animated` prop (`src/sanity/rich-text/SanityRichText.astro`). **`ReadingText`** (`src/components/ReadingText/`) is the other half: a statement read word by word by the scroll rather than revealed on arrival.

## `AnimatedText` (`src/components/AnimatedText/`)

`AnimatedText.astro` renders an `<animated-text>` host and `AnimatedTextElement.ts` owns all client behavior; the split itself is [kugiri](https://github.com/edoardolunardi/kugiri) (below), and the reveal is the browser's own Web Animations API: one animation per unit, on `translate` and `opacity` only, because those two are the pair a compositor can run without the main thread. Nothing animating a text intro pulls a tweening library into the page.

- **LCP-safe pre-reveal:** the host SSRs with inline `opacity: 0.001`, imperceptible but a real paint, so the text still counts as the LCP candidate. The element removes it on reveal.
- **Three gates before the intro** (`src/lib/intro.ts`): `document.fonts.ready` (line breaks only settle once the real font is in), `whenContentReady()` (holds intros until the page transition finishes), and an IntersectionObserver (`viewport` prop; `false` skips the gate, `margin` overrides the default `0px 0px -10% 0px` rootMargin). An in-place navigation skips the intro altogether, since it is not a page change the visitor made.
- **Split:** `splitText` with `type: [split]` and `mask: split` (each unit slides out from under a clipped wrapper). Lines are the painted ones, so `text-balance`, `pre-line` newlines, `<br>`, right-to-left and CJK all come out as painted. `split="words"` and `split="chars"` wrap units inside those lines; `ignore` names elements to leave whole.
- **Accessibility:** the wrappers carry no ARIA. A split keeps the text in DOM order, so screen readers read it as-is; a label on the generic `<animated-text>` host would be prohibited ARIA.
- **`as` (default `"span"`):** use `as="div"` when wrapping block-level content (e.g. full rich text) so the split spans all lines in order. A span host is `inline-block`, never `inline`: the split injects block line masks, and those would fragment an inline ancestor's box. Text decorations never propagate into an inline-block, so an underline meant for the animated text goes on the host's own `class`, not on a wrapping link.
- **`splitSelector`:** optional selector for text-only split targets inside the host (rich text passes `[data-text]`, carried by every block renderer in `src/sanity/rich-text/components/`).
- **Timing props:** `staggerDelay` (default 0.1 per line, 0.03 per word, 0.015 per char), `duration` (default 1), `animationDelay` (seconds before the intro).
- **`manual`:** replay on demand instead of once as part of the page intro. The host starts hidden and its owner drives it through the element's `prepare()` (split early, once the host is rendered), `show()` (play the reveal from the top) and `hide()` (a short fade out). Only the fonts gate a manual host; layout is the owner's problem, because a host in a closed panel has no lines to measure.
- **Draft mode / reduced motion:** with `data-draft-mode` on `<html>` (keeps stega-encoded text intact for visual editing) or `prefers-reduced-motion`, the element skips the split entirely and just reveals the server-rendered text.
- **Timing:** every split records a `animated-text:split` user-timing measure (`SPLIT_MEASURE`, with `detail.lines`), so the cost of a page's splits reads off the Performance panel or a `PerformanceObserver`.

## `ReadingText` (`src/components/ReadingText/`)

A statement read word by word as the page scrolls: the words sit at 30% and light one after another
as it comes up the screen, all lit by the time its middle reaches the middle of the viewport. The
headline section (`src/features/page-builder/sections/HeadlineSection.astro`) is what uses it.

- **Nothing but the folder.** `ReadingText.astro` and `ReadingTextElement.ts` are the whole
  component: no stylesheet. The markup ships the tuning as custom properties on the host
  (`--reading-unread` 0.3, `--reading-span` 0.85, `--reading-fade` 0.12) and the read as inline style.
- **Self-driving by default, or handed over.** With no `driven` prop the element makes its own
  standalone `ScrollTrigger` (`start: "center 90%"`, `end: "clamp(center center)"`) and feeds its own
  `progress` setter. With `driven` it makes no trigger and waits for a parent to set `progress` over a
  window of its own, which is how a scrubbed hero would drive it.
- **`clamp()` on the end is load-bearing.** A statement in the last screen of a document can never
  bring its middle to the middle of the viewport, and without it the last one before the footer would
  sit permanently half dim. The start is deliberately not clamped: one that loads above the middle
  resolves past its own end and is simply lit.
- **One string does the lighting.** Every word carries the same inline `opacity: calc(...)`, which
  works its own slice out of `--reading-progress` against the `--word` index kugiri left on it, so a
  frame of the read costs one property write on the host rather than one per word.
- **The read paints on the wrapper, not the host.** The component renders its own
  `[data-reading-text]` inside the host and dims that, so a parent that drives the read stays free to
  animate the host's own box. The wrapper carries the read as one piece until the words exist.
- **Grey is the served state.** The unread ramp is in the markup, so the copy is grey on the first
  painted frame with no flash. With JavaScript off it stays grey, a deliberate trade for a component
  that carries no stylesheet. The visual editor and reduced motion are handled instead by the element
  setting `progress` to 1 and stopping, so the copy stands whole wherever it will not be read.
- **`splitSelector` names the blocks to split** (`[data-text]` for rich text), the wrapper itself when
  unset. kugiri restarts `--word` at zero in each block, so the split writes `--reading-offset` per
  block and `--reading-words` on the host; without it a two-paragraph statement lights both at once.
- **A word-level split freezes the layout, so a resize drops it first.** kugiri bakes each word's
  painted extent as an inline `inline-size` and marks every line `text-wrap: nowrap`, because an
  inline-block breaks the shaping run and a word re-measured alone is not the width it had inside
  continuous text. The type is fluid, so a resize changes the size a statement is read at and not only
  where it wraps. The split is dropped on the first resize that changes the width and cut again 200ms
  after the last. A height-only resize is ignored: iOS Safari fires one each time its toolbar collapses
  or expands mid-scroll, and dropping the split there flattened a statement mid-read.
- **No box is watched.** A word-level split props its own container open, so a `ResizeObserver` on the
  host reports a width that stops moving the moment the split exists. One shared `window` `resize`
  listener and `document.fonts` `loadingdone` restage every connected statement instead.
- **The unread grey is below the contrast floor on purpose**, so axe and Lighthouse report
  `color-contrast` on the unread words. `--reading-unread` is the one value to move if a clean audit
  is worth more than the read.

## The splitter (`kugiri`)

`splitText(target, { type, mask, ignore, classes })` from the [kugiri](https://github.com/edoardolunardi/kugiri) package is the dependency-free splitter behind the element, installed from npm and imported as `kugiri`. It reads the painted line boxes off the text itself (`Range.getClientRects()`) in one read phase, then cuts the DOM at those positions in one write phase, so a split forces no reflow. Lines are the ones the browser painted, never predicted, so `text-wrap: balance`, authored newlines, `<br>`, right-to-left text, hyphenation, multi-column and vertical writing all come out as painted. Words and chars are wrapped inside those lines as inline-blocks under `text-wrap: nowrap`, so their boxes can never move a wrap. Only text is split: an inline piece that is not text rides along whole inside its line, a block-level one is left where it is and is never a unit, and hidden content is left alone.

Content is classified by how it lays out rather than by tag, which is what makes it safe for anything Sanity rich text sends: block containers (`p`, `li`, headings, `blockquote`, `figcaption`) are split as targets of their own, so list numbering and markers survive, and a unit under a link's underline keeps the decoration and its hover.

Every unit carries `data-line`, `data-word` or `data-char` with its index in document order, the same index as a custom property (`--line`, `--word`, `--char`) for a CSS stagger, and a mask carries `data-mask`; the target carries `data-split` and the counts (`--lines`, `--words`, `--chars`). The split only structures and marks, so the reveal can be scripted or left to a stylesheet: `AnimatedText reveal="css"` splits, sets `data-revealed` and leaves the rest to CSS (a resize hands the stylesheet fresh units, so an entrance written as a keyframe animation replays there while one written as a transition does not), and `mask` names which levels get clip wrappers independently of the animated unit (`mask="lines"` with `split="words"` has words rise from under line clips; `false` skips wrappers entirely). Masks clip a quarter em past the line box (`mask: { lines: ".25em" }`), so the descenders a tight leading leaves outside the box ride up with their line instead of being cut; the element drops the clip once the units are at rest so a focus ring is never cut, and puts back each mask's own clip for a replay. The element owns the re-split: once a resize settles (200ms) or a font lands late, a host whose width moved is split again, and a reveal caught mid-flight carries on from the same moment on the new units.

The package's own API reference and demo live in its repository; nothing about the splitter is vendored here.

## Rich text (`SanityRichText.astro`)

`animated` wraps the Portable Text output in `AnimatedText as="div" splitSelector="[data-text]"` with `flex flex-col gap-[1em]`; `animationDelay` and `viewport` pass through. Without `animated`, rich text renders static.

## Shared pieces

- `prefersReducedMotion()` (`src/lib/utils.ts`) is the shared reduced-motion check every animation honours.
- `skipIntro()`, `skipSplit()` and `whenIntroReady()` (`src/lib/intro.ts`) are the gates; `whenContentReady()` (`src/lib/transitions/content-ready.ts`) is the page-transition leg, see [View transitions](./view-transitions.md).
- `src/lib/curves.ts` holds the bezier control points as data, and the `cubic-bezier()` strings built from them (`REVEAL_EASING`, `CSS_EASING`, `EXIT_EASING`). One source for both, so two animations of the same move cannot drift apart, and a module that only needs a curve pays nothing for it.
- Client behavior follows the vanilla custom-element pair described in the `custom-elements` skill (no React on public pages), with heavy deps deferred via `lazyCustomElement` (`src/lib/lazy-hydrate.ts`).
