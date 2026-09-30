# Repository Guidelines

The Content Architecture (Astro) is mainly Astro, Tailwind, and TypeScript with a Sanity CMS. Public pages are Astro plus Tailwind plus vanilla TypeScript (custom HTML elements). React is used only inside the embedded Sanity Studio and must never bleed into, or be used on, public-facing pages.

## Agent Workflow

1. Scope first: find the smallest set of files to change and avoid unrelated edits.
2. Before substantive edits, name the skill(s) that apply (a one-line Skill Preflight) and read each one under `.agents/skills/<name>/SKILL.md` first.
3. When docs and code disagree, current repository code is the source of truth.
4. Reuse-first: prefer existing components, patterns, and helpers before adding new ones.
5. After Sanity schema changes, run `npm run sanity:typegen`. Generated files (`sanity/types.ts`, `sanity-schema.json`) are never edited by hand.
6. Prefer the Plop generators (`npm run plop`) for new page builder sections, prefix routes, and rich text blocks.

## Project Structure

- `src/pages/`: Astro routes. `[...uri].astro` is the pages model (every `page` document renders here, homepage included); `blog/[slug].astro` is the prefix-route pattern (`blog/authors/[slug].astro` adds the overlay-route pattern: a page that also renders as a panel over the one that linked to it); `llms.txt.ts`, `sitemap.xml.ts`, `robots.txt.ts`, `feed.xml.ts` are CMS-driven endpoints.
- `src/layouts/`: the page shell (`Web.astro`: head/SEO/OG, JSON-LD, transitions, Umami, draft-mode overlay).
- `src/components/`: shared UI. A component with no companion files is a flat `Component.astro`; with companions (a paired `ComponentElement.ts` custom element, sub-components, or assets) it is a PascalCase folder. A folder that also owns a data layer (`query.ts`, `fragment.ts`) is a kebab-case module instead (`src/features/site/site-header/`); see `code-style`.
- `src/features/`: product feature modules, grouped by domain: `page-builder/` (section components + queries + `PageSections.astro` registry), `site/` (shell, header, footer, error, announcement bar), `forms/` (the shared form layer: `defineForm` rules, the `FormElement` base class, endpoint responses), `sanity/` (link + media GROQ fragments and image URL builders), `rich-text/` (fragments), `agents/` (llms.txt + agent Markdown + auto alt text), `feed/` (the blog RSS feed: query, HTML and XML serializers), `auth/`, `spam-prevention/`, `umami/`, `utils/`.
- `src/sanity/`: the app-side Sanity layer: `lib/load-query.ts` (all fetches), `lib/draft-mode.ts`, `queries.ts` (route queries), `seo.ts`, `media/` (SanityMedia dispatch: image, Mux, native video, Lottie, Rive), `rich-text/` (astro-portabletext renderers).
- `src/pages/api/`: API endpoints (file-based routing, served at `/api/*`).
- `src/middleware.ts`: CMS-managed HTTP Basic Auth + agent Markdown content negotiation. It holds the request pipeline only; each step lives in `src/features/auth/` or `src/features/agents/`.
- `src/styles/`: Tailwind v4 setup (tokens, fluid typography, global, rich text element styles).
- `sanity/` (root): the Studio: schema, structure, actions, templates, inputs. Standalone folder: only relative imports inside, configured through `sanity/config.ts` (see `docs/sanity/standalone-folder.md`).
- `scripts/`, `seed/`, `templates/`: project-setup and dataset CLIs, starter content, Plop templates.
- `scripts/trim-features/`: `npm run trim`, the inverse of `plopfile.mjs`. Removing a feature from this superset starter means updating the **manifest** (`features.ts`, the starter's), not writing code; `manifest.test.ts` fails the moment a registry it names moves. A project records what it did with the starter in `project.json` (`npm run trim -- --status`, `--reconcile`) and takes starter fixes with `npm run trim:update`. See `docs/features/trimming-features.md`.

Path aliases from `tsconfig.json`: `~/*` resolves into `src/` (`~/components/*`, `~/layouts/*`, `~/features/*`, `~/lib/*`), and `~/sanity/*` resolves into the ROOT `sanity/` folder (constants and generated types). Always import absolutely; keep relative paths only for same-folder siblings and inside the two `sanity/` folders, which stay portable.

- Studio-backed API routes: the first step is `const denied = await authorizeStudioRequest(request)` from `~/features/api/auth`, and Studio code calls them with `useStudioFetch()` / `studioFetch()` from `sanity/lib/studio-fetch.ts`. Never gate on `Origin`/`Referer`, and never trust a preview cookie's presence; see `docs/features/studio-api-auth.md`.
## Coding Style & Conventions

These are the global one-liners. Authoritative detail lives in the skill named on each line.

- Language: TypeScript (Astro strict tsconfig). Format and lint with Biome (`biome.jsonc`): double quotes, semicolons, `lineWidth` 130. Run `npm run format`. Biome covers `.astro` frontmatter only; keep template markup tidy by hand. See `code-style`.
- Control flow: braced `if`/`else` with blank-line spacing so code breathes. No one-line `if`. Prefer `type` over `interface`. See `code-style`.
- Comments: rare, one line, WHY only. Never inside `.astro` markup. A module header is two lines at most; a longer one is a `docs/` page with a one-line pointer to it. See `comments`.
- No React on public pages: it lives only in the Sanity Studio. Client behavior is a custom HTML element (`Component.astro` markup plus a paired `ComponentElement.ts`); the `.astro` `<script>` only imports the element. See `custom-elements`.
- Pages and routing: compose `Web.astro`, logic in frontmatter; the app is always SSR (on-demand rendering). See `astro`.
- Absolute URLs: never concatenate `PUBLIC_SITE_URL`. Build every canonical, sitemap `<loc>`, and share link with `absoluteUrl(path)` from `~/lib/env`, the seam that normalizes the origin (no trailing slash) and joins the path. A test in `src/lib/site-url.test.ts` fails the build on a hand-built one.
- Styling: Tailwind-first. No `<style>` tags for normal styling. `isolate` on parents of z-indexed layers. Merge default + caller classes with `cx` from `~/features/style/utils` (tailwind-merge). See `tailwind`.
- Responsive: mobile-first. Base utilities are the phone; `md:` etc. only add going wider. Never `max-*` variants. See `mobile-first`.
- Scroll: listen to native scroll only (`window` events, ScrollTrigger defaults). Never bind to the Lenis instance; Lenis drives the native scroller and is not mounted in draft mode. Only `src/components/Lenis/` imports `lenis` (Biome-enforced). See `custom-elements`.
- Sanity: define queries with `defineQuery` (from `groq`), fragments live beside their feature, fetch via `loadQuery`, render with the `.astro` helpers; types are generated, not hand-edited. See `sanity`.
- Section previews: a section that appears in the Studio's insert menu is split, and owns a `preview.ts` beside it. Changing a section (new field, new layout, new copy) means updating that fixture and re-running `npm run sections:thumbs <slug>`; `npm test` fails until you do. See `section-previews`.
- Page builder sections self-fetch their own GROQ slice by `docId` + `sectionKey` and register in `PageSections.astro`. Each section renders `SectionFrame.astro` as its outermost element and forwards `sectionSettings`, so shared layout switches (Full Bleed today) reach every section at once. Use the Plop generator. See `section-anatomy`, `section-colocation` and `scaffolding-plop`.
- Server endpoints live in `src/pages/api/` (file-based routing). See `server`.

## Skills

`AGENTS.md` and `.agents/skills/` are not redundant. This file stays short: workflow, layout, a few global conventions, and an index of skills. Authoritative rules, checklists, and any `references/` live in `.agents/skills/<name>/SKILL.md`. Use this file to orient; use the skill folder for anything non-trivial.

Before substantive edits, read `.agents/skills/<name>/SKILL.md` for each skill in your Skill Preflight. If a skill lists Reference Files, read those before changing related code.

Repo-architecture skills:

- **code-style**: language-level style (breathing control flow, `type` over `interface`, naming, imports, the Biome setup); also the simplicity review (duplication, dead code, hand-rolled stdlib; one-line findings).
- **comments**: comment minimalism; comments are rare, one line, and explain WHY. No comments inside `.astro` markup; a module header is two lines at most and a longer one belongs in `docs/`. Carries the density budget and an audit recipe.
- **conventional-commits**: commit and PR title format (`type(scope): summary`), the type and scope vocabulary in use, imperative subjects, and bodies that explain why. Enforced by a `commit-msg` hook (commitlint); the skill covers what the hook cannot judge. Read before writing any commit message.
- **custom-elements**: the vanilla-TS custom element pattern for all client behavior. No React on public pages.
- **icons**: the `src/components/Icon/` registry; `Icon.astro` is the only module that imports a raw SVG.
- **lazy-hydration**: defer heavy element JS via `lazyCustomElement` (`src/lib/lazy-hydrate.ts`); used by the Mux/Lottie/Rive media renderers.
- **astro**: pages, layouts, routing, SEO/meta, and page-level draft mode.
- **tailwind**: Tailwind v4 `@theme` token system, Tailwind-first, `isolate`, class-string extraction.
- **mobile-first**: base utilities describe the phone; wider-only prefixes; bans `max-*` variants.
- **sanity**: CMS end to end: GROQ + typegen flow, custom GROQ functions (repeated projections are hoisted, not inlined), `loadQuery`, media/rich-text renderers, draft mode, the React-only Studio boundary, and the product conventions (page builder, uri model, singletons).
- **server**: Astro API endpoints in `src/pages/api/`.
- **dev-server**: reaching the running site for a visual check: reuse the dev server that is already up, start your own only when there is none, and confirm the client booted before trusting a screenshot.

Product skills: **agent-markdown**, **section-anatomy**, **section-colocation**, **section-previews**, **scaffolding-plop**, **trim-features** (removing a shipped feature from the code and the dataset, and what of the starter a project still has; run `npm run trim` first and finish only what it reports it could not apply), **seo-aeo-best-practices**, **umami-analytics**, **design-engineering**, **docs-maintenance**, **performance-audit**. General engineering skills: **modern-web-guidance** and the **gsap-*** bundle (**gsap-core**, **gsap-timeline**, **gsap-scrolltrigger**, **gsap-plugins**, **gsap-utils**, **gsap-performance**).

When adding or renaming a skill, update this Skills index in the same change.

## Quality Gates

- `npm run check.types` (runs typegen, then `astro check` for type checking across `.astro` and `.ts`).
- `npm run check.biome` (Biome, errors only; braces enforced via `useBlockStatements`). `npm run format` applies fixes.
- `npm run check` (runs every `check.*` in parallel).
- `npm test` (unit tests for the `scripts/` CLIs, `src/` features, and `sanity/` schema utils). Renaming a schema registry, a routed constant or a page-builder section also means updating `scripts/trim-features/features.ts`: in the starter, `manifest.test.ts` asserts every anchor it names still resolves. A project's own sections and types are recorded in `scripts/trim-features/project.json` (plop does it for scaffolded ones).
- `knip` is installed but deliberately **not** in `npm run check`: this starter is a superset on purpose (`createIconField` has no call sites by design), so a standing gate would fight that. It runs as the opt-in second pass of `npm run trim`.
- Commit messages are checked by the `commit-msg` hook (commitlint, rules in `commitlint.config.mjs`). See the `conventional-commits` skill.
