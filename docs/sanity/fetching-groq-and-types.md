# Fetching, GROQ, and Types

## Sanity Client Policy

Use the shared pieces:

- `src/sanity/lib/client.ts`: the ONLY module that imports `sanity:client` (the base client from the `@sanity/astro` integration, configured in `astro.config.mjs`: project, dataset, `useCdn: false`, view token). It re-exports `sanityClient` (re-enabling `useCdn` in development only) and derives `sanityEditClient` (edit token, for write endpoints). A Biome `noRestrictedImports` rule errors on `sanity:client` imports anywhere else.
- `loadQuery` (`src/sanity/lib/load-query.ts`): the preferred fetching helper for page content

Do not create additional clients in app code when `loadQuery` or `sanityEditClient` is enough. The only other exception is the middleware state modules (raw HTTP to the live API; see [Basic Auth](../features/basic-auth.md)).

## `loadQuery` Behavior

`loadQuery` accepts:

- `query`
- `params`
- `perspectiveCookie` (pass `...getDraftModeProps(Astro)` from pages)

Default behavior:

- No cookie -> `perspective: "published"`, no stega
- Cookie present (Presentation tool preview, SSR only) -> the cookie's perspective (`drafts` or Content Release ids) with stega encoding, authenticated with `SANITY_API_VIEW_TOKEN` (required in that path)

See [Draft Mode and Visual Editing](./draft-mode-and-visual-editing.md).

## GROQ Query Conventions

- Use `defineQuery` from `groq` for typed queries
- Keep projections minimal and aligned to UI usage
- Reuse fragments when fields are shared

Where queries live:

- Route queries (`PageQ`, `ArticlePageQ`, uri lists, sitemap): `src/sanity/queries.ts`
- Page-builder section queries: `src/features/page-builder/queries.ts`
- Feature queries: `src/features/<feature>/query.ts` (for example `src/features/agents/query.ts`, `src/features/site/query.ts`)

## Fragments

Fragment files include:

- `src/features/site/seo/fragment.ts` (`SeoMetadataFragment`, `FaviconFragment`; both call `frag::image`, so a query using either prepends `SeoFunctions`)
- `src/features/sanity/link/fragment.ts` (`LinkFragment`, plus `LinkFn` and `link()`)
- `src/features/sanity/media/fragment.ts` (`ImageFragment`, `VideoFragment`, `MediaFragment`, plus `ImageFn` / `image()`, `MediaFn` / `media()` and the `MediaFunctions` bundle)
- `src/features/rich-text/fragment.ts` (`RichTextFn` / `richText()` and the `RichTextFunctions` bundle; block fragments under `src/features/rich-text/blocks/`)

Interpolate a leaf fragment string inside a query with standard template interpolation (`${FragmentName}`). Never retype a projection a fragment already covers, not even a trimmed one: a copy drifts the moment the fragment changes. Change or add the fragment instead.

## Custom GROQ functions

A fragment is a template literal, so every interpolation is a full textual copy, and a fragment that interpolates other fragments multiplies rather than adds: the media projection would land in every rich text query once per block that carries media. Projections that repeat, or whose body calls another projection, are declared as [custom GROQ functions](https://www.sanity.io/docs/content-lake/custom-groq-functions) (`fn frag::richText($value) = $value[]{...};`) so each lands in the query text once.

Each hoisted projection exports three things beside its body: the declaration (`RichTextFn`), the call site (`richText(path)`), and a bundle carrying every declaration the body calls (`RichTextFunctions`, `MediaFunctions`, `SeoFunctions`). A query prepends one bundle at its head, then calls:

```ts
const TextSectionQ = defineQuery(`${RichTextFunctions}
*[_id == $docId][0]{ "text": ${richText("appRichText")} }`);
```

Rules the API enforces, all confirmed against it: declarations open the query and end with `;`; one parameter, referenced once in the body, in the forms `$p{...}`, `$p->{...}`, `$p[]{...}`, `$p[]->{...}`; no recursion and no parent scope, but a function may call another function. Placement: in a conditional a bare call merges (`_type == "linkField" => ${link("@")}`); beside other keys it needs a key or a spread (`"cta": ${link("appLink")}`, `links[]{"key": _key, ...${link("@")}}`). Typegen (`npm run typegen`) types the calls but silently drops a query it cannot evaluate, so compare the query count it prints before and after a change. The decision rule for when a projection earns a function is in the `sanity` skill.

## Generated Types

- Generated file: `sanity/types.ts`
- CLI config: `sanity.cli.ts`
- Script: `npm run sanity:typegen`

Important:

- Never edit `sanity/types.ts` manually
- Run `npm run sanity:typegen` after schema or GROQ contract changes (`npm run check` runs it automatically first, via `precheck.types`)
- Import generated result types (for example `PageQResult`, `LlmsTxtServeQueryResult`)

## Freshness

There is no data cache around `loadQuery`: with `useCdn: false` in production, every query it runs reads the live Sanity API, so any render is built from fresh content.

What is cached is the rendered response. Routes set cache tags (`src/lib/cache.ts`) and the `/api/revalidate` webhook invalidates them on publish, so a published change refreshes the affected pages rather than waiting on a TTL. See [Revalidation and Caching](./revalidation-and-caching.md).
