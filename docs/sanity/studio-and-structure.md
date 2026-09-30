# Studio Config and Structure

## Public URL and reserved paths

- **Source of truth:** `PUBLIC_SANITY_STUDIO_BASE_PATH` in the environment (default `/studio`). Both `astro.config.mjs` (the `@sanity/astro` integration's `studioBasePath`) and `sanity.config.ts` (`basePath`, via the `sanity/config.ts` seam) read it, so the two never drift.
- **How the route exists:** the Studio is **embedded by `@sanity/astro`**. Passing `studioBasePath` to the integration injects a server-rendered catch-all route at that path which serves the Studio bundle. There are no rewrites and no internal mount segment; the public path is the only path. The integration uses browser routing (`studioRouterHistory: 'browser'`), so nested Studio routes (structure, tools, presentation) are real URLs under the base path.
- **Conflict with a site page:** the Studio owns every path under its base. You cannot put a page served by `[...uri]` at the same path. If a real marketing page must live at `/studio`, set `PUBLIC_SANITY_STUDIO_BASE_PATH` to a different path (e.g. `/admin`) in every environment.
- **URI validation:** the slug/URI field (`create-uri-field`) reserves the public Studio path (from `sanityConfig.studioBasePath`), so editors cannot create a page that collides with it.

## Studio Entrypoints

- Studio route: injected by the `@sanity/astro` integration in `astro.config.mjs` (no file under `src/pages/`)
- Studio config: `sanity.config.ts` (assembles the portable `sanity/` folder's exports)
- Runtime config seam: `sanity/config.ts` (env reads + endpoint paths; see [Standalone Sanity folder](./standalone-folder.md))
- CLI config: `sanity.cli.ts`

The embedded Studio uses the same config as typegen and the CLI, so local Studio behavior mirrors production config.

## Studio Plugins and Configuration

Defined in `sanity.config.ts`:

- `structureTool` with custom structure from `buildStructure`
- `media` plugin with `maximumUploadSize: 10000000` (10MB)
- `muxInput` plugin for video ingestion
- `presentationTool` for preview/presentation workflows
- `visionTool` for GROQ inspection (dev only)

Additional form behavior:

- Image fields use `mediaAssetSource`
- File fields explicitly exclude `mediaAssetSource`

## Content Structure

Custom structure is built in `sanity/structure.tsx`.

Main groups:

- Homepage singleton (`page` schema with fixed ID from `SINGLETON_IDS.homepage`)
- Pages list (excludes singleton IDs)
- Blog folder: the **Index** singleton (`blog` schema, `SINGLETON_IDS.blog`, the `/blog` page), then Articles and Article Categories
- Form submissions grouped from `API_ONLY_DOCUMENTS`
- Site singleton (`SINGLETON_IDS.site`): the copy that renders on every page
- Settings singleton (`SINGLETON_IDS.siteSettings`, schema type `siteSettings`): site-wide configuration (redirects, Basic Auth, favicon, agent surfaces, notification emails)

## Singletons

Singleton IDs and routes are centralized in `sanity/constants.ts`:

- `SINGLETON_IDS`
- `SINGLETON_ROUTES`
- `TEMPLATE_IDS`

Why this matters:

- Structure list, actions, and templates all derive behavior from the same constants
- Keeping IDs here avoids drift across Studio features

## Document Actions and Templates

- Custom actions: `sanity/actions.tsx`
- Custom templates: `sanity/templates.tsx`

Current behavior:

- Singletons are restricted to `publish`, `discardChanges`, `restore`
- API-only document types are restricted to `delete`, `discardChanges`
- Page documents expose quick actions:
  - Open live page (draft mode disabled)
  - Open draft page (draft mode enabled)
  - Open in Presentation
  - Open in Structure (from Presentation mode)

## Presentation Tool Mapping

`presentationTool` in `sanity.config.ts` maps routes to documents:

- `/` maps to the homepage singleton
- `/:uri` maps to documents where `uri.current` equals the current path

Preview endpoints (from `sanity/config.ts`):

- Enable draft mode: `/api/draft-mode/enable`
- Disable draft mode: `/api/draft-mode/disable`
