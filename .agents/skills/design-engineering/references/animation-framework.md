# Animation decision framework

Before writing animation code, answer these in order.

## 1. Should this animate at all?

**Ask:** How often will users see this animation?

| Frequency                                                   | Decision                     |
| ----------------------------------------------------------- | ---------------------------- |
| 100+ times/day (keyboard shortcuts, command palette toggle) | No animation. Ever.          |
| Tens of times/day (hover, list navigation)                  | Remove or drastically reduce |
| Occasional (modals, drawers, toasts)                        | Standard animation           |
| Rare / first-time (onboarding, celebrations)                | Can add delight              |

**Never animate keyboard-initiated actions** that repeat hundreds of times daily—animation slows them and breaks the feeling of direct control.

Some launchers use **no open/close animation** on purpose for always-on tools; that is the right tradeoff for extreme frequency.

## 2. What is the purpose?

Every animation needs a clear “why”:

- **Spatial consistency** — e.g. toast enters/exits from same direction so swipe-to-dismiss matches
- **State indication** — morphing control shows state change
- **Explanation** — marketing or onboarding motion
- **Feedback** — press scale confirms input
- **Avoiding jarring change** — abrupt show/hide feels broken

If the purpose is only “it looks cool” and the user sees it often, **do not animate**.

## 3. What easing?

- Entering or exiting → **ease-out** (fast start, responsive)
- Moving/morphing on screen → **ease-in-out**
- Hover / color → **ease**
- Constant motion (progress, loops) → **linear**
- Default for UI → **ease-out**

**Use custom easing curves** — built-in CSS easings are often too weak.

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

**Avoid `ease-in` for UI** — it delays initial movement when the user is watching most closely.

Resources: [easing.dev](https://easing.dev/), [easings.co](https://easings.co/)

## 4. How fast?

| Element                  | Duration      |
| ------------------------ | ------------- |
| Button press             | 100–160ms     |
| Tooltips, small popovers | 125–200ms     |
| Dropdowns, selects       | 150–250ms     |
| Modals, drawers          | 200–500ms     |
| Marketing / explanatory  | Can be longer |

**Rule of thumb:** keep routine UI motion **under ~300ms** unless deliberately slow (e.g. hold-to-delete).

### Perceived performance

- Faster spinners feel like faster loads (same real duration)
- Shorter dropdowns feel snappier than long ones
- After the first tooltip is open, **instant** adjacent toolbars feel faster

## Spring animations

Springs simulate physics; duration emerges from parameters.

### When to use springs

- Drag with momentum
- “Alive” decorative elements
- **Interruptible** gestures
- Decorative pointer follow (not functional precision UIs)

### Spring-based pointer follow

Direct 1:1 mapping to pointer position can feel stiff. Interpolate with a spring so motion has momentum (use **decorative** cases only).

```tsx
import { useSpring } from 'motion/react'

const rotation = mouseX * 0.1

const springRotation = useSpring(rotation, {
  stiffness: 100,
  damping: 10,
})
```

### Spring configuration

**Duration + bounce (simpler to reason about):**

```js
{ type: "spring", duration: 0.5, bounce: 0.2 }
```

**Physics-style:**

```js
{ type: "spring", mass: 1, stiffness: 100, damping: 10 }
```

Keep bounce subtle (0.1–0.3). Skip bounce in most sober UI; use for drag-to-dismiss or playful surfaces.

### Interruptibility

Springs keep velocity when interrupted; **CSS keyframes** often restart from zero—springs suit gestures that reverse mid-flight.
