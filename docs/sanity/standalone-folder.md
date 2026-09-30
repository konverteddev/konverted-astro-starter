# Standalone Sanity folder

The `sanity/` folder is self-contained: every import inside it is either relative or an external package, so it can be copied into another project and wired up with little change. It carries the schema, Studio structure, document actions, templates, custom inputs, and field factories, and it does not assume Astro. This page is the guide for reusing it elsewhere.

## What the host provides

The folder leaves four things to the project that hosts it:

- **Runtime config** (`config.ts`): site URL, Sanity API version, public Studio base path, and the host route paths the Studio calls.
- **API endpoints**: routes for draft mode, the SEO screenshot, and the AI generate buttons, if you keep those features. In this repo they are Astro endpoints under `src/pages/api/`.
- **An icon component**: injected into `createIconField`, because the icon set belongs to the host app.
- **The Studio config** (`sanity.config.ts`): you assemble the folder's exports into `defineConfig`.

## Dependencies

The folder imports these packages directly:

- `sanity`, `@sanity/ui`, `@sanity/icons`, `@sanity/preview-url-secret`
- `react`
- `change-case`

Some fields render through Studio plugins that you register in your own config: the media library (`sanity-plugin-media`), Mux video (`sanity-plugin-mux-input`), and optionally Vision (`@sanity/vision`). Install those only for the features you keep.

## Integration steps

1. **Copy** the `sanity/` folder into your project. It can live anywhere; no path alias is required.
2. **Install** the dependencies above.
3. **Provide the env, or edit `config.ts`.** This is the single place the folder reads runtime values, and it usually needs no editing: each setting is looked up across the spellings hosts commonly use (`PUBLIC_*`, `NEXT_PUBLIC_*`, `SANITY_STUDIO_*`, and the bare name), through both `import.meta.env` and `process.env`, so the Sanity CLI resolves it too when it evaluates the module in plain Node for typegen or schema extract. Set the project id, dataset and site URL under any of those spellings and the folder starts. Add a candidate to `config.ts` only if your host uses a spelling none of them cover.

   Two optional settings shape the Studio rather than connect it: `*_SANITY_STUDIO_BASE_PATH` (the public path the Studio is served at, default `/studio`) and `*_SANITY_STUDIO_MOUNT_PATH` (a second, internal route a host may also mount it on, so the folder can keep page documents off it). The same file holds `endpoints` (draft mode, screenshot, AI generation routes) that you point at your own routes.

   Candidates are referenced literally rather than looked up by a computed key, because bundlers expose these values by replacing the exact expression at build and never hand the browser a `process.env` to enumerate. Keep that shape when adding one.


4. **Assemble the Studio config.** In your `sanity.config.ts`, wire the folder's exports into `defineConfig`:
   - set `schema.types` to `schemaTypes` from `sanity/schemas`
   - set `schema.templates` to `createDocumentTemplates` from `sanity/templates`
   - set `document.actions` to `createDocumentActions` from `sanity/actions`
   - pass `buildStructure` from `sanity/structure` to `structureTool({ structure })`

   The root `sanity.config.ts` in this repo is a complete working example.

5. **Implement the endpoints** referenced in `config.ts` if you keep preview/draft mode (`draftModeEnable`, `draftModeDisable`), the SEO screenshot input (`seoScreenshot`), or the AI generate buttons (`generateLlmsTxt`, `generatePageMarkdown`).
6. **Inject your icons** wherever you call `createIconField`: pass your icon component as `iconComponent` and the available names as `iconNames`.
7. **Generate types.** The folder includes the generated `sanity/types.ts` (used by `create-rich-text`). Regenerate it with `npm run sanity:typegen` after you change the schema.

## Conventions

Imports between `sanity/` modules are relative (`./`, `../`), never an alias, so the folder needs no path-alias setup and can sit anywhere in your tree. The only thing you normally touch when adopting it is the `createIconField` call sites; `config.ts` reads the env your host already sets.

---

**Maintainers (in this repo):** keeping the folder portable means it must not import via the `~/` alias; the same rule is stated in the `sanity` skill and `AGENTS.md`. To check by hand, run `rg -n "from '~/" sanity/` from the repo root and expect zero matches. Note the reverse direction is fine and expected: app code under `src/` imports from `sanity/` (constants, types), never the other way around.
