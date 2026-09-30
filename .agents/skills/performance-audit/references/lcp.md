# LCP and paint timing

_War stories and code in this file come from Lighthouse passes on React sites. The measurement discipline, fix families, and pitfalls transfer; the React snippets and their config pointers do not. Find this repo's equivalent (a custom element, `lazyCustomElement`, `astro.config.mjs`) instead of transcribing a snippet._

Use this file when **observed** LCP is late (well after observed FCP), or when the LCP element is the wrong thing. If observed LCP is already at first paint and only the simulated number is high, you are in `payload.md` territory.

Two spec facts drive everything here:

- Text at `opacity: 0` or `visibility: hidden` **never paints**, so it can never be an LCP candidate.
- LCP only replaces its candidate with a **larger** paint, and observation stops at the first user interaction.

## Family A: reveal animations that gate LCP

**Symptom:** intro reveal animations (split-text line masks, fade-ups) server-render text with `visibility: hidden` or `opacity: 0` and un-hide when JS hydrates and the animation plays. The browser never paints the text until then, so LCP = full JS download + hydration + animation start. In one measured pass this meant observed LCP of 7.6s on every page, because all headings and rich text went through the same animated-text component.

**Fix:** pre-reveal, hide with `opacity: 0.001` plus the `inert` attribute instead of `visibility: hidden`:

```tsx
const PRE_REVEAL_STYLE = { opacity: 0.001 } as const;
// on the host element:
inert: hidden || undefined,
style: hidden ? PRE_REVEAL_STYLE : undefined,
```

- `opacity: 0.001` is imperceptible but is a real paint, so Chrome records the text as an LCP candidate at first paint.
- `inert` restores what `visibility: hidden` provided for free: the invisible text leaves the tab order and the accessibility tree. Without it, axe fails `aria-hidden-focus` on focusable links inside invisible text. Supported by all target browsers (Safari 16.4+, Chromium/Firefox 111+).
- The reveal animation is completely unchanged: same component, same timing, same masks.

**Measured impact:** observed LCP ~7.6s to ~100-300ms on every page; worth more than every other change in that pass combined.

**Spotting it:** `lcp-breakdown-insight` shows "element render delay" dominating and the LCP element is text that animates in. Or view source: headline text SSR'd with inline `visibility:hidden` / `opacity:0`.

**A11y companion:** a lines-only split needs no aria compensation at all: whole words stay in DOM order, so screen readers read the lines as-is. Do NOT apply the `role="text"` + `aria-label` host + `aria-hidden` lines pattern to it. The label is prohibited on a generic host (axe `aria-prohibited-attr`, Lighthouse "prohibited ARIA attributes"), a label read off `textContent` glues text across `<br>` ("The power toreach anyone"), and with links inside it hides focusable elements from assistive tech permanently. Reserve label compensation for word/char splits, where the text genuinely stops being readable, and even then never when the host contains focusable content.

The inverse case matters too: when the host is itself the label inside a link or button, `inert` strips that element's accessible name pre-reveal and axe fails `link-name` (this shows up especially on below-fold links whose reveal never fires during the audit). The invisible text is not tabbable, so `inert` buys nothing there. Detect a focusable ancestor and skip `inert` for those hosts; the `opacity: 0.001` text stays in the accessibility tree and keeps the name:

```tsx
const insideFocusable = host.parentElement?.closest('a, button, input, select, textarea, [tabindex]') != null
// inert: (hidden && !insideFocusable) || undefined
```

Note this is a real difference from `opacity: 0`: an `opacity: 0` subtree keeps contributing to accessible names, so adding `inert` while migrating from `opacity: 0` can regress link names that used to work.

## Family B: content held hostage by an intro overlay

**Symptom:** FCP 0.9s but LCP 8.6s. Sites with entrance choreography cover the viewport with an opaque intro overlay and keep the real content hidden until a JS-driven reveal, so nothing large paints early and the LCP candidate is whatever appears last.

**Key insight:** LCP counts **painted** elements even when they are occluded by an opaque layer above them. Painting content _under_ the overlay is pixel-identical for users and gives Chrome an LCP candidate at first paint.

**Fix:**

- Render the animated text SSR-visible (no `visibility:hidden` in server HTML) and re-hide in a `useLayoutEffect` at hydration. Layout effects run before the browser paints the hydrated frame, and the overlay cannot fade before hydration anyway (the fade is JS-driven), so users can never see un-animated text.
- For a `clip-path` reveal, add an `ssr` variant (`clipPath: inset(0% 0% 0% 0%)`) used as the `animate` target until a hydration flag flips, with `initial={false}` so the unclipped state serializes into the SSR HTML.
- Measured result: the h1 painted at ~85ms observed and was the LCP element on every run.

**Caveats:**

- Only do this for content covered by an opaque, SSR-rendered layer. Content revealing on scroll without a cover would flash before hiding; use Family A there instead.
- Full-viewport background/wallpaper images are excluded from LCP by Chrome heuristics regardless of size. Do not bother making wallpaper count.

## Family C: a suspending hook blanks the prerendered HTML

**Symptom:** observed LCP ~450ms after FCP on every page; filmstrip shows the shell painting first and all main content a beat later.

**Cause:** a layout-level provider called `useSearchParams()` directly. During static prerender that suspends, so the nearest Suspense boundary (wrapping the entire page content) rendered empty in the HTML; content only painted after hydration.

