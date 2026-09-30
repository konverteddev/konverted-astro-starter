---
name: section-previews
description: The picture a page builder section shows in the Studio's insert menu, and the fixture behind it. Covers the colocated `preview.ts`, the `/section-preview/<section>` specimen route, and `npm run sections:thumbs`, the headless capture that writes `public/page-builder-section-thumbs/`. Use whenever a page builder section changes at all: a new or renamed field, a layout or markup change, new copy, a new variant, a split into a presentational half, or a brand-new section; also when an insert-menu tile is missing, stale or wrong. If the change touches `src/features/page-builder/sections/`, this applies, and `npm test` fails until the fixture and thumbnail are updated. Do NOT use for the section's own shape (that is section-anatomy) or for where its companion files live (that is section-colocation).
---

# Section Previews

An editor picks a section from a grid of pictures. Those pictures are photographs of the real sections, taken from a route that renders one section alone, so they cannot drift into lying about what a section looks like.

## Core Rules

- **A section's sample content lives in exactly one place**: `sections/{Name}Section/preview.ts`, beside the section.
- **A section with a presentational half has a `preview.ts`.** This is enforced by `src/features/page-builder/section-preview.test.ts`, which fails `npm test` when one is missing. Splitting a section is what earns it a thumbnail; a section left as one file has no specimen and falls back to its Sanity icon, which is correct, not a gap.
- **Fixtures are typed against the real component**: `definePreview<ComponentProps<typeof Cta>>({ ... })`. `definePreview` is identity and exists only for that inference.
- **Never register a section anywhere.** The registry globs `sections/*/preview.ts` and `sections/*/*.astro`. Adding the file is the whole registration.
- **A CMS-backed slot is filled from the repo's own placeholders, never a dataset.** Write `props` as a function: `props: (media) => ({ media: media.editorial(16 / 9) })`. The two slots are `editorial()` (a wide picture) and `icon()` (a logo or card mark), served from `public/placeholders/`. Never hardcode a Sanity asset id, and never reach for dataset content: a preview must render the same on any project and in CI.
- **The specimen route is dev-only.** `/section-preview/<section>` 404s unless `import.meta.env.DEV`, so it never ships in a deployment. The capture runs against `astro dev`; never expose it to make a deployment capturable.
- **The specimen route is never public or indexed.** `src/middleware.ts` keeps `/section-preview` behind Basic Auth on every deployment whatever the CMS says, every response under it carries `X-Robots-Tag: noindex, nofollow`, and the sitemap drops any URL under it. Keep all three when touching the middleware, the sitemap or the route, and never add it to `robots.txt`, which would hide the `noindex` from crawlers.
- **A failed capture is never a thumbnail.** The script refuses to photograph a page whose scripts or styles failed to load, because an unregistered custom element renders half-built. A `504 Outdated Optimize Dep` is a stale dev server, not a code fault: restart it and capture again.
- **Changing a section means re-shooting it.** A new field, a new layout, reworded copy, a different fixture: all of it dates the thumbnail. `npm test` enforces this rather than trusting memory. The capture records a hash of each section's own `.astro` files and its `preview.ts` in `public/page-builder-section-thumbs/manifest.json`, and the test fails naming the command to run: `npm run sections:thumbs <slug>`. The script leaves unchanged pictures alone, so a full run is safe and produces no git noise.
- **The hash covers the section, not its dependencies.** Editing a shared component the section renders (`Button`, `SectionFrame`, a reveal primitive) will not trip the test, so re-shoot by hand after a change to shared UI that alters how sections look.
- **A section that cannot be photographed says so**: `skip: "<reason>"`. It gets no file and the insert menu shows its icon. A thumbnail is always a real capture: never hand-make one, and never stand a drawn tile in for a section that will not photograph.
- **Sample content is neutral placeholder copy**, never real client content. Shared values live in `section-preview-samples.ts`.

## Trigger Conditions

Apply whenever a page builder section changes at all: a new or renamed field, a layout or markup change, different copy, a new variant, a split into a presentational half, or a brand-new section. Also when an insert-menu tile is missing, stale or wrong. If you edited anything under `src/features/page-builder/sections/`, this skill applies.

## Execution Checklist

1. Build or change the section following its own skills (`section-anatomy`, `tailwind`, `custom-elements`).
2. Split it if it is still one file: `{Name}Section.astro` fetches and spreads `{...section.content}` into `{Name}.astro`, which renders from props.
3. Write or update `sections/{Name}Section/preview.ts`, typed with `ComponentProps<typeof Half>`.
4. Extend the fixture to exercise whatever you added, so the thumbnail shows the new field or layout rather than the old shape.
5. Check it alone at `/section-preview/<slug>` (see `dev-server` for reaching the running site).
6. `npm run sections:thumbs <slug>`, and look at the written JPEG.
7. `npm run check`, `npm run format`, `npm test`.

## Scope Guidance

- This skill owns the fixture, the specimen route, the capture script and the thumbnails.
- The section's tag, width and whether it needs a presentational half: `section-anatomy`.
- Where a section's companion files live: `section-colocation`.
- Generating a new section's schema, query and registry wiring: `scaffolding-plop`.
- Reaching the running site for the visual check: `dev-server`.

## Non-Goals

- Not hand-made screenshots, mockups or drawn placeholder tiles.
- Not a live preview of the editor's own content; that is `presentationTool`, already wired.
- Not a reason to split a section that will never appear in the insert menu.

## Done Criteria

- Every section with a presentational half has a `preview.ts`, and every non-skipped one has a thumbnail taken from its current source.
- The fixture exercises whatever the change added, so the thumbnail shows the section as it now is.
- `npm run check`, `npm test` and `npm run check.biome` pass.

## Reference Files

- `docs/features/section-previews.md`: the pipeline, fixture options, and the gotchas (motion, Basic Auth, Chrome).
- `src/features/page-builder/section-preview.ts`: the fixture type, the media pool and the glob registry.
- `src/pages/section-preview/[section].astro`: the specimen route.
- `scripts/section-thumbs/capture.ts`: the capture, and where the source hash is recorded.
- `src/features/page-builder/section-preview.test.ts`: the four gates that fail `npm test`.
- `src/features/page-builder/sections/MediaSection/preview.ts`: a fixture that fills a CMS media slot.
