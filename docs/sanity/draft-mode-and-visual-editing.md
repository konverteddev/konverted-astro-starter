# Draft Mode and Visual Editing

Live preview is powered by `@sanity/astro` + `@sanity/preview-url-secret`. It relies on on-demand rendering: a page reads the preview cookie per request and returns draft content when it is present.

## Endpoints

Injected at `/api/draft-mode/*` (see `astro.config.mjs`):

- Enable draft mode: `src/pages/api/draft-mode/enable.ts`. Validates the signed preview secret (`@sanity/preview-url-secret`) with `SANITY_API_VIEW_TOKEN`, sets the Presentation perspective cookie (`sanity-preview-perspective`) and the signed httpOnly `__draft_session`, and redirects to the requested page. The perspective cookie is readable and settable by any client, so on its own it proves nothing (see [Studio API auth](../features/studio-api-auth.md)).
- Disable draft mode: `src/pages/api/draft-mode/disable.ts`. Clears the cookie and redirects to `redirectTo` (defaults to `/`).

## Runtime Wiring

In `src/layouts/Web.astro`:

- `isDraftMode(Astro)` (`src/sanity/lib/draft-mode.ts`) requires a verified signed session (`Astro.locals.draftSession`, set once per request by `src/middleware.ts`) and then reads the perspective cookie
- When enabled, the layout renders:
  - `<VisualEditing />` from `@sanity/astro/visual-editing` (the click-to-edit overlays)
  - a **Disable draft mode** link pointing at `/api/draft-mode/disable`

Editing a field in the Presentation tool reloads the page to pull fresh draft content (Astro has no live re-render API).

## How Preview URLs Are Connected

`sanity.config.ts` -> `presentationTool.previewUrl.previewMode` points to the endpoints from the `sanity/config.ts` seam:

- `/api/draft-mode/enable`
- `/api/draft-mode/disable`

Custom document actions in `sanity/actions.tsx` provide:

- Open draft page (opens the enable endpoint with a fresh preview secret)
- Open live page (opens the disable endpoint with `redirectTo`)
- Open in presentation / Open in Structure

## Draft Fetch vs Published Fetch

`loadQuery` in `src/sanity/lib/load-query.ts` controls this:

- Preview cookie present -> `drafts` perspective (or the Content Release ids the cookie carries) with stega encoding, authenticated with `SANITY_API_VIEW_TOKEN` (required; `loadQuery` throws without it)
- No cookie -> `published` perspective, no stega

Pages pass the cookie down via `getDraftModeProps(Astro)` (`src/sanity/lib/draft-mode.ts`). This lets editors preview draft content while public traffic only ever sees published content.

## Basic Auth interaction

The middleware skips the Basic Auth gate for requests carrying the preview cookie (an authenticated Studio session), so editors can preview a protected site without entering credentials on every request. See [Basic Authentication](../features/basic-auth.md).
