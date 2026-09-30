# Contributor Workflow

This is the recommended workflow for Sanity-related changes in this repository.

## 1) Decide the Change Scope

- Schema/content model change -> update files under `sanity/schemas/`
- Studio behavior change -> update `sanity.config.ts`, `sanity/structure.tsx`, `sanity/actions.tsx`, or `sanity/templates.tsx`
- Data contract/query change -> update GROQ where consumed (`src/sanity/queries.ts`, `src/features/page-builder/queries.ts`) and any shared fragments

## 2) Follow Existing Patterns

- Reuse field factories (`createLinkField`, `createMediaField`, `createRichTextField`, `createPageBuilderField`)
- Keep schema registration centralized in `sanity/schemas/index.ts`
- Keep singleton and API-only behavior aligned with `sanity/constants.ts`
- Prefer `loadQuery` from `src/sanity/lib/load-query.ts` over ad-hoc clients

## 3) Keep Query and UI Contracts Aligned

- Add only the fields needed by the consuming UI
- Keep fragment usage consistent (`src/features/sanity/link/fragment.ts`, `src/features/sanity/media/fragment.ts`, `src/features/site/seo/fragment.ts`, `src/features/rich-text/fragment.ts`)

## 4) Regenerate and Validate Types

After schema or GROQ changes:

```bash
npm run sanity:typegen
```

And run project checks (`check.types` runs typegen first via `precheck.types`):

```bash
npm run check
npm run check.biome
```

## 5) Verify Runtime Paths

At minimum verify (in local dev):

- The public Studio path from `PUBLIC_SANITY_STUDIO_BASE_PATH` loads and edits content correctly (default `/studio`; see [Studio Config and Structure](./studio-and-structure.md))
- The target frontend route renders expected content
- Draft mode preview works for changed documents (Presentation tool)
- `npm run build` still succeeds if your change touches routes or queries
- If you use **HTTP Basic Auth**, confirm `BASIC_AUTH_*` env vars and `src/middleware.ts` behavior match [Basic Authentication](../features/basic-auth.md) (site-wide vs per-URL toggles)

## Notes

- Do not edit `sanity/types.ts` manually
- For new sections/blocks/routes, prefer `npm run plop` first, then refine (see [Code Generation](../features/code-generation.md))
