# Deployment

The app is host-agnostic SSR. `npm run build` produces a server that renders every page on demand
and also serves the embedded Studio (at `PUBLIC_SANITY_STUDIO_BASE_PATH`, default `/studio`), the
`/api/*` endpoints, and the middleware (Basic Auth, agent Markdown negotiation). Nothing in the app
depends on a hosting provider: route caching is answered by the app itself and falls back to an
in-process store off Vercel (see
[Revalidation and Caching](./sanity/revalidation-and-caching.md)), and the deploy target is decided
by one line in `astro.config.mjs`, the
[adapter](https://docs.astro.build/en/guides/on-demand-rendering/).

The repo ships with the Vercel adapter (`@astrojs/vercel`) preconfigured as a working default.
Deploying anywhere else is an adapter swap, not an app change; see
[Deploying to another host](#deploying-to-another-host).

## Deploying with the shipped adapter (Vercel)

```bash
npm run build     # astro build -> .vercel/output/ (run npm run sanity:typegen first if the schema changed)
```

Deploy by connecting the Git repository to a Vercel project (every push builds and deploys; the
default branch goes to production) or from the CLI with `vercel deploy` / `vercel deploy --prod`.
To ship a locally produced build instead of building on Vercel, run `npm run build` then
`vercel deploy --prebuilt`.
Vercel detects Astro, runs `npm run build`, and ships the Build Output API directory
(`.vercel/output/`): static assets on the CDN, everything else through the serverless function.
`npm run start` (`vercel dev`) runs the project through Vercel's emulator locally; plain
`npm run dev` stays the everyday dev server.

Node version: Vercel picks the runtime from `engines.node` in `package.json` (currently `^24.15.0`, matching `.nvmrc`).

## Environment variables

Set these in the deployment environment, whatever the host (for the shipped Vercel setup: project
Settings, Environment Variables, for Production and Preview). Public (`PUBLIC_*`) vars are validated by the env schema in `astro.config.mjs` and baked into the
build, so they must be present at **build** time. `SANITY_API_VIEW_TOKEN` and `SANITY_API_EDIT_TOKEN`
are **required** and validated at build / dev-start (`env.validateSecrets: true`), so a missing one
fails the build. The remaining server secrets are optional and their features check at use time.

| Variable                                      | When    | Purpose                                              |
| --------------------------------------------- | ------- | ---------------------------------------------------- |
| `PUBLIC_SITE_URL`                             | build   | Canonical site URL (`Astro.site`, absolute links). Must be an absolute URL or the build fails; a trailing slash is stripped |
| `PUBLIC_SANITY_PROJECT_ID`                    | build   | Sanity project                                       |
| `PUBLIC_SANITY_DATASET`                       | build   | Sanity dataset                                       |
| `PUBLIC_SANITY_API_VERSION`                   | build   | API version (default `2025-02-19`)                   |
| `PUBLIC_SANITY_STUDIO_BASE_PATH`              | build   | Public Studio path (default `/studio`)               |
| `PUBLIC_UMAMI_WEBSITE_ID`                     | build   | Umami analytics (tracking off when unset)            |
| `SANITY_API_VIEW_TOKEN`                       | build   | **Required.** Draft-mode preview and authenticated reads |
| `SANITY_API_EDIT_TOKEN`                       | build   | **Required.** Contact form writes, AI generation, SEO screenshot |
| `SANITY_REVALIDATE_SECRET`                    | runtime | Signs the `/api/revalidate` webhook (only if you use it) |
| `RESEND_API_KEY` / `RESEND_EMAIL_FROM`        | runtime | Contact form notification emails                     |
| `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` | runtime | HTTP Basic Auth credentials (toggles live in Sanity) |
| `ROUTE_CACHE_VERCEL_RUNTIME`                   | runtime | `true` to store routes in Vercel's Runtime Cache, shared across instances; `false` (default) uses the in-process store |

`SANITY_API_VIEW_TOKEN` is also read at build time in `astro.config.mjs` (the redirects fetch, and
only needed there if the dataset is private). See `.env.example` for the full list.

## Content freshness

Pages render on demand and are cached by the app's own route cache (`src/lib/route-cache/`) with
tag-based invalidation, on any host: the Sanity publish webhook (`/api/revalidate`, secured by
`SANITY_REVALIDATE_SECRET`) busts the affected routes the moment content changes, and publishing
either site-wide singleton busts the whole site. Nothing expires on a timer, so the webhook is what
makes publishing live: without it, a published change reaches a cached route only on the next
deploy. With `ROUTE_CACHE_VERCEL_RUNTIME=true`, entries live in Vercel's Runtime Cache, so one
cache is shared by every function instance and the webhook reaches all of them at once. **A deploy
still empties the cache**, on the first request the new build serves, because rendered HTML is a
function of code as well as content. That is keyed off a build id baked into the bundle, so it
needs no Vercel project setting and works the same on any host.
Details and the full tag model:
[Revalidation and Caching](./sanity/revalidation-and-caching.md).

The one exception is **redirects**: they are fetched from Sanity in `astro.config.mjs` at build
time and baked in, so a redirect change in the Studio needs a rebuild and redeploy. The Settings
document's **Redeploy site** button (`sanity/inputs/redeploy-input.tsx`, on the Redirects field) is
a placeholder seam you can point at your hosting's rebuild trigger; on Vercel, create a Deploy Hook
(Project Settings, Git, Deploy Hooks) and POST to it from `handleRedeploy`.

## Deploying to another host

Swap the adapter in `astro.config.mjs` and redeploy; the app, its caching, and its middleware do
not change. For a plain server (a VPS, a container, any Node host):

```bash
npx astro add node
npm run build
node ./dist/server/entry.mjs
```

That standalone server serves the site, the Studio, and `/api/*`; set the environment variables
from the table above in that environment, put the process behind your web server or process
manager of choice, and point the Sanity webhook at the deployed `/api/revalidate`. Other adapters
(Netlify, Cloudflare, Node in middleware mode) follow the same pattern; see the
[Astro adapter docs](https://docs.astro.build/en/guides/on-demand-rendering/). The Node version to
match is `engines.node` in `package.json` (mirrored in `.nvmrc`).

## Live preview (Presentation tool)

The embedded Studio's Presentation tool renders the frontend in an iframe with click-to-edit
overlays; on-demand rendering is what lets a page read the draft-mode cookie per request and return
draft content. The flow:

1. An editor opens Presentation. The Studio loads the same-origin frontend in an iframe and calls
   `/api/draft-mode/enable` with a signed secret.
2. `enable` validates the secret, sets the `sanity-preview-perspective` cookie plus the signed httpOnly `__draft_session` (the only proof of a preview session the middleware trusts; see [Studio API auth](./features/studio-api-auth.md)), and redirects back.
3. With the cookie present, `loadQuery` (`src/sanity/lib/load-query.ts`) fetches the `drafts`
   perspective with stega encoding, and `<VisualEditing />` (mounted in `Web.astro`, draft mode only)
   draws the overlays. Editing a field reloads the page to pull fresh draft content (Astro has no live
   re-render API).

Editors also get per-document actions in the Studio (`sanity/actions.tsx`), shown only on documents
with a public page: **Open live page** (the published page), **Open draft page** (the draft
full-page, with a fresh preview secret per click), and **Open in presentation** / **Open in
Structure** to move a document between the preview iframe and the form editor.

Notes:

- `SANITY_API_VIEW_TOKEN` (Viewer) must be set in the deployment environment: it validates the
  preview secret and reads drafts. Preview is the main reason the token is required in deployment.
- No CORS changes are needed because the Studio and frontend share an origin. The Studio uses browser
  routing (a server catch-all at `/studio/[...]`), and `stega.studioUrl` is the relative `/studio` path,
  so the overlay's links into the Studio resolve against whatever origin serves the site.
