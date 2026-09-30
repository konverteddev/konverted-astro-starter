# Documentation

This folder contains focused documentation for individual features and workflows.

## Start Here

Use this path if you are new to the repository:

1. Read [Deployment](./deployment.md): host-agnostic SSR (pages rendered on demand, embedded Studio, `/api/*`, and middleware on one server); the deploy target is the adapter in `astro.config.mjs`
2. Read [Sanity Setup Overview](./sanity/README.md)
3. Read [Contributor Workflow](./sanity/contributor-workflow.md)
4. Use the task index below to jump to your specific job

## Security and access

- **HTTP Basic Auth**: optional site-wide or per-URL gate: **`BASIC_AUTH_USERNAME`** / **`BASIC_AUTH_PASSWORD`** in deployment env; **Settings** and per-entry toggles in Sanity. Implemented in **`src/middleware.ts`** (`getSanityBasicAuthState()`). Details: [Basic Authentication](./features/basic-auth.md).

## Common Tasks

- Understand the build and how to deploy it -> [Deployment](./deployment.md)
- Understand overall CMS architecture -> [Sanity Setup Overview](./sanity/README.md)
- Configure the embedded Studio, its public path, and reserved paths -> [Studio Config and Structure](./sanity/studio-and-structure.md)
- Change document/field models -> [Schema and Content Model](./sanity/schema-and-content-model.md)
- Update queries or generated type contracts -> [Fetching, GROQ, and Types](./sanity/fetching-groq-and-types.md)
- Troubleshoot preview and draft content -> [Draft Mode and Visual Editing](./sanity/draft-mode-and-visual-editing.md)
- Understand why content is stale and how it refreshes -> [Revalidation and Caching](./sanity/revalidation-and-caching.md)
- Back up, restore, or copy Sanity datasets -> [Dataset export, import, and migration](./sanity/dataset-migration.md)
- Seed a new dataset with the bundled starter content -> [Seed dataset](./sanity/seed-dataset.md)
- Bootstrap a new Sanity project (tokens, CORS, `.env`) -> [Sanity project setup](./sanity/project-setup.md)
- Scaffold a new route/section/block -> [Code Generation (Plop)](./features/code-generation.md)
- Give the Studio's "add section" menu real pictures -> [Section previews](./features/section-previews.md)
- Remove a feature you do not need (blog, legal pages, contact form, a section) -> [Trimming features](./features/trimming-features.md)
- See what of the starter this project still has and uses -> [Trimming features](./features/trimming-features.md#it-knows-what-your-project-has)
- Clean up Sanity content left behind by an earlier trim -> [Trimming features](./features/trimming-features.md#you-can-purge-later-in-any-project)
- Set up HTTP Basic Auth (staging / optional site or per-URL protection) -> [Basic Authentication](./features/basic-auth.md)
- Manage redirect behavior -> [Redirects](./features/redirects.md)
- Build a validated form (shared schema, inline errors) -> [Forms](./features/forms.md)
- Add form anti-spam protection -> [Spam Prevention](./features/spam-prevention.md)
- Configure contact form email notifications -> [Contact Form Notifications](./features/contact-form-notifications.md)
- Add analytics tracking events -> [Umami Tracking](./features/umami-tracking.md)
- Offer an RSS feed of the blog -> [RSS feed](./features/rss-feed.md)
- Generate and serve an llms.txt for AI assistants -> [llms.txt and AI agents](./features/llms-txt.md)
- Auto-generate image alt text on upload (Sanity AI) -> [Automatic alt text](./features/auto-alt-text.md)
- Serve a Markdown version of pages to AI agents (content negotiation) -> [Agent Markdown](./features/agent-markdown.md)
- Describe the public endpoints to agents (OpenAPI, JSON error shape) -> [OpenAPI document](./features/openapi.md)
- Add an AI-generated field (Sanity Agent Actions pattern) -> [Agent Actions](./sanity/agent-actions.md)
- Let AI agents drive Chrome or Firefox, or query the Astro docs -> [MCP Servers](./features/mcp-servers.md)
- Add a modal, or open a page as an overlay over another -> [Dialogs and overlay routes](./features/dialogs-and-overlay-routes.md)
- Change route view transitions or page fades -> [View transitions](./features/view-transitions.md)
- Maintain animated content / motion entrances -> [Animated content](./features/animated-content.md)

## Deployment

- [Deployment](./deployment.md): the shipped adapter, deploying to another host, the env var table (build time vs runtime), content freshness, and live preview.

## Sanity Docs

- [Sanity Setup Overview](./sanity/README.md)
- [Studio Config and Structure](./sanity/studio-and-structure.md)
- [Schema and Content Model](./sanity/schema-and-content-model.md)
- [Fetching, GROQ, and Types](./sanity/fetching-groq-and-types.md)
- [Draft Mode and Visual Editing](./sanity/draft-mode-and-visual-editing.md)
- [Revalidation and Caching](./sanity/revalidation-and-caching.md)
- [Agent Actions (Sanity AI generation)](./sanity/agent-actions.md)
- [Dataset export, import, and migration](./sanity/dataset-migration.md)
- [Seed dataset (starter content)](./sanity/seed-dataset.md)
- [Sanity project setup](./sanity/project-setup.md)
- [Standalone Sanity folder](./sanity/standalone-folder.md)
- [Contributor Workflow](./sanity/contributor-workflow.md)

## Feature Docs

- [Basic Authentication](./features/basic-auth.md): env credentials + CMS toggles (`src/middleware.ts`, `src/features/auth/sanity-basic-auth-proxy.ts`)
- [Studio API auth](./features/studio-api-auth.md): who may call the Studio-backed API routes (verified Sanity session and publish access) and the signed preview session that skips Basic Auth
- [Redirects](./features/redirects.md)
- [Code Generation (Plop)](./features/code-generation.md)
- [Trimming features](./features/trimming-features.md): `npm run trim`, the interactive feature removal for this superset starter (code, docs, dependencies and Sanity content)
- [Forms](./features/forms.md): one `defineForm(schema)` shared by markup, element and endpoint; the form components in `src/components/Form/`
- [Spam Prevention](./features/spam-prevention.md)
- [Contact Form Notifications](./features/contact-form-notifications.md)
- [Umami Tracking](./features/umami-tracking.md)
- [Animated content](./features/animated-content.md): line-split intros via `AnimatedText` (`src/components/AnimatedText/`), on the painted-line splitter [kugiri](https://github.com/edoardolunardi/kugiri)
- [View transitions](./features/view-transitions.md): Astro's `<ClientRouter />` + GSAP presets in `src/lib/transitions/`
- [Dialogs and overlay routes](./features/dialogs-and-overlay-routes.md): the reusable `Dialog` (native `<dialog>`, no focus-trap dependency) and the blog author panel that opens a real URL over the page it was linked from
- [RSS feed](./features/rss-feed.md): `/feed.xml`, the blog as RSS 2.0 with full article bodies, autodiscovered from the blog pages
- [llms.txt and AI agents](./features/llms-txt.md): AI-generated `/llms.txt`, editable in the Settings Agents tab (Sanity Agent Actions)
- [Automatic alt text](./features/auto-alt-text.md): images described on upload and written to `sanity.imageAsset.altText`, with a backfill panel in the Settings Agents tab
- [Agent Markdown](./features/agent-markdown.md): per-page Markdown for agents via `Accept`-header content negotiation (`src/middleware.ts`); generated and stored per page, toggled in the Agents tab
- [OpenAPI document](./features/openapi.md): `/openapi.json` description of the public machine surface, plus the shared JSON error shape for API endpoints
- [Git Hooks](./features/git-hooks.md)
- [Agent Skills](./features/agent-skills.md)
- [MCP Servers](./features/mcp-servers.md): project-scoped `.mcp.json` servers (chrome-devtools, firefox-devtools, Astro Docs) for browser-driven testing and framework documentation
