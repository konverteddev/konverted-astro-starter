---
name: design-engineering
description: Use when polishing UI craft—motion, micro-interactions, easing, CSS transforms, gestures, perceived performance, and accessibility for animation—so interfaces feel intentional and cohesive. Pair with the gsap-* skills for the GSAP/Lenis stack details. Do NOT use as the primary skill for CMS schema, Plop scaffolding, or pure code-style formatting without a UI craft angle.
---

# Design engineering

## Core Rules

- **Taste is trained** — study strong interfaces, reverse-engineer motion, and iterate; polish is a skill, not a fixed gift.
- **Unseen details compound** — small correct choices add up to interfaces that feel “right” without users naming why.
- **Animate with purpose** — match frequency of use to motion budget (no animation on high-frequency keyboard paths; richer motion for rare flows).
- **Prefer `transform` and `opacity`** for animation; avoid animating layout properties unless necessary.
- **Respect `prefers-reduced-motion`** and coarse/touch hover—see references.
- **Reviews use a table** — when suggesting UI fixes, use the **Before / After / Why** markdown table format in `references/philosophy-and-review.md`.

## Trigger Conditions

Apply when the task is **interaction design**, **CSS/motion polish**, **animation review**, **micro-interactions**, or **making UI feel more responsive**—not for every feature or data-only change.

## Execution Checklist

1. Confirm the work is **craft/UI** (this skill) vs **runtime wiring** alone (**astro**).
2. Read the relevant file(s) under Reference Files—animation decisions vs components/CSS vs gestures vs patterns.
3. Align snippets with this repo: **GSAP** (see the **gsap-core** skill) where applicable.
4. Run `npm run check` when touching components.

## Scope Guidance

- **gsap-core** / **gsap-scrolltrigger**: GSAP and Lenis usage; this skill does not replace scroll architecture.
- **astro**: routing and view transitions; pair when polish touches navigation transitions.
- **code-style**: readability conventions; pair when conditional markup structure is part of the change.
- **gsap-performance**: animation performance; pair when motion work collides with performance budgets.
- **modern-web-guidance**: search its `accessibility` guide for keyboard/focus, semantics, forms, contrast, and non-color-cue requirements. This skill owns motion **feel**; the guide owns a11y **requirements**. For reduced-motion in this repo, use the `prefers-reduced-motion` media query (CSS or `gsap.matchMedia()`).

## Non-Goals

- Owning **Sanity**, **schema**, or **GROQ** unless the change is purely presentational in Studio.
- Replacing the **modern-web-guidance** `accessibility` guide for WCAG-oriented patterns or formal audit claims. This skill covers motion craft, not full a11y coverage.

## Done Criteria

- Motion and CSS guidance match **reduced-motion** and **hover capability** where relevant.
- Review suggestions use the **required table format** when comparing before/after.
- Imports match project conventions (`~/` alias; relative inside `sanity/` and `src/sanity/`).

## Reference Files

- `references/philosophy-and-review.md` — taste, compounding details, **required review table format**.
- `references/animation-framework.md` — when to animate, easing, duration, springs, Motion snippets.
- `references/components-and-css.md` — buttons, popovers, tooltips, transforms, `clip-path`, `@starting-style`.
- `references/gestures-performance-a11y.md` — drag/momentum, GPU vs main thread, Motion vs CSS, WAAPI, `prefers-reduced-motion`, hover media queries.
- `references/patterns-and-checklist.md` — library-quality patterns (generic case study), stagger, debugging, final checklist.
