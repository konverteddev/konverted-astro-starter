---
name: astro
description: Astro page, layout, and routing conventions for public pages. Every page composes `Web.astro` (base shell, SEO/meta, Tailwind, draft-mode overlay); logic goes in the frontmatter with early returns, templates stay thin. Dynamic routes render on demand, reading `Astro.params` plus `loadQuery`. Covers the SEO Props plus `head` slot pattern and page-level draft mode. Use when adding or editing a route, layout, or page-level data fetching.
---

# Astro pages and routing

This repo is mainly Astro plus Tailwind plus TypeScript. Public pages render server-side on demand and enhance with custom elements. React never appears on public pages.

## Core Rules

- Compose the layout: `Web.astro` is the only page shell (SEO, meta, analytics, fonts, Tailwind, smooth scroll, draft-mode overlay). Every public page goes through it.
- Put branching and data logic in the frontmatter with early returns and named consts. Keep templates thin: `{cond && <X />}`, a short ternary, or `.map()`. No nested ternaries in markup.
- Routes render on demand: read `Astro.params` and fetch with `loadQuery` in the frontmatter. There is no `getStaticPaths` and no prerendering.
- SEO/meta flows through the layout `Props` (`title`, `description`, `canonical`, `ogTitle`, `robots`, `noindex`); per-page tags go in the `head` slot via `<Fragment slot="head">`.
- Absolute URLs come from `absoluteUrl(path)` (`~/lib/env`). Never concatenate `PUBLIC_SITE_URL`.
- Draft mode is per-request: read it with the `src/sanity/lib/draft-mode.ts` helpers and pass the perspective cookie to `loadQuery`.

## Trigger Conditions

Apply when adding or editing a route under `src/pages/`, a layout under `src/layouts/`, page-level Sanity fetching, SEO/meta, or anything touching draft mode or the route config in `astro.config.mjs`.

## Execution Checklist

1. Compose `Web.astro` and pass its typed `Props`.
2. Do data and branching in the frontmatter; keep the template thin.
3. For dynamic routes, read `Astro.params` and fetch with `loadQuery`.
4. Add per-page meta through the `head` slot.
5. For draft-aware pages, thread the perspective cookie via the draft-mode helpers.
6. Run `npm run check` (type-checks `.astro`).

## Scope Guidance

- This skill owns page/layout/route composition and page-level fetching.
- GROQ, query result types, and content components: `sanity`.
- Tailwind tokens, the `<style>` policy, where Tailwind loads: `tailwind`.
- Client behavior inside a page: `custom-elements`.
- API endpoints and their injection at `/api/*`: `server`.

## Non-Goals

- React on public pages.
- Heavy conditional logic in templates (do it in the frontmatter).
- Editing generated Sanity types or the build config without reading `astro.config.mjs`.

## Done Criteria

- The page composes a layout and passes typed `Props`; meta uses the `head` slot.
- Every absolute URL goes through `absoluteUrl`; nothing concatenates `PUBLIC_SITE_URL`.
- Logic is in the frontmatter; the template is thin.
- Dynamic routes read `Astro.params` and fetch with `loadQuery`.
- Draft-only behavior is gated on the preview cookie.

## Reference Files

- `src/layouts/Web.astro`: the one page shell. SEO `Props`, `head` slot, `tailwind.css` import, draft-mode overlay.
- `src/pages/[...uri].astro`, `src/pages/blog/[slug].astro`: on-demand dynamic routes.
- `astro.config.mjs`: output/adapter, integrations, injected routes, env schema.
- `src/sanity/lib/draft-mode.ts`: page-level draft helpers.
- `src/lib/env.ts`, `src/lib/site-url.ts`: the env seam and the URL join behind `absoluteUrl`.

## Detailed conventions

### Layouts

- `Web.astro` defines the SEO `Props` (`title`, `description`, `canonical`, `ogTitle`, `robots` default `max-image-preview:large`, `noindex`, `viewport`), renders the document head, analytics, and the `<VisualEditing />` overlay only when draft mode is active and the page is server-rendered. It exposes a named `head` slot and the default slot.
- `Web.astro` also imports `../styles/tailwind.css`, the single entry point for the whole design system (see `tailwind`). No page or component imports stylesheets of its own.

### SEO and per-page meta

```astro
<Web title={title} canonical={canonical}>
  <Fragment slot="head">
    <meta property="og:image" content={ogImage} />
  </Fragment>
  <main>...</main>
</Web>
```

Defaults live in `Web.astro` (`ogTitle = title`, `robots`, `og:type`, `twitter:card`). Override per page via `Props` and the `head` slot.

### Absolute URLs

Canonicals, JSON-LD `url`s, sitemap `<loc>`s, `robots.txt` entries, and share links are all built with `absoluteUrl`:

```ts
import { absoluteUrl } from "~/lib/env";

const canonical = absoluteUrl(uri); // absoluteUrl("/") keeps the root's single slash
```

`PUBLIC_SITE_URL` is a hand-edited env value (a `.env` line, a Vercel dashboard field), so a trailing slash is always one keystroke away. `src/lib/env.ts` normalizes it on import and is the only module allowed to read the raw value; `absoluteUrl` joins the path, so `//` can never reach a canonical or a share URL. Pass the bare `PUBLIC_SITE_URL` only where an origin is wanted (a `siteUrl` argument to a structured-data helper, an allowed-origin check).

A hand-built URL (`${PUBLIC_SITE_URL}${uri}`) fails the guard test in `src/lib/site-url.test.ts`, which scans `src/` and `templates/`. `astro.config.mjs` validates the env value is an absolute URL (`url: true`) and warns when it carries a trailing slash.

### Dynamic routes

Routes render on demand: read `Astro.params` in the frontmatter, fetch with `loadQuery`, and return a 404 `Response` when nothing matches:

```astro
---
const uri = Astro.params.uri ? `/${Astro.params.uri}` : "/";

const { data: page } = await loadQuery<PageQResult>({ query: PageQ, params: { uri }, ...getDraftModeProps(Astro) });

if (!page) {
  return new Response(null, { status: 404 });
}
---
```

There is no `getStaticPaths`; do not add one.

### Draft mode

- Read draft state with the `src/sanity/lib/draft-mode.ts` helpers, which check the `sanity-preview-perspective` cookie per request.
- Pass the perspective cookie into `loadQuery` so it fetches the `drafts` perspective with stega overlays. See `sanity` for the fetch side.

### Server output

- `astro.config.mjs` sets `output: "server"` with a deploy adapter (the repo ships `@astrojs/vercel` as the default; the adapter is the per-project deploy choice): every route renders on demand on the server, the Studio is embedded at `PUBLIC_SANITY_STUDIO_BASE_PATH` (default `/studio`), and the `/api/*` endpoints and middleware are always present.
