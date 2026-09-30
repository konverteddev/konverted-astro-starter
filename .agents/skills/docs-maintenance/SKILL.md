---
name: docs-maintenance
description: Keep project documentation accurate when code behavior, contracts, setup steps, or workflows change. Use when editing features, Sanity setup, routes, scripts, environment variables, or developer workflows that can invalidate docs.
---

# Docs Maintenance

## Core Rules

- Treat docs as part of the deliverable. If behavior changes, docs must change in the same task unless the user explicitly says not to.
- Update only relevant docs. Prefer surgical edits over broad rewrites.
- Source of truth is current code. If docs and code differ, align docs to code.
- Keep root `README.md` concise; put implementation details in `docs/`.
- `GETTING-STARTED.md` (repo root) is the guided onboarding walkthrough, from a fresh clone to a first rendered section. Keep it in sync with the real first-run path (required accounts, commands, the setup wizard, seed import, `npm run plop`, dev and Studio URLs). It links to `docs/` rather than restating them: put new detail in the linked doc and keep `GETTING-STARTED.md` to the steps.
- If no doc exists for a new capability, create one in the appropriate area:
  - `docs/features/` for runtime features
  - `docs/sanity/` for CMS/schema/studio/query/revalidation concerns
- When adding a new doc page, add links in `docs/README.md` (and root `README.md` when appropriate).

## Trigger Conditions

Apply this skill when changes include any of the following:

- Feature behavior changes (`src/pages/`, `src/features/`, API routes, `src/middleware.ts`)
- Sanity schema/query/studio/revalidation changes (`sanity/`, `sanity.config.ts`, `src/pages/api/draft-mode/`, `src/pages/api/revalidate.ts`)
- Environment variable changes (`src/lib/env.ts`, setup changes in local/prod)
- Scaffolding or workflow changes (`plopfile.mjs`, `templates/`, scripts, hooks, CI-related workflows)
- New modules or folders that affect onboarding or maintenance
- First-run / onboarding path changes (setup or seed scripts, required env, `package.json` scripts, `.nvmrc` or `engines`, Studio or dev URLs): keep `GETTING-STARTED.md` in sync

## Execution Checklist

1. Identify impacted docs before editing code.
2. After code changes, verify docs still match real behavior.
3. Update existing docs first; create new doc files only when needed.
4. Keep task-oriented wording (what, when, where, pitfalls).
5. Update navigation links in `docs/README.md`.
6. If setup/entrypoint changed, update root `README.md` docs links.
7. If the first-run path changed (setup wizard, seed, env, scaffolding, required commands, Node version, Studio/dev URLs), update `GETTING-STARTED.md` to match, keeping it a guided path that links to `docs/`.
8. In final response, include a short "Docs updated" list with paths.

## Scope Guidance

Use this mapping as a default when deciding which docs to touch. Create or extend a doc only when behavior, env contracts, or contributor workflows change.

### Onboarding entry (`GETTING-STARTED.md`)

`GETTING-STARTED.md` is the one guided path from a fresh clone to a first rendered section. When any of these change, update it together with the linked detail doc, but keep it to the steps and let the doc hold the detail:

- `scripts/sanity-project-setup/**` (what the wizard provisions, its prompts or prerequisites) -> also `docs/sanity/project-setup.md`
- `scripts/sanity-dataset/import.ts` or `seed/**` (the seed import command or flow) -> also `docs/sanity/seed-dataset.md`
- `src/lib/env.ts` or `.env.example` (required vars, the manual `.env` fallback) -> also the Sanity or feature doc for those vars
- `plopfile.mjs` or `templates/**` (the first-section walkthrough: generator name, generated file paths, what renders) -> also `docs/features/code-generation.md`
- `package.json` scripts, `.nvmrc`, or `engines` (the exact commands, package manager, and Node version quoted in the guide)
- `PUBLIC_SANITY_STUDIO_BASE_PATH` or `astro.config.mjs` Studio rewrites (the dev and Studio URLs) -> also `docs/sanity/studio-and-structure.md#public-url-and-reserved-paths`
- `src/pages/[...uri].astro` empty-state behavior (the "Not Found" troubleshooting entry)

