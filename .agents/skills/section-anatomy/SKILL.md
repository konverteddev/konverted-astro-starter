---
name: section-anatomy
description: Use when building or changing a page builder section's outer shape: which HTML tag it renders, how it reads the shared section settings, and how to add a new shared layout switch. Also the rule that `PageSections.astro` stays a bare registry. Do NOT use to decide where a section's companion files live (that is section-colocation) or to create a new section (that is scaffolding-plop).
---

# Section Anatomy

A page builder section is self-contained. It fetches its own GROQ slice, and it decides its own outer shape. Nothing above it in the tree knows what tag it renders or how wide it runs.

## Core Rules

- **A section owns its outermost element.** It picks its own tag and its own framing, in its own file. The registry never wraps it, never tags it, and never special-cases it.
- **The tag is a document-outline decision.** A section that carries its own heading is a `section`. One that is a block of content the surrounding prose introduces is not part of the outline, so it stays generic: `div`, or `figure` when it is a media block with a caption. A section whose root is a custom element (`<contact-form>`) is generic to a parser whatever it is called, so when that section belongs in the outline the semantic tag goes in the section file around the element.
- **Every section renders `SectionFrame.astro` as its root**, and hands it `settings={section.settings}`. The frame is centred, bounded to `--page-width` and on `--page-gutter` by default; the editor's Full Bleed switch drops the cap so the section runs to both viewport edges with the page margin kept. Width is a content decision, not a code one, so a section does not hardcode either shape.
- **Full bleed is not a negative margin.** `PageSections.astro` does not cap width, so the frame is the only thing that does. Do not reach for `-mx-(--page-gutter)`: it cannot escape a `max-width`, and the frame simply stops applying one.
- **A shared layout switch is three edits and no per-section work.** Add the field to `sectionLayoutFields` in `sanity/schemas/fields/create-page-builder.tsx`, add it to `SECTION_SETTINGS` in `section-layout.ts` so every section's query reads it, and handle it in `sectionLayout()` so `SectionFrame` applies it. Never add it section by section. A switch only one section could ever use belongs in that section's own schema instead, under `sectionContent`.
- **The page builder column owns the rhythm between sections and nothing else.** `PageSections.astro` is `flex w-full flex-col gap-80 py-64 lg:gap-120 lg:py-96`. A section adds its own internal padding when its design calls for it, but it does not restate the gap.
- **`PageSections.astro` is an inventory.** It maps a Sanity `_type` to a component and renders it with `docId`, `sectionKey`, `isFirst`. It holds no per-section data: no tag map, no bleed list, no conditional wrapper. Adding a section touches exactly one import and one map entry. If you reach for a lookup keyed by `_type`, the fact belongs in the section instead.
- **`SectionFrame` merges, so watch what you merge over.** It runs caller classes through `cx` (tailwind-merge), so a section passes its own layout (`flex flex-col gap-32`, a background, vertical padding) straight to the frame rather than nesting another wrapper inside it. **But a caller class that conflicts with the frame's own wins:** `p-24` or `px-*` on the frame replaces `px-(--page-gutter)` and drops the page margin, so a section with a padded card puts that card in its own box inside the frame (see `CtaSection.astro`).
- **One file by default, split for the insert menu.** A section is `sections/{Name}Section.astro`: it fetches and it renders. Do not split it into a fetching wrapper plus a presentational half on principle; a half with no second consumer only buys you a props type to keep in sync. The one consumer that earns a split is the Studio's insert-menu thumbnail, photographed from a specimen that renders from props: `{Name}Section/{Name}Section.astro` fetches and spreads `{...section.content}` into `{Name}Section/{Name}.astro` (see `section-previews`). A section that will never appear in that menu stays one file. When a section outgrows one file, `section-colocation` owns where the companions go.

## Trigger Conditions

Apply when you are adding a page builder section, changing which tag it renders, adding a switch to the shared section settings, or touching `PageSections.astro` for any reason other than adding a registry entry.

## Execution Checklist

1. Decide the tag from the outline: does this section carry its own heading? Yes → `section` (the `SectionFrame` default). No → `div`, or `figure` for a media block with a caption.
2. Render `SectionFrame` as the root and pass it `settings={section.settings}`; the editor picks the width. Select the settings with `${SECTION_SETTINGS}` rather than spelling the projection out.
3. Write it as one file. Put the tag, the frame and the section's own padding on its root.
4. Register it in `PageSections.astro`, key and component only.
5. Validate: `npm run check` and `npm run check.biome`, then load the section on a real page (`dev-server`).

## Scope Guidance

- Where a section's companion files live once it needs them: `section-colocation`.
- Generating a new section's schema, query and registry wiring: `scaffolding-plop`. The generated section already renders `SectionFrame`; change its `as` and its framing to match the design.
- Classes, tokens and the grid: `tailwind`, `mobile-first`.
- GROQ, typegen and schema work: `sanity`.

## Non-Goals

- Not a file placement rule (`section-colocation` owns that).
- Not a licence to add a shared wrapper back into `PageSections.astro` "just for this one".
- Not a rule about the section's inner layout; only its outermost element and its width.

## Done Criteria

- The section's tag is visible in the section's own file, and its width comes from Sanity rather than from a class.
- `PageSections.astro` gained at most one import and one map entry.
- No section restates `max-w-(--page-width)`, `mx-auto` or the settings projection by hand; it renders `SectionFrame` and interpolates `SECTION_SETTINGS`.
- `npm run check` and `npm run check.biome` pass.

## Reference Files

- `src/features/page-builder/PageSections.astro`: the registry, and the shape it must keep.
- `src/features/page-builder/SectionFrame.astro`: the frame every section renders as its root, and the `as` prop that names it.
- `src/features/page-builder/section-layout.ts`: `SECTION_SETTINGS` (the shared GROQ slice), the settings type, and `sectionLayout()`. The extension point for a new shared switch.
- `sanity/schemas/fields/create-page-builder.tsx`: `sectionLayoutFields`, where the switch itself is defined for every section.
- `src/features/page-builder/sections/MediaSection.astro`: a section rendering `SectionFrame as="figure"`, out of the outline because its caption is the block's own label.
- `src/features/page-builder/sections/CtaSection.astro`: a capped `section` whose padded card is a box inside the frame rather than the frame itself.
- `templates/page-builder-section/component.astro.hbs`: what a generated section starts as.
- No `references/` directory for this skill.
