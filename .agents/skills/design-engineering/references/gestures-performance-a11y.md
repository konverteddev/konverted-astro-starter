# Gestures, performance, accessibility

## Gesture and drag

### Momentum-based dismissal

Consider **velocity**, not only distance: `Math.abs(dragDistance) / elapsedTime`. Quick flick above ~0.11 can dismiss without hitting distance threshold.

### Damping at boundaries

Past the natural stop, **rubber-band** with damping instead of a hard wall.

### Pointer capture

After drag starts, **capture** pointer so tracking continues outside the element.

### Multi-touch

Ignore new touch points once a drag started to avoid jumps.

### Friction instead of hard stops

Allow overscroll with increasing friction rather than blocking abruptly.

## Performance rules

### Prefer `transform` and `opacity`

They stay on the compositor. Animating margin/padding/width/height triggers layout.

### CSS variables propagate

Updating a var on a parent can restyle many children. For drag offset, prefer **`transform` on the moving node** over a shared var every frame on a large subtree.

### Motion shorthand vs GPU

**Motion**’s `x` / `y` / `scale` props are convenient but may run on the main thread like `requestAnimationFrame`. For **maximum smoothness under load**, animate explicit **`transform`** strings so the browser can treat them like transform animations.

```jsx
<motion.div animate={{ transform: 'translateX(100px)' }} />
```

In demanding apps, **CSS animations** can stay smoother than JS-driven motion while the main thread loads assets—use CSS for fixed choreography; JS/Motion for dynamic, interruptible motion.

### Web Animations API

`element.animate(...)` gives programmatic control with performance closer to CSS.

## Accessibility

### `prefers-reduced-motion`

Reduce or remove **motion**; keep opacity/color that aid understanding.

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    animation: fade 0.2s ease;
  }
}
```

In **this repo**, branch motion with the `prefers-reduced-motion` media query (CSS, or `window.matchMedia` / `gsap.matchMedia()` in scripts); see the **gsap-core** skill for the GSAP pattern.

### Touch devices and `:hover`

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover {
    transform: scale(1.05);
  }
}
```

Avoid hover-only motion that fires incorrectly on touch after tap.