**Fix:** never let a layout-level provider suspend. Move the read into a tiny child in its own `<Suspense fallback={null}>` that reports up via state; the provider renders children immediately with a default:

```tsx
function FullscreenFromURL({ target, onChange }) {
  const searchParams = useSearchParams() // suspends only this leaf
  const fullscreen = searchParams.get('f') === target
  React.useEffect(() => onChange(fullscreen), [fullscreen, onChange])
  return null
}
```

URL writes read `window.location.search` inside the event handler and set state optimistically.

**Sweep rule:** grep for `useSearchParams` (and any hook that suspends at prerender) and check what subtree its Suspense boundary swallows. If the answer is "the page", the static HTML is an empty shell.

## Family D: hydration mismatch re-rendering every page

**Symptom:** minified React error #418 in `errors-in-console` on every route; Best Practices capped at 96; TBT and LCP inflated everywhere because React falls back to client re-rendering the tree.

**Cause:** a component rendered `new Date()` output; statically prerendered HTML holds the build-time reading, the client renders now.

**Fix:** `suppressHydrationWarning` on the elements whose text is expected to differ. Sweep rule: grep client components for `toLocale`, `new Date()`, `Date.now()`, `Math.random`, and `typeof window` branches in initial render. A clean `errors-in-console` audit is a prerequisite for every other number being meaningful.

## Family E: late-appearing UI steals LCP

**Symptom:** LCP 9.5s+ on half the routes under devtools throttling; the LCP node was a notification toast mounting 5 seconds after load. Any page whose own largest block is smaller than the toast inherits the toast's paint time as LCP. Pages with a big early text block are immune; pages of small tiles and autoplaying videos (LCP-eligible only via posters, and low-entropy LQIP posters are excluded) are not.

**Fix:** show the toast only after first user engagement (`pointermove`, `pointerdown`, `touchstart`, `keydown`, `wheel`, `scroll`; once, passive) plus the designed delay. LCP observation stops at first interaction, so engaged users never had the toast as LCP; idle sessions simply are not interrupted.

**Sweep rule:** list everything that enters the viewport after load (toasts, banners, chat bubbles, cookie prompts). Each is an LCP time bomb for pages whose real content is smaller than it.

## Family F: images and preload discipline

- Ship images near their rendered size. Downscale to an exact integer fraction of the original so the aspect ratio stays mathematically identical, keep 2-3x DPR headroom over the largest rendered size, update `width`/`height` props to match. `sharp` is already in `node_modules` via Next: `sharp(file).resize(w, h, { kernel: 'lanczos3' }).webp({ quality: 90 })`.
- **`priority` on an image is a claim that it is needed for first paint.** Under an intro overlay, almost nothing is; a high-priority preload there only steals critical-path bandwidth.
- An asset needed seconds after load (an intro logo) can be preloaded from the server layout with `fetchPriority: "low"`: the fetch starts at document parse but never competes with fonts/scripts.
- Check for stray `<link rel="preload" as="fetch" fetchPriority="high">` of heavy assets (one pass found a `.glb` for a bottom-of-page 3D model preloaded in the head).

## Text-splitting systems (TBT + correctness; two passes disagree, read both)

Split libraries mutate the DOM per line/word (innerHTML-style operations that show up as "Parse HTML" in traces) and measure as they go. Splitting every instance at hydration cost one legal page ~2.5s in one long task (TBT 940ms); another pass measured 55-125ms of forced style recalc per instance inside the hydration commit.

**The defer-and-chunk fix, safe only with both guarantees:**

1. Defer the split until the element is near the viewport _or_ its reveal gate opens: `canSplit = fontsReady && (isNear || shouldPlayIntro)`. The `shouldPlayIntro` term is the correctness guarantee, not an optimization: it flips in the same render that triggers the reveal, and the split runs in a layout effect while the reveal runs in a passive effect, so within one commit the split always lands first. Gating on the IntersectionObserver alone loses this race under fast scrolling and reveals degrade to whole-block fades.
2. Chunk the work: split one host per ~8ms frame budget (`requestAnimationFrame` loop), first chunk synchronous so the single-host case is unchanged, and a `splitPendingRef` (read live, unlike closure state) holds the reveal until the last chunk lands.

**The counter-experience (P1 in `pitfalls.md`):** in another pass, deferring splits to near-viewport cut TBT 610ms to 280ms, then produced CLS 0.5, because splitting changed section heights and any post-paint height change shifts everything below (with a Lenis-style scroll container the sticky footer is always "in viewport" for CLS). There, all splits had to run in the hydration commit.

**Decision rule:** before deferring splits, verify splitting does not change layout heights. If it does, split everything at hydration and reduce instance count instead. If it does not, defer with the same-commit guarantee and chunking.

**The effect self-dependency bug (worth remembering):** one split effect derived an aria label from `host.textContent`, stored it in state, and had that state in its own deps. The effect ran twice: split, label state change, revert and re-split. Harmless when the split happens seconds before the reveal; catastrophic sharing a commit with it, because the re-split replaces the spans the running animation targets (animation continues on orphaned nodes, text pops in with no stagger). Fix: resolve derived values into a local inside the effect and drop them from deps. General lesson: **an effect must never depend on state it writes itself**, and changing _when_ an effect runs surfaces latent bugs that were benign only by accidental timing.
