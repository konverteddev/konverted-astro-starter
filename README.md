# The Content Architecture (Astro)

A modern Astro 7 starter with Sanity CMS integration: content model, embedded Studio, and product features, running on an Astro static-first frontend.

## Features

- Astro 7 in SSR mode: pages render on demand, with the embedded Studio and API endpoints on the same origin, deployable to any host through Astro's adapter system
- Sanity CMS with the Studio embedded at `/studio`
- The pages model: a catch-all route renders any `page` document by its `uri`, homepage included
- Reusable page builder (text, media, headline, CTA, contact form sections) rendered by self-fetching Astro components
- Rich text via Portable Text with media blocks, inline media, links, colors
- Media pipeline: Sanity images (responsive srcset + LQIP), Mux video, native video, Lottie, and Rive
- Draft mode with the Presentation tool and Visual Editing overlays
- SEO helpers: per-page metadata with Site singleton fallbacks, og:image cropping, per-scheme favicons plus a stable `/favicon.ico` for Google, JSON-LD, CMS-driven sitemap and robots
- **HTTP Basic Auth (optional)**: `src/middleware.ts` gates the site or individual URLs using `BASIC_AUTH_*` environment variables and CMS toggles (Site, Security; per-entry "Password protect"). See [`docs/features/basic-auth.md`](docs/features/basic-auth.md).
- **RSS feed**: [`/feed.xml`](docs/features/rss-feed.md) serves the blog as RSS 2.0 with full article bodies, autodiscovered from the blog pages.
- **llms.txt for AI assistants**: an editable, AI-generated [`/llms.txt`](https://llmstxt.org) drafted from your content with Sanity Agent Actions (Site, Agents tab). See [`docs/features/llms-txt.md`](docs/features/llms-txt.md).
- **Agent Markdown (content negotiation)**: pages and articles serve a token-light Markdown version to agents that send `Accept: text/markdown`, on the same URL. A 404 answers with a short Markdown recovery map instead of an error string, so an agent that followed a stale link can re-orient. See [`docs/features/agent-markdown.md`](docs/features/agent-markdown.md).
- **Published API description**: [`/openapi.json`](https://spec.openapis.org/oas/v3.1.0) describes the public endpoints for agents, titled from your Site singleton, alongside one JSON error shape (`error`, `code`, `hint`) across the API endpoints. See [`docs/features/openapi.md`](docs/features/openapi.md).
- CMS-managed redirects baked into the build from the Settings singleton
- Feature modules for Umami analytics and spam prevention
- Scaffolding via Plop for repeatable section/route/block generation
- **A superset you can trim**: `npm run trim` removes a feature you do not need (blog, legal pages, contact form, the form layer, a page-builder section) across its files, registries, docs, dependencies and Sanity content, or refuses to start. See [`docs/features/trimming-features.md`](docs/features/trimming-features.md).
- Starter **seed dataset** (`seed/`), imported by `npm run sanity:project-setup` so a new project boots with example content
- Contact form with honeypot + timing spam prevention and Resend notifications

## Getting Started

**New here? Start with [`GETTING-STARTED.md`](GETTING-STARTED.md).** It is the guided, top to bottom path from a fresh clone to your first rendered section. The sections below are the reference.

### Prerequisites

- Node.js 24.15.0, pinned in `.nvmrc` and in `package.json` (`engines`, `volta`). `engines` requires the `^24.15.0` LTS line, so npm refuses to install on any other major.
- npm >= 11.6.2

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill it in. The minimum for local dev:

```env
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
PUBLIC_SANITY_API_VERSION=2025-02-19
PUBLIC_SANITY_STUDIO_BASE_PATH=/studio
SANITY_API_VIEW_TOKEN=your-view-token
SANITY_API_EDIT_TOKEN=your-edit-token
```

`npm run sanity:project-setup` creates the project, both tokens, CORS entries, and writes `.env` for you.

### HTTP Basic Auth (optional)

For staging or client-review gates, set `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` in the same environment as the app. Turn protection on in Sanity (site-wide and/or per document with "Password protect"); credentials are not stored in the CMS. Full behavior: [`docs/features/basic-auth.md`](docs/features/basic-auth.md).

### Seed starter content

`npm run sanity:project-setup` imports the bundled example content at the end of its run, unless you answer its last question with **Completely empty**. To load it separately (a blank dataset, a second dataset, a reset), with the CLI authenticated (`npm run sanity:cli -- login`):

```bash
npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz
```

See [`docs/sanity/seed-dataset.md`](docs/sanity/seed-dataset.md).

### Development

```bash
npm run dev
```

- Site: [http://localhost:4321](http://localhost:4321)
- Studio: `http://localhost:4321` + your `PUBLIC_SANITY_STUDIO_BASE_PATH` (default `/studio`)

### Build

```bash
npm run build
```

The deploy target is the adapter in `astro.config.mjs`; the repo ships with `@astrojs/vercel` preconfigured as a working default, so `.vercel/output/` holds a serverless function serving the site, the Studio, and `/api/*`, plus the static assets. Deploying anywhere else (a VPS, a container, another platform) is an adapter swap, not an app change: the app answers every route cache lookup itself, so the caching policy is identical on every host. Only the store behind it changes, and on Vercel `ROUTE_CACHE_VERCEL_RUNTIME=true` opts into the Runtime Cache, one cache shared by every function instance rather than one per process. A deploy empties it either way. See [`docs/deployment.md`](docs/deployment.md).

## Docs

Feature-level docs live in `docs/` so the root README stays lightweight. Start at [`docs/README.md`](docs/README.md).

## Scripts

- `npm run dev`: Start the dev server (site + Studio + APIs)
- `npm run build`: Build for production (`astro build`; the output shape follows the configured adapter)
- `npm run start`: Run the site through `vercel dev`, the shipped adapter's local emulator (requires the Vercel CLI)
- `npm run check`: Run all checks (`check.*` in parallel)
- `npm run check.types`: `astro check` type checking (runs typegen first)
- `npm run check.biome`: Biome lint (errors only)
- `npm run format`: Format and fix with Biome (`biome check --write --unsafe`)
- `npm test`: Run the unit tests
- `npm run plop`: Scaffold new sections, prefix routes, and rich text blocks
- `npm run trim`: Interactively remove a feature you do not need (code, docs, dependencies, and optionally its Sanity content)
- `npm run trim -- --status`: What this project has of the starter: each feature's state, its content per dataset, and the code that imports it
- `npm run trim -- --dataset-only --dry-run`: Report Sanity content whose type the schema no longer declares; drop `--dry-run` to delete it
- `npm run trim:update`: Take the starter's current trim into this project, keeping `scripts/trim-features/project.json`
- `npm run clear`: Remove local build and cache output (`.astro`, `node_modules/.vite`, `dist`, `.vercel/output`)
- `npm run sanity:typegen`: Extract the Sanity schema and generate `sanity/types.ts`
- `npm run sanity:cli`: Run the Sanity CLI with `.env` loaded (via dotenvx)
- `npm run sanity:schema-deploy`: Deploy the schema to Sanity (required by Agent Actions)
- `npm run sanity:dataset-export`: Backup a dataset to `./backups/`
- `npm run sanity:dataset-import`: Restore a `.tar.gz` into a dataset
- `npm run sanity:dataset-migrate`: Copy one dataset into another

Every `sanity:*` script above is interactive: run it with no flags and it asks what it needs, prints a summary, and confirms before touching anything. Flags answer those questions up front, `--dry-run` prints the plan and stops, and `--yes` skips every prompt (see `scripts/README.md`).
- `npm run sanity:project-setup`: Interactive wizard for a Sanity project, tokens, CORS, and `.env`

## Project Structure

```text
.
|-- src/
|   |-- pages/           # Astro routes ([...uri].astro is the pages model)
|   |-- layouts/         # Web.astro page shell (head, SEO, transitions)
|   |-- components/      # Shared Astro components (Button, Icon, Lenis)
|   |-- features/        # Feature modules (page-builder, site, agents, sanity fragments, ...)
|   |-- sanity/          # Client-side Sanity layer: loadQuery, media + rich text renderers, queries
|   |   `-- api/         # API endpoints (served at /api/*)
|   |-- middleware.ts    # Basic Auth + agent Markdown negotiation
|   `-- styles/          # Tailwind v4 setup (tokens, typography, global)
|-- sanity/              # Sanity Studio config, schema, structure (standalone folder)
|-- seed/                # Starter dataset shipped with the template
|-- scripts/             # Dataset + project-setup CLIs
|-- templates/           # Plop templates
|-- docs/                # Project documentation
`-- astro.config.mjs     # Env schema, cache provider, CMS redirects
```

## Agent Skills

AI guidance for this repository lives in `AGENTS.md` and `.agents/skills/`.

## Learn More

- [Astro Documentation](https://docs.astro.build)
- [Sanity Documentation](https://www.sanity.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

Commercial, one license per buyer. Build unlimited personal, commercial, and client projects with it, and sell what you build. Do not resell or republish the boilerplate itself.

See [`LICENSE.md`](LICENSE.md) for the full terms, and the [Terms of Service](https://www.contentarchitecture.dev/terms-of-service) for the purchase terms.
