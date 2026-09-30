---
name: icons
description: The inline-SVG icon system. `src/components/Icon/` is a self-contained folder holding `Icon.astro` plus one `icon-<name>.svg` per icon, and `Icon.astro` is the only module in the repo allowed to import a raw SVG. Covers registering a new icon, preparing the file (`currentColor`, `viewBox`), the `size-[1em]` sizing contract, the decorative `aria-hidden` boundary and where the accessible name comes from instead, and the server-rendered CSS swap for multi-state icons (never a JS `innerHTML` swap). Use when adding, renaming, or removing an icon, when rendering an icon anywhere, or when building a control whose icon changes with state.
---

# Icons

Every inline SVG on a public page renders through `<Icon>`. The component and its SVG files live together in `src/components/Icon/`, so the icon set is one folder you can read, move, or copy into another project in one piece.

## Core Rules

- `src/components/Icon/Icon.astro` is the ONLY module that may `import ... from './icon-*.svg?raw'`. Never import an SVG anywhere else, and never inline raw `<svg>` markup in a component, a `*Element.ts`, or a layout.
- SVG files sit directly in `src/components/Icon/`, one per icon, named `icon-<kebab-name>.svg`. The filename's `<kebab-name>` is the registry key and the public `name` prop.
- Registering an icon is three edits in `Icon.astro` and nothing else: add the `?raw` import, add the key to the `icons` object, done. `IconName` derives from `icons` via `keyof typeof`, so it is never hand-written or hand-extended.
- Prepare the file before committing it: replace every hardcoded `fill`/`stroke` hex with `currentColor` so the icon inherits the host's text color. Keep the `viewBox`.
- Icons are decorative. The span carries `aria-hidden="true"`; the accessible name always comes from the host control (a link's text, a button's label, an `sr-only` span). Never rely on an icon to name anything.
- A state-dependent icon server-renders EVERY state and picks one with CSS off a `data-*` attribute. Never swap `innerHTML` from an element, and never re-import the SVG in TypeScript to do it.
- Import the component as `~/components/Icon/Icon.astro`.

## Trigger Conditions

Apply when adding, renaming, or deleting an icon; when rendering an icon in any `.astro` file; when building a button, link, or toggle whose icon reflects state; or when a component is about to reach for a raw `.svg?raw` import.

## Execution Checklist

1. Drop `icon-<name>.svg` into `src/components/Icon/`.
2. Swap its hardcoded colors for `currentColor`; leave `viewBox` alone.
3. In `Icon.astro`: add the `?raw` import (alphabetical with its neighbors) and the matching key in `icons`.
4. Render it: `<Icon name="<name>" />`, plus a `size-*` class when it should not track the font size.
5. Run `npm run check` and `npm run check.biome`.

## Scope Guidance

- This skill owns the icon registry, the SVG file contract, and how icons render.
- The `size-*`/color utilities you pass, and the token system behind them: `tailwind`.
- The element that flips the `data-*` attribute on a multi-state icon: `custom-elements`.
- Sanity-driven link icons go through `src/features/sanity/link/SanityLinkIcon.astro`, which is a consumer of this system, not a second one: `sanity`.

## Non-Goals

- A second icon source (an icon font, a sprite sheet, an npm icon package, `<img src="*.svg">` for UI glyphs).
- Raw `.svg?raw` imports outside `Icon.astro`.
- Icons in `public/` for interface use. `public/` is for favicons, OG images, and other assets referenced by URL.
- Per-icon wrapper components (`ArrowIcon.astro`). The registry key is the API.

## Done Criteria

- The new SVG lives in `src/components/Icon/` and uses `currentColor`.
- `Icon.astro` is still the only file importing a `.svg?raw`, verified by grep.
- `IconName` was not edited by hand.
- Any state-dependent icon renders all its states server-side and switches with CSS.

## Reference Files

- `src/components/Icon/Icon.astro`: the registry and the render contract.
- `src/features/sanity/link/SanityLinkIcon.astro`: a CMS-driven consumer that maps link shape to an icon name.

## Detailed conventions

### The registry

```astro
---
import arrowRight from "./icon-arrow-right.svg?raw";
import arrowUpRight from "./icon-arrow-up-right.svg?raw";

// The single registry: every inline SVG on a public page is imported here and nowhere else.
const icons = {
  "arrow-right": arrowRight,
  "arrow-up-right": arrowUpRight,
} as const;

export type IconName = keyof typeof icons;
---
```

One registry means the icon set is greppable, tree-shakeable as a unit, and impossible to fork by accident. It also means a typo in a `name` is a type error rather than an empty span.

### Preparing an SVG

Exported icons arrive with a baked-in color (`fill="#232626"`, `stroke="#141B34"`). Replace it with `currentColor` on every path, so one file serves every variant and theme:

```svg
<path d="..." fill="currentColor" />
```

This is not cosmetic. A hardcoded dark hex disappears against a dark surface, so an icon that only ever ships inside a light-on-dark button is invisible until it inherits.

Leave `viewBox` in place. The `width`/`height` attributes can stay; `Icon.astro`'s `*:size-full` overrides them from CSS.

### Sizing

`Icon.astro` defaults to `size-[1em]`, so an unsized icon tracks the host's font size and stays optically matched to adjacent text. Pass a `size-*` utility to pin it instead (`<Icon name="arrow-right" class="size-20" />`). Use the spacing scale, never a px arbitrary.

### Multi-state icons

Render every state and let a `data-*` attribute on an ancestor choose. No JS touches the SVG, the swap cannot flash, and the host keeps DOM identity, so focus survives it:

```astro
<sound-toggle class="group/sound inline-flex">
  <button type="button" aria-label="Turn sound on">
    <Icon name="volume-mute" class="size-20 group-data-[sound-on]/sound:hidden" />
    <Icon name="volume-high" class="hidden size-20 group-data-[sound-on]/sound:block" />
  </button>
</sound-toggle>
```

The element's whole job is `this.toggleAttribute('data-sound-on', isOn)` plus updating the host control's `aria-label`. The tempting alternative, holding SVG strings in the element and assigning `innerHTML`, is banned: it re-imports icons outside the registry, ships the markup twice, and re-parses SVG on every toggle.

Name the group (`group/sound`) rather than using a bare `group`, so nesting inside another group-using component cannot cross-trigger it.

The host needs a real box (`inline-flex`, not `contents`): a boxless wrapper has nothing for a reveal animation to transform or fade.

### Icon-only controls

An icon-only button has no visible text, so it needs an explicit `aria-label`. Put the label on the control, never on the icon: the `<Icon>` span is `aria-hidden` by design and assistive tech will not read anything inside it.
