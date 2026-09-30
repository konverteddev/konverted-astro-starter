---
name: tailwind
description: Styling conventions using Tailwind v4. Tailwind-first, no `<style>` tags for normal styling (rare inline `<style>` needs a stated reason). The design system lives in `src/styles/*.css` via `@theme` (fluid typography scales, spacing, breakpoints, radii, fonts) and loads through `Web.astro`. The spacing scale is 1 unit = 1px, so use scale utilities (`mb-16`) and never px arbitraries (`mb-[16px]`). Covers `isolate` for z-indexed layers with a compact z-index scale (`z-1`-`z-3`, never `z-50`/arbitrary jumps), when to extract a class string (three or more uses), and letting Biome's `useSortedClasses` order classes. Use when styling a component or page, or touching the Tailwind config.
---

# Tailwind styling

Styling is Tailwind-first. The design tokens live in CSS `@theme` blocks, loaded app-wide through `Web.astro` (which imports `src/styles/tailwind.css`).

## Core Rules

- Tailwind-first for all normal styling. No `<style>` tag for layout, spacing, color, or typography.
- Reach for `<style>` only when Tailwind genuinely cannot express the rule, state the reason in a comment, and treat that as rare.
- Use the theme tokens from `src/styles/*.css` (fluid typography scales, spacing, radii, fonts). Do not hardcode hex colors or ad-hoc font sizes when a token exists.
- The spacing scale is 1 unit = 1px (`--spacing: 0.0625rem`). NEVER write px arbitrary values (`mb-[16px]`, `gap-[8px]`, `inset-[24px]`, `px-[40px]`); always use scale utilities (`mb-16`, `gap-8`, `inset-24`, `px-40`). For border-radius use the `--radius-*` tokens (`rounded-8`), never `rounded-[6px]`.
- Tailwind loads via `Web.astro` (which imports `tailwind.css`), so utilities work on every page.
- Page-level containers are `mx-auto w-full max-w-(--page-width) px-(--page-gutter)`, and header-relative offsets read `--header-height`. Never restate the underlying values or the breakpoint at a use site (`max-w-1200`, `px-16 lg:px-48`).
- Add `isolate` to the parent of any element using a `z-*` utility, unless an ancestor already establishes a stacking context.
- Keep z-index values small (`z-1`, `z-2`, `z-3`). Never reach for a big or arbitrary number (`z-50`, `z-[51]`, `z-60`) to "clear" something; add `isolate` to the right parent instead (see Stacking contexts below).
- Inline a class string at the use site for one or two occurrences. Extract a named const only at three or more uses.
- Let Biome's `useSortedClasses` (via `npm run format`) order classes. Do not hand-sort.
- When a component merges its own classes with a caller-supplied `class` prop, use `cx` from `~/features/style/utils` (tailwind-merge, custom text scale registered) so caller classes reliably override defaults. Plain `class:list` is fine when there is no default to override.

## Trigger Conditions

Apply when styling any `.astro` or component, adding utilities, editing `src/styles/*.css`, or working with z-index, fonts, or the design tokens.

## Execution Checklist

1. Style with Tailwind utilities and existing tokens; do not add a `<style>` tag.
2. If a value recurs as a design decision, add or reuse a token in `src/styles/*.css` rather than a magic number.
3. Add `isolate` to the stacking parent when introducing a `z-*` utility.
4. Extract a class string to a const only at three or more uses.
5. Run `npm run format` (orders classes) and `npm run check`.

## Scope Guidance

- This skill owns Tailwind usage, the token system, the `<style>` policy, and z-index.
- Where Tailwind is loaded and how pages compose: `astro`.
- Class strings on interactive markup still follow `custom-elements` for `data-*` hooks (style with classes, target with data).

## Non-Goals

- `<style>` tags for normal styling, or global CSS outside the `src/styles/` system.
- Hardcoding colors/sizes that duplicate a token.
- Hand-sorting class order (Biome owns it).

## Done Criteria

- New styling uses Tailwind utilities and tokens; no new `<style>` tag.
- Any `z-*` utility has an `isolate` (or pre-existing) stacking parent, and its value stays in the `z-1`-`z-3` range (no arbitrary jumps like `z-50`/`z-[51]`).
- Repeated class strings are extracted only at three or more uses.
- Classes are Biome-ordered.

## Reference Files

