# Patterns, stagger, debugging, checklist

## What polished UI libraries get right (generic patterns)

Widely used component libraries (toasts, command palettes, etc.) often share:

1. **Low friction** — minimal setup; one root mount, simple API from anywhere.
2. **Great defaults** — most users never touch options; ship excellent defaults.
3. **Distinct naming** — memorable identity beats generic search keywords when appropriate.
4. **Invisible edge cases** — pause timers when tab hidden; pointer capture during drag; small DOM tricks—users should not need to think about them.
5. **Transitions for interruptible UI** — rapid add/remove favors **CSS transitions** over keyframes that restart.
6. **Interactive docs** — playable examples reduce adoption friction.

### Cohesion

Motion feels cohesive when **easing, duration, and visual design** match the product personality—playful vs. sober. Match motion to the mood.

### Opacity + height together

When list items enter/exit in **animated drawers or lists**, opacity and height must be tuned together—often **trial and error** until it feels right.

### Review the next day

Re-watch motion with fresh eyes; use slow motion or frame stepping to catch timing issues invisible at full speed.

### Asymmetric enter/exit

Hold-to-delete: **slow** press (`2s` linear), **fast** release (`200ms` ease-out). Slow where the user decides; fast where the system responds.

```css
.overlay {
  transition: clip-path 200ms ease-out;
}
.button:active .overlay {
  transition: clip-path 2s linear;
}
```

## Stagger animations

Delay each item slightly (often **30–80ms** between siblings). Long stagger feels sluggish. Do not block interaction on stagger finishing.

## Debugging animations

- Temporarily **multiply durations** (2–5×) or use DevTools animation inspector.
- **Frame-step** in Chrome Animations panel for coordinated properties.
- Test **gestures on real devices**; USB + remote devtools beats simulator-only for touch.

## Review checklist

| Issue                                 | Fix                                                             |
| ------------------------------------- | --------------------------------------------------------------- |
| `transition: all`                     | Specify properties, e.g. `transition: transform 200ms ease-out` |
| `scale(0)` entrance                   | `scale(0.95)` + `opacity: 0`                                    |
| `ease-in` on dropdown                 | `ease-out` or custom curve                                      |
| `transform-origin: center` on popover | Trigger origin / Radix var (modals stay centered)               |
| Animation on keyboard shortcut        | Remove                                                          |
| UI motion &gt; ~300ms                 | Shorten to ~150–250ms                                           |
| Hover without coarse-pointer guard    | `@media (hover: hover) and (pointer: fine)`                     |
| Keyframes on rapid toggles            | Prefer transitions                                              |
| Motion `x`/`y` under load             | Prefer `transform: "translateX(...)"`                           |
| Same enter/exit duration              | Often make exit faster                                          |
| Everything at once                    | Short stagger                                                   |
