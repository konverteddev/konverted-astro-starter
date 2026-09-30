---
name: mobile-first
description: Responsive styling is mobile-first. The base (unprefixed) utilities describe the phone; `sm:`/`md:`/`lg:`/`xl:`/`2xl:` prefixes add or override for wider screens. Never use `max-*` variants (`max-md:hidden`, `max-lg:flex`) to describe the small screen by subtracting from a desktop default. To toggle visibility, write `hidden` then restore the natural display at the breakpoint (`md:flex`, `md:block`, `md:inline`, `md:grid`), never `max-md:hidden`. Use when adding responsive utilities, toggling elements per viewport, or reviewing a diff that touches breakpoints.
---

# Mobile-first responsive

Base utilities are the phone. Breakpoint prefixes only add or override going wider. The design system reinforces this: default Tailwind breakpoints are reset and re-declared in `src/styles/tailwind.css` (`--breakpoint-sm: 40rem`, `md: 48rem`, `lg: 64rem`, `xl: 80rem`, `2xl: 96rem`), all min-width. There is no `max-*` breakpoint token by design.

## Core Rules

- Write the mobile layout with unprefixed utilities. Layer wider-screen changes with `sm:`/`md:`/`lg:`/`xl:`/`2xl:`.
- Never use `max-*` variants (`max-sm:`, `max-md:`, `max-lg:`, ...). They describe the small screen by subtracting from a desktop default, which is backwards. A `max-*` in a diff is the tell.
- To show an element only at md and up: `hidden md:flex` (or `md:block`/`md:inline`/`md:grid` — match the element's natural display), NOT `flex max-md:hidden`.
- To show an element only below md: `flex md:hidden` (base display + hide at the breakpoint). This is already mobile-first; keep it.
- Pick the right restore utility. `hidden md:flex` for a flex row, `hidden md:block` for a `<div>`/`<p>`, `hidden md:inline` for an `<a>`/`<span>`. Getting this wrong changes layout at md+.

## Toggle cheat sheet

| Intent                              | Mobile-first                  | Never                             |
| ----------------------------------- | ----------------------------- | --------------------------------- |
| Hide below md, show (flex) at md+   | `hidden items-center md:flex` | `flex items-center max-md:hidden` |
| Hide below md, show (block) at md+  | `hidden md:block`             | `max-md:hidden`                   |
| Hide below md, show (inline) at md+ | `hidden md:inline`            | `inline max-md:hidden`            |
| Show below md, hide at md+          | `flex md:hidden`              | (already correct)                 |

## Execution Checklist

1. Start from the phone layout in unprefixed utilities.
2. Add `sm:`/`md:`/`lg:` overrides for wider screens only.
3. For visibility toggles, default to `hidden` and restore the natural display at the breakpoint.
4. Grep the diff for `max-` variants before finishing; convert any you find.
5. Run `npm run format` and `npm run check`.

## Scope Guidance

- Owns the mobile-first direction and the `max-*` ban for responsive utilities.
- Token system, spacing scale, `<style>` policy, `isolate`: `tailwind`.
- Breakpoints are declared in `src/styles/tailwind.css` (min-width only).

## Done Criteria

- No `max-*` variant anywhere in the change.
- Base utilities describe the phone; breakpoint prefixes only add going wider.
- Visibility toggles restore the correct natural display (`flex`/`block`/`inline`/`grid`) at the breakpoint.
