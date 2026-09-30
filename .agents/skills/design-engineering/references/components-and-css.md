# Component building principles and CSS

## Buttons must feel responsive

Add `transform: scale(0.97)` on `:active` for press feedback (typical range 0.95–0.98).

```css
.button {
  transition: transform 160ms ease-out;
}

.button:active {
  transform: scale(0.97);
}
```

## Never animate from `scale(0)`

Use at least ~`scale(0.9)` with **opacity** so enter does not feel like “popping from nothing.”

```css
.entering {
  transform: scale(0.95);
  opacity: 0;
}
```

## Make popovers origin-aware

Popovers should scale from the **trigger**, not the viewport center. **Modals** stay center-origin.

```css
.popover {
  transform-origin: var(--radix-popover-content-transform-origin);
}
```

## Tooltips: skip delay on subsequent hovers

First tooltip: delay to avoid accidents. Adjacent tooltips while “open”: **instant**, optionally `transition-duration: 0ms` via a `data-instant` flag.

## CSS transitions over keyframes for interruptible UI

Transitions **retarget** mid-flight; keyframes **restart**. For rapidly repeated actions (toasts, toggles), prefer transitions.

## Blur to soften bad crossfades

Subtle `filter: blur(2px)` during crossfade can hide “two objects overlapping.” Keep blur modest (&lt; ~20px)—Safari cost grows fast.

## `@starting-style` for enter animation

Animate mount without JS when support allows; fall back to `data-mounted` + `useEffect` where needed.

## CSS transform mastery

### `translateY` percentages

Percentages are relative to **the element’s own size**—good for drawers and toasts regardless of height. Many **toast stacks** and **drawer libraries** use `translateY(100%)` to hide off-screen before animating in.

```css
.drawer-hidden {
  transform: translateY(100%);
}
```

### `scale()` scales children

Unlike width/height, `scale()` scales content too—often desirable for press feedback.

### 3D transforms

`transform-style: preserve-3d` with `rotateX` / `rotateY` for depth effects.

### `transform-origin`

Set origin to match the **anchor** of the interaction (trigger vs center).

## `clip-path` for animation

### `inset()`

Rectangular clips—reveal/hide along an edge, hold-to-delete overlays, tab color tricks (duplicate tab row + clip).

### Image reveal on scroll

Start `clip-path: inset(0 0 100% 0)`, animate to full—drive with `IntersectionObserver` or **`useInView`** from `motion/react` with `{ once: true, margin: "-100px" }`.

### Comparison sliders

Clip top image with `inset(0 50% 0 0)`; drive inset from drag—GPU-friendly.

## Gesture-related CSS (see also `gestures-performance-a11y.md`)

Hold-to-delete: slow linear press (`2s`), fast ease-out release (`200ms`).