- `src/styles/tailwind.css`: entry point (`@import` chain), `@theme` (layout bounds, breakpoints, spacing, radii), the base-layer shell measurements (`--header-height`, `--page-width`, `--page-gutter`), the `hover` custom variant, and the `scrollbar-invisible` utility.
- `src/styles/colors.css`: the palette, deliberately minimal (black, white, plus `current`/`transparent`/`inherit`; Tailwind's default palette is reset).
- `src/styles/typography.css`: font tokens (`sans`, `mono`, five `pixel-*` faces) and the fluid type scales (`caption`, `cta`, `body-10`, `body-20`, `headline-10`, `headline-20`) with weight/line-height/letter-spacing.
- `src/styles/fonts.css`: Geist variable faces via `@fontsource-variable`, plus `@font-face` for the Geist Pixel faces self-hosted from `public/fonts/geist-pixel/`.
- `src/styles/global.css`, `animations.css`: base layer (the locked `html`/`body`, focus ring, selection) and keyframes (`fade-in`, `fade-out`).
- `src/styles/sanity-rich-text.css`: element styles for portable-text output.
- `src/layouts/Web.astro`: the single Tailwind entry point (`import "../styles/tailwind.css"`).
- `src/styles/screens.ts`: the TS mirror of the `--breakpoint-*` tokens; keep the two in sync.

## Detailed conventions

### The token system (Tailwind v4)

- Configuration is CSS, not a JS config: `tailwind.css` does `@import "tailwindcss"` then chains `fonts`, `colors`, `typography`, `animations`, `global`, `sanity-rich-text`. Tokens are declared in `@theme` blocks.
- Colors: the default Tailwind palette is reset (`--color-*: initial`) down to `black`, `white`, `current`, `transparent`, `inherit`, `unset`. The site is white on black. Adding a color means adding a token in `colors.css`, not an arbitrary hex at the use site.
- Spacing base is `1px` (`--spacing: 0.0625rem`), so the spacing scale counts in pixels: `mb-16` is 16px, `inset-24` is 24px, `pt-88` is 88px. NEVER write px arbitrary values (`mb-[16px]`, `gap-[8px]`, `inset-[24px]`, `px-[40px]`); drop the brackets and unit instead (`mb-16`, `gap-8`, `inset-24`, `px-40`). This applies to every spacing-driven utility: margin, padding, gap, inset/top/right/bottom/left, width, height, size, space, translate. Border-radius has no 1px scale, so use the `--radius-*` tokens (`rounded-4/8/12/16/full`), e.g. `rounded-8`, never `rounded-[6px]` or `rounded-6`. Breakpoints are in `rem` so they respect the user's font size.
- Fonts: `--font-sans` and `--font-mono` are Geist, imported from `@fontsource-variable` and resolved by Vite. The five `--font-pixel-*` faces (square, grid, circle, triangle, line) are self-hosted from `public/fonts/geist-pixel/` with `font-display: swap`.

### Shell measurements

- `--header-height`, `--page-width` and `--page-gutter` are declared on `:root` inside `@layer base`, not in `@theme`. Read them with the custom-property syntax: `h-(--header-height)`, `max-w-(--page-width)`, `px-(--page-gutter)`.
- `@theme` is for scale entries Tailwind can name a utility after (`--radius-8` gives `rounded-8`). These three have no namespace that produces the utility you actually want: there is no `--height-*`, and routing the gutter through `--spacing-*` would put a named entry in an otherwise numeric scale and generate a pile of meaningless siblings (`gap-gutter`, `mt-gutter`). The page width could live in `--container-*`, but it is kept here so the shell reads as one definition with one consumption syntax.
- A `@theme` token can still be overridden per breakpoint from the base layer, since utilities compile to a `var()` reference. That is not the reason these three sit here.
- Every page-level container takes its width from `max-w-(--page-width)` and its side margin from `px-(--page-gutter)` (`PageSections.astro`, `ArticleList.astro`, `SiteHeader.astro`, `SiteFooter.astro`, `SiteError.astro`, `blog/[slug].astro`). The distance from the viewport to the content is one decision, so changing it is one edit rather than a padding pair restated per container.
- `--header-height` is the header's real height: `SiteHeader.astro` sets `h-(--header-height)` and centres the nav in it. Anything that has to clear the header measures it (`top-(--header-height)`, `scroll-mt-(--header-height)`) instead of restating the header's own utilities.

### Fluid typography

- Type scales are `clamp()`-based, fluid between the `--layout-min-w` (375) and `--layout-max-w` (1600) bounds, each with companion weight, line-height, and letter-spacing tokens. Tailwind's default sizes are reset, so `text-sm`/`text-lg` do not exist: use `text-caption`, `text-cta`, `text-body-10`, `text-body-20`, `text-headline-10`, `text-headline-20`.

### The loading model

- `src/layouts/Web.astro` is the one place that imports `tailwind.css`, and every public page composes `Web.astro`, so utilities are available everywhere. Do not import Tailwind anywhere else, and do not add a second layout to opt a page in or out.

### No `<style>` tags

- Default to utilities. There is currently no `<style>` block anywhere in `src/`, and that is the bar to clear: reach for one only when Tailwind genuinely cannot express the rule, and say why in a comment. Element-level styling for CMS rich text is the exception that already has a home, `src/styles/sanity-rich-text.css`, because the markup comes from portable text and carries no classes.

### Stacking contexts

- Any element using a `z-*` / `-z-*` utility needs an ancestor (usually the immediate parent) with `isolate` to create a predictable stacking context. Do not rely on `z-index` reaching across unrelated parts of the tree.
- Tailwind v4 generates bare `z-*` utilities for any integer (no theme config or bracket syntax needed), so `z-1`, `z-2`, `-z-1` etc. all work directly. There is never a reason to write `z-[51]` or jump to `z-50`/`z-60`.
- Two scopes, two rules:
  - **Local (inside an `isolate` boundary):** the values only need to out-rank their own siblings, so use `z-1`, and `z-2` for a second internal layer. The one `z-*` in the repo today is exactly this shape: the contact form's honeypot sits at `-z-1` inside its own section, out of the way of everything else.
  - **Global (fixed or sticky chrome that can stack against other fixed or sticky chrome across the whole page):** keep the ladder short and tiered low to high, `z-1` for a background or scrim, `z-2` for the chrome itself, `z-3` for a control that must stay above its own panel. Reuse a tier whenever two things never share a page. Add a tier only for a layer that is genuinely new, and never skip ahead to a big number.
  - When fixing a "should be on top" bug, add `isolate` to the correct parent or move the element to the right tier. Never invent a higher number to "win".
