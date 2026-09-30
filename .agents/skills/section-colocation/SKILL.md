---
name: section-colocation
description: Use when a page builder section outgrows its single file and needs a companion (a client-only component, server action, data, or helper), to decide where that file lives. Do NOT use to create a new section (that is scaffolding-plop) or to place genuinely shared, reusable UI.
---

# Section Colocation

## Core Rules

- A section that fits in one file stays a flat file: `src/features/page-builder/sections/{Name}Section.astro`. Do not make a folder for a single file.
- When a section needs companion files, promote it to a folder `src/features/page-builder/sections/{Name}Section/` and move the component inside it, keeping its name: `sections/{Name}Section/{Name}Section.astro`. This mirrors the `src/components/` convention (`AnimatedText/AnimatedText.astro`), and it stays PascalCase because a section's query lives in `page-builder/queries.ts` rather than in the folder (`code-style` has the PascalCase-bundle vs kebab-module rule). The Sanity schema name and the section component name are unchanged; only the registry import path in `PageSections.astro` gains the folder segment.
- **No `index.astro`.** The entry file repeats the folder name so the component is identifiable in an editor tab and in search. There is no barrel file: nothing in a section folder re-exports anything.
- **Scoped vs shared is the whole decision.** Apply the reuse test:
  - **Scoped** (only this section would ever use it) → colocate in the section folder next to `{Name}Section.astro`. This is the home for a section's client-side script or custom element, its server endpoint/action, and any data or helpers that mean nothing outside the section.
  - **Shared** (another section could plausibly reuse it) → put it under `~/components/*` (a UI primitive or util) and import it via the `~/components/` alias.
- Colocated files import their siblings with relative paths (`./ContactFormElement`, `./actions`); everything outside the folder keeps using the alias or the relative path it already used, re-based one level deeper.
- This skill only moves files. It never renames the section component, the `*SectionField` type, the `sectionContent` schema, or the registry entry.

## Trigger Conditions

Apply when, for an existing page builder section, you are:

- adding a client-side component (custom element or script) whose logic is specific to one section (a form, a carousel, an accordion, a scroll effect),
- adding a server action, data, constants, or helpers used only by one section, or
- deciding whether a new component belongs to a section or to the shared `~/components` library.

## Execution Checklist

1. Run the reuse test: would any other section use this? Yes → shared. No → scoped.
2. **Scoped, section is still a flat file:** create `sections/{Name}Section/`, move `{Name}Section.astro` into it unrenamed, then add the companion file beside it.
3. **Scoped, folder already exists:** drop the companion file in the folder.
4. Re-base every relative import in the moved files one level deeper (`../../sanity/...` → `../../../sanity/...`), and point sibling imports at `./...`.
5. Update the registry import in `PageSections.astro` to `./sections/{Name}Section/{Name}Section.astro`; leave the `sections` map key and the schema untouched.
6. Update any other reference to a moved file: `src/env.d.ts` for a custom element declaration, plus the `docs/features/*.md` page that documents the section.
7. **Shared:** create it under `src/components/...` instead and import via `~/components/` from any section.
8. Validate: `npm run check` and `npm run check.biome`.

## Scope Guidance

- **Hand off to `scaffolding-plop`** to create a brand-new section; it generates the flat `{Name}Section.astro`. This skill takes over only once that file needs companions.
- **Hand off to `astro` / `custom-elements`** for the client component's behavior and to `sanity` for schema/GROQ work.
- Mirror `ContactFormSection/` rather than inventing a layout.
- Changing a page builder section's fields or look dates its insert-menu thumbnail; the fixture behind it lives in `sections/{Name}Section/preview.ts`: `section-previews`.

## Non-Goals

- Not for creating a new section, route, or block (use `scaffolding-plop`).
- Not for placing reusable design-system components (those go in `src/components/`, not a section folder).
- Not a barrel-file convention: no `index.astro`, no re-export hub.
- Not a rename: the component keeps the name it had as a flat file.

## Done Criteria

- A section with companions lives in `sections/{Name}Section/` with `{Name}Section.astro` as the entry.
- Section-only files are colocated in that folder; reusable files are under `src/components/`.
- The `sections` registry key and the Sanity schema name are unchanged; only the import path moved.
- `npm run check` and `npm run check.biome` pass.

## Reference Files

- `src/features/page-builder/sections/ContactFormSection/`: the scoped-companion example. `ContactFormSection.astro` is the section, `ContactFormElement.ts` is its custom element, imported from the component's `<script>` as `./ContactFormElement`.
- `src/components/AnimatedText/`, `src/components/InnerParallax/`: the same folder shape for shared components (`{Name}/{Name}.astro` plus `{Name}Element.ts`).
- `src/features/page-builder/PageSections.astro`: the registry mapping Sanity `_type` to section components.
- No `references/` directory for this skill.
