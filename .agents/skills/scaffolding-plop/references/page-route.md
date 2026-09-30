# Prefix Page Route (Plop)

- **Generator**: "Prefix Page Route". Creates a prefix route `/{prefix}/{slug}` (e.g. /articles/my-post).
- **Prompts**: `routePrefix` (plural, e.g. articles); `documentType` (singular, e.g. article — Sanity schema and _type).
- **Creates**: Document schema in `sanity/schemas/documents/{{kebabCase documentType}}.tsx`; updates `sanity/schemas/index.ts` (import + export); updates `sanity/structure.tsx` (PLOP: Add Structure); page at `src/pages/{{routePrefix}}/[slug].astro`; `{{pascalCase documentType}}PageQ` in `src/sanity/queries.ts` (PLOP: Add Route Query). Runs `npm run sanity:typegen` and format.
- **Templates**: `templates/page-route/schema.tsx.hbs`, `page.astro.hbs`, `structure.tsx.hbs`, `queries.ts.hbs`. Query uses `defineQuery` with `uri.current == $uri` and `SeoMetadataFragment` interpolated as `${SeoMetadataFragment}` (single braces in template). The fragment calls `frag::image`, so the query opens with `${SeoFunctions}`; the generator adds that import to `queries.ts` when it is missing.
- **Do not** remove generated SEO fields or structure entries unless explicitly requested.