### App shell and config

- `src/middleware.ts` or auth flow -> `docs/features/basic-auth.md`
- `astro.config.mjs` redirects or Studio rewrites -> `docs/features/redirects.md` and/or `docs/sanity/studio-and-structure.md#public-url-and-reserved-paths`
- Studio embed config (`astro.config.mjs` sanity integration) or `PUBLIC_SANITY_STUDIO_BASE_PATH` / `src/middleware.ts` Studio handling -> `docs/sanity/studio-and-structure.md#public-url-and-reserved-paths`
- `plopfile.mjs` or `templates/**` -> `docs/features/code-generation.md`
- `src/lib/env.ts` -> update whichever feature or Sanity doc documents the affected variables (often `docs/sanity/project-setup.md` for Sanity env)

### `src/features/` (runtime)

- `src/lib/transitions/**` (route cross-fade, link timing, the `data-vt-loading` cursor) -> `docs/features/view-transitions.md`; intro-animation changes (`src/components/AnimatedText/`) affect `docs/features/animated-content.md` too
- `src/features/rich-text/**` or `src/components/AnimatedText/**` -> `docs/features/animated-content.md`
- `src/sanity/lib/draft-mode.ts` or `src/pages/api/draft-mode/**` -> `docs/sanity/draft-mode-and-visual-editing.md`; preview behavior for rich text or line animations may also need `docs/features/animated-content.md`
- `src/features/spam-prevention/**` -> `docs/features/spam-prevention.md`
- `src/features/page-builder/sections/ContactFormSection*` -> `docs/features/contact-form-notifications.md` and `docs/features/spam-prevention.md` when submission or anti-spam behavior changes
- `src/features/page-builder/sections/**` (other sections) -> update an existing `docs/features/<topic>.md` when that flow is documented; otherwise align `docs/sanity/*` if the change is schema or GROQ-only
- `src/features/sanity/**` (client, link, media, fragments) -> `docs/sanity/*` (often `fetching-groq-and-types.md` for client and queries; schema or portable-text media with `schema-and-content-model.md`)
- `src/features/site/**` (header, footer, SEO fragments or site singleton queries) -> `docs/sanity/schema-and-content-model.md` or `fetching-groq-and-types.md` when site shell content or GROQ changes
- `src/features/umami/**` -> `docs/features/umami-tracking.md`

Smaller infra under `src/features/` (for example Lenis, Mux, DOM hooks, global style) has no dedicated `docs/features/*` page unless you add one; update `README.md` / `AGENTS.md` or an existing feature doc if the change affects onboarding or visible behavior.

### Root `sanity/` and Studio

- `sanity/**`, `sanity.config.ts`, `sanity.cli.ts` -> `docs/sanity/*` (if Studio URL, rewrites, or mount path change, also `docs/sanity/studio-and-structure.md#public-url-and-reserved-paths` and `src/lib/env.ts` / `.env.example`)
- Draft or live preview wiring (`src/pages/api/draft-mode` or related) -> `docs/sanity/draft-mode-and-visual-editing.md`
- Revalidation endpoint or tag strategy -> `docs/sanity/revalidation-and-caching.md`

### Contributor tooling

- `lefthook.yml`, `.lefthookrc`, or Git hook behavior -> nothing in `docs/` covers hooks today, so `lefthook.yml` is its own documentation. Add a note to `README.md` only when the change affects what a contributor has to do (a new required tool, a hook that can block a commit).
- `.agents/skills/**` or the documented skills list in-repo -> `docs/features/agent-skills.md`

## Non-Goals

- Rewriting all docs for small internal refactors that do not change behavior
- Adding marketing copy unrelated to implementation or contributor onboarding

## Done Criteria

- Relevant docs reflect current behavior and file paths
- New docs are linked from `docs/README.md`
- Root `README.md` remains concise and points to detailed docs
- `GETTING-STARTED.md` reflects the current first-run commands and flow, and links (not duplicates) the detailed docs
- Final handoff includes explicit doc files touched

## Reference Files

- None — in-repo doc targets and path mappings live under Scope Guidance.
