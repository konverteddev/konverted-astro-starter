# Section previews

The Studio's "add section" menu shows a grid of pictures rather than a list of names. Those pictures are photographs of the real sections, taken by a headless browser against a route that renders one section on an otherwise empty page. Nothing is drawn by hand, and nothing is screenshotted by hand.

## The three pieces

**The fixture** is `preview.ts`, beside the section it belongs to:

```ts
// sections/CtaSection/preview.ts
import type { ComponentProps } from "astro/types"
import { definePreview } from "~/features/page-builder/section-preview"
import type Cta from "./Cta.astro"

export const preview = definePreview<ComponentProps<typeof Cta>>({
  props: { headline: "Lorem ipsum dolor\nsit amet", cta: sampleCta("Button Text Here") },
})
```

`definePreview` is identity; it exists so `props` is checked against the component's real props. The registry in `src/features/page-builder/section-preview.ts` finds these with `import.meta.glob`, so there is no list to add a section to.

**The route** is `/section-preview/<section>` (`src/pages/section-preview/[section].astro`). It renders one section, centred in a 1440x960 frame, with no page chrome. It is also the quickest way to look at a single section while building it.

It is an authoring surface, not a page of the site, and it is kept out of search on every layer:

- **It does not exist in a build.** The page returns 404 unless `import.meta.env.DEV`, so the capture runs against the dev server.
- **It is always behind Basic Auth on a deployment.** `src/middleware.ts` gates every path under `/section-preview` whatever the CMS toggles say, ahead of the preview cookie and the agent Markdown rewrite, and fails closed with a 503 when the credentials are unset (see [Basic Authentication](./basic-auth.md#the-section-preview-is-always-gated)). `astro dev` stays open.
- **It is never indexed.** Every response under the prefix, the 401 and the 404 included, carries `X-Robots-Tag: noindex, nofollow`, and the page says the same in its robots meta.
- **It is never in the sitemap.** `src/pages/sitemap.xml.ts` drops any CMS page whose URL falls under the prefix.

It is deliberately not in `robots.txt`: a `Disallow` would stop crawlers from reading the `noindex`, and would publish the path.

**The script** is `npm run sections:thumbs`, which walks the sections, photographs each one, and writes `public/page-builder-section-thumbs/<slug>.jpg` at 960x640. Pass section slugs to re-shoot only those:

```sh
npm run sections:thumbs                 # every section
npm run sections:thumbs cta-section     # just one
npm run sections:thumbs -- --url=http://localhost:4322
```

A bare run re-shoots every section, so that is the command after any change you are unsure about: it only rewrites the pictures that actually moved. It needs `astro dev` running, because the specimen route does not exist in a build.

## Why a section is split

A section is one file by default: it fetches its GROQ slice and renders it. A section that should appear in the insert menu is split, because the specimen renders from props and cannot use the fetching half:

- `{Name}Section/{Name}Section.astro` fetches and spreads `{...section.content}` into
- `{Name}Section/{Name}.astro`, which renders from props, and is what the specimen imports.

A section left as one file gets no thumbnail and falls back to its Sanity icon in the insert menu. That is a deliberate outcome, not a gap: a live form or a section with nothing visual to show is better represented by its icon than by a still.

## Fixture options

| Key | Effect |
| --- | --- |
| `props` | The props the section renders from. A function when the section needs a media slot filling. |
| `height` | Crop height in CSS pixels; the default frames the section as a 3:2 tile. |
| `skip` | No thumbnail at all. The insert menu falls back to the section's icon. |

A section whose content comes from the CMS takes the function form, and fills the slot from the placeholder files the repo ships:

```ts
export const preview = definePreview<Props>({
  props: (media) => ({ media: media.editorial(16 / 9) }),
})
```

| Slot | File | Use |
| --- | --- | --- |
| `media.editorial(ratio?)` | `public/placeholders/editorial.jpg` | A wide picture: a media block, a backdrop. Returns a whole media object. |
| `media.icon()` | `public/placeholders/icon.svg` | A mark: a customer logo, a card icon. Returns a bare image. |

These are static files in the repo, never dataset content, so a preview renders the same on any project and in CI. `toPreviewMedia(image, ratio)` wraps a bare image when a slot wants a whole media object.

Swapping a placeholder is a drop-in: keep the path, then update the dimensions in `src/features/page-builder/section-preview-assets.ts` and re-run the capture. `npm test` fails when one of the files is missing.

## When to re-shoot

Whenever the section changes: a new field, a new layout, different copy, a reworked fixture. This is enforced, not remembered.

Each capture records a hash of the section's own `.astro` files and its `preview.ts` in `public/page-builder-section-thumbs/manifest.json` (generated, committed). `npm test` then fails on four things:

- a section with a presentational half but no `preview.ts`,
- a non-skipped fixture with no thumbnail,
- a thumbnail whose section has changed since it was taken, naming the exact command to run,
- a thumbnail left behind by a deleted section.

The hash covers the section's own files only. Editing a shared component it renders (`Button`, `SectionFrame`, a reveal primitive) will not trip it, so re-shoot by hand after a change to shared UI that alters how sections look.

## Gotchas

- **A broken page is never photographed.** The capture fails a section when a script or stylesheet 404s or 504s, because an element that never registers photographs half-built. A `504 Outdated Optimize Dep` means the dev server's Vite cache is stale: restart it (`rm -rf node_modules/.vite` first) and capture again.
- **Motion.** The capture runs with `reducedMotion: "reduce"`, which every reveal primitive already answers by skipping to its finished state. A section that animates without honouring reduced motion will photograph mid-animation, and that is a bug in the section.
- **Basic Auth.** `astro dev` never gates, so the usual run needs no credentials. On a deployment the specimen is always gated, so a `--url` pointing at one needs `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD`, which the script sends when they are set.
- **Chrome.** The script drives the system Chrome through `playwright-core`, so no browser is downloaded on install. Chrome has to be present.
- **Re-running is cheap.** The capture is byte-deterministic, so the script rewrites a file only when the picture actually changed and a full run produces no git noise.
