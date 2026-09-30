---
name: sanity
description: Sanity CMS conventions end to end. GROQ queries are defined with `defineQuery` in `src/sanity/queries.ts` and typed by `npm run sanity:typegen` into the never-hand-edited `sanity/types.ts`; pages fetch through `loadQuery<ResultType>` and render with the `.astro` media and rich-text components. The Studio (root `sanity/`) is the only place React lives and must never leak to public pages; `src/sanity/` is imported relatively to stay portable. Covers singletons, draft mode, the typegen workflow, and field grouping (related fields become one object field, never prefix-named siblings). Use when writing queries, editing the schema, rendering content, or touching draft mode.
---

# Sanity

Content flows one way: GROQ query, generated type, typed Astro renderer. The Studio is React and self-contained; public pages are pure Astro plus vanilla TS.

## Core Rules

- A projection that lands more than once in a query, or whose body contains calls, is a **custom GROQ function**, not an inlined fragment: fragments are textual, so nesting multiplies them and the API rejects a query over 300 KB. See Custom GROQ functions below.
- Never hand-edit generated files: `sanity/types.ts` and `sanity-schema.json`. Regenerate with `npm run sanity:typegen` after any schema or query change (it also runs on `precheck.types`, so `npm run check` covers it).
- Define GROQ with `defineQuery` in `src/sanity/queries.ts`. Name queries in PascalCase ending `Q` (`PageQ`, `ArticlePageQ`, `BlogPageQ`, `SitemapQ`), which is what makes typegen emit the matching `PageQResult`. Build them from the shared fragments rather than duplicating projections.
- Fetch through `loadQuery<ResultType>({ query, params, perspectiveCookie })` from `src/sanity/lib/load-query.ts`, using the generated result type as the type argument.
- Render content with the `.astro` components: `SanityMedia` for media (it dispatches to `SanityImage`, `SanityMuxVideo`, `SanityNativeVideo`, `SanityLottie`, `SanityRive` by `media.type`), `SanityRichText` for portable text. Types and the shared `resolveVideoOptions` helper live in `src/sanity/media/types.ts`.
- React only in the root `sanity/` Studio. Never import Studio modules, React, or `.tsx` into public pages or `src/sanity/` renderers.
- Import `src/sanity/` and `sanity/` modules with relative paths so the folders stay portable.
- Singleton document IDs come from `sanity/constants.ts`; never hardcode them.
- Fields that describe the same thing live inside one `object` field named for that thing, never as flat siblings joined by a name prefix. See Field grouping below.
- Draft mode is per-request and needs a verified signed session (`Astro.locals.draftSession`) plus the perspective cookie; stega only happens then, so it never reaches published HTML. A hand-set perspective cookie alone renders the published site.

## Trigger Conditions

Apply when writing or editing GROQ, adding/changing schema types or fields, rendering Sanity content, configuring the Studio, or working with draft mode, preview, or typegen.

## Execution Checklist

1. For new content needs, add a `defineQuery` export in `src/sanity/queries.ts` reusing fragments.
2. Run `npm run sanity:typegen`; import the generated `*QResult` type at the call site.
3. Fetch via `loadQuery<ResultType>`; render with the existing media/rich-text `.astro` components.
4. For schema changes, edit the right type under `sanity/schemas/**`, then `npm run sanity:typegen`, then fix any changed result types in pages.
5. Keep all React in `sanity/`; keep imports relative.
6. Run `npm run check`.

## Scope Guidance

- This skill owns queries, typegen, content fetching/rendering, the schema, and the Studio.
- Where a query is fetched inside a route (params, draft gating): `astro`.
- Studio custom inputs/actions are React; their styling follows Studio (Sanity UI) norms, not the public-page `tailwind`/`custom-elements` skills.
- The endpoints Studio features call (draft mode enable/disable, agent actions, revalidation): `server`.
- Changing a page builder section's fields or look dates its insert-menu thumbnail; the fixture behind it lives in `sections/{Name}Section/preview.ts`: `section-previews`.

## Non-Goals

- Hand-editing `sanity/types.ts` or `sanity-schema.json`.
- Importing React or Studio code into public pages.
- Aliased (non-relative) imports inside `src/sanity/` or `sanity/`.
- Hardcoding singleton document IDs.

## Done Criteria

- New queries use `defineQuery`, reuse fragments, and follow the `<Name>Q` naming.
- Types were regenerated with `npm run sanity:typegen`; pages use the generated result types.
- Content renders through the existing `.astro` components; media goes through `SanityMedia.astro`.
- No React or Studio import reached a public page; `src/sanity/` imports stay relative.
- No field name encodes a relationship a wrapper object should hold; queries project that wrapper once.

## Reference Files

- `src/sanity/queries.ts`: all GROQ and the shared fragments.
- `src/sanity/lib/load-query.ts`: the fetch helper (perspective, token, stega).
- `src/sanity/lib/draft-mode.ts`: page-level draft detection.
- `src/sanity/media/`: `SanityMedia.astro` (the dispatch), `SanityImage.astro`, `SanityMuxVideo.astro`, `SanityNativeVideo.astro`, `SanityLottie.astro`, `SanityRive.astro` plus `RiveElement.ts`, and `types.ts`.
- `src/features/sanity/media/`: the GROQ `fragment.ts` and the URL builders (`image/utils.ts` for `srcset`/dimensions/LQIP, `utils.ts` for aspect ratios).
- `src/sanity/rich-text/SanityRichText.astro` and `components/*.astro`: portable-text rendering via `astro-portabletext`.
- `sanity.config.ts`, `sanity.cli.ts`: Studio config and the typegen scan paths.
- `sanity/constants.ts`: singleton IDs and API-only doc types.
- `sanity/schemas/`, `sanity/structure.tsx`, `sanity/actions.tsx`, `sanity/templates.tsx`, `sanity/inputs/`, `sanity/utils.ts`: the React Studio. The Presentation tool's document resolution lives inline in `sanity.config.ts`.

## Detailed conventions

### Query and type flow

- Queries are `defineQuery` exports in `src/sanity/queries.ts`, composed from shared fragments that live beside their feature (`link`, `media`, `seo`, `rich-text`). Conditional projections (`type == "image" => { ... }`) produce discriminated unions in the generated types.
- `npm run sanity:typegen` runs `sanity schema extract` (writes `sanity-schema.json`) then `sanity typegen generate` (writes `sanity/types.ts`). The CLI scans `src/**` and `sanity/**` for queries (see `sanity.cli.ts`). Both outputs are generated; never edit them by hand.
- At the call site, pass the generated result type: `loadQuery<PageQResult>({ query: PageQ, params: { uri } })`.

### Fetching

- `loadQuery` wraps the Sanity client: it parses the draft perspective cookie, applies the server-only read token only when present, and enables stega only in draft mode so overlays never appear in published HTML. It returns `{ data, perspective }`.
- Route-level concerns (reading `Astro.params`, threading the cookie) live in `astro`.

### Rendering content

- Media: render `SanityMedia.astro` and let it pick the renderer; its `renderers` map is `satisfies Record<MediaType, unknown>`, so the build fails until every media kind has one. `SanityImage.astro` builds a responsive `srcset` (never upscaling) through `src/features/sanity/media/image/utils.ts`; the Mux, Lottie, and Rive renderers defer their runtimes with `lazyCustomElement` (see `lazy-hydration`).
- Rich text: `SanityRichText.astro` registers custom `.astro` overrides (block, link, list/list item, text and highlight color, underline, sup, indent, inline and block media) on `astro-portabletext`. All renderers are `.astro`, never React.

### The Studio (React)

- Root `sanity/` holds the embedded Studio: schema types under `sanity/schemas/**`, desk `structure.tsx`, document `actions.tsx` (the open-live-page, open-draft-page, open-in-presentation, and open-in-structure actions), new-document `templates.tsx`, custom `inputs/**`, and shared helpers in `utils.ts`. These are React and run only in the Studio.
- Singletons (`sanity/constants.ts`) are referenced by structure, actions, and templates as the single source of truth. `API_ONLY_DOCUMENTS` (`contactFormSubmission`) is written by endpoints, never authored; `AGENT_SCRATCH_DOCUMENTS` (`imageAltText`) exists only so schema-aware Agent Actions can type-check.

### Draft mode and preview

- The preview perspective cookie (named by `perspectiveCookieName` from `@sanity/preview-url-secret/constants`) drives draft fetches and is intentionally not `httpOnly` so the Presentation overlay can rewrite it. Because any client can set it, it only counts inside a signed `__draft_session` (see `docs/features/studio-api-auth.md`). See `astro` for the page-level gating and `server` for the enable/disable endpoints.

## Product conventions

These conventions govern the schema, Studio, and content model, on top of the rules above.

### Typegen contract

- `npm run sanity:typegen` extracts `sanity-schema.json` (repo root) and generates `sanity/types.ts`; both are generated, never hand-edited (`sanity.cli.ts` sets the output and scans `src/**` and `sanity/**` for queries).
- Import query result types from `sanity/types.ts` via the `~/sanity/types` alias in app code; inside `sanity/` and `src/sanity/` keep imports relative.

### Field factories (`sanity/schemas/fields/`)

- Build fields with the factories: `createLinkField`, `createMediaField`, `createPageBuilderField`, `createRichTextField`, `createIconField`, `createSeoField`, `createUriField`, `createAgentMarkdownField`. Field names are app-prefixed: `appLink`, `appMedia`, `appColor`, `appRichText`.
- Factories expose only explicitly supported standard props (`validation`, `hidden`, including `...requiredIf(...)` / `...visibleIf(...)` spreads from `sanity/utils.ts`); no catch-all option types. Compose caller validation with internal guards via `composeValidation`; never override caller validation.
- Factories that filter a list of options (media types, page-builder sections, rich-text blocks, icon names) use the shared `selectByName` whitelist/blacklist helper from `sanity/utils.ts`.
- Reuse the shared validation helpers in `sanity/utils.ts` (`composeValidation`, `requireTypeWhenObjectHasValue`, `isEmptyObjectValue`): typed-object validation ignores empty/stale objects but requires `type` when the object has meaningful content.
- A conditional typed object (a `createLinkField`/`createMediaField` with `hidden`) must pass that same `hidden` predicate to `requireTypeWhenObjectHasValue`. Sanity writes nested initial values as soon as the field renders, so a hidden object holds non-null residue with no `type`, and flagging it blocks saving a document whose editor never sees the field.
- `ClearableObjectInput` (`sanity/inputs/clearable-object-input.tsx`) auto-unsets the whole object when the `type` radio is cleared; do not add manual clear buttons. Avoid `components.field` passthrough or no-op wrappers; they hide inline validation markers in Studio.
- An on/off toggle inside an object (`enabled`, `show*`) decides whether the feature RENDERS, never whether the editor can see the object's other fields. Never gate sibling fields behind it with `hidden`. Editors write and review copy before switching a thing on, and a switch with nothing under it reads as broken. Make the toggle's own description say what it controls instead. The `announcement` object on `site` is the reference: `enabled` is off by default and every other field stays visible. Conditional `hidden` is still right for a different axis, where the fields are genuinely mutually exclusive (a link's `type`), because there the hidden field could never apply.

### Field grouping

- When two or more fields describe the same thing, they go inside one `object` field named for that thing. The wrapper owns the concept's name and its sub-fields drop the prefix: an action's style toggle is `action.emphasize`, never a sibling `emphasizeAction` next to `action`. `sectionSettings` in `sanity/schemas/fields/create-page-builder.tsx` is the in-repo precedent.
- The smell that triggers this: a new field whose name has to mention another field to make sense (`emphasizeAction`, `actionStyle`, `heroImageCaption`), or a run of prefix-named siblings (`asideTitle`, `asideText`, `asideLink`).
- Field factories compose inside the wrapper unchanged: `createLinkField()` keeps its `appLink` name as a sub-field. Give the wrapper `options: { collapsed: false, collapsible: true }` and booleans inside it `options: { layout: "switch" }`.
- GROQ mirrors the shape. Project the wrapper once instead of picking prefixed fields off the parent:

  ```groq
  "action": action{
    "link": appLink{${LinkFragment}},
    "emphasize": coalesce(emphasize, false)
  }
  ```

- The rule fires on the second related field, not pre-emptively: a wrapper holding one field is noise.
- Regrouping fields that already hold published content is a breaking change: the old flat values stop resolving, so plan a dataset migration or Studio re-entry and say so in the handoff.

### Page builder

- Section schemas live in `sanity/schemas/page-sections/` and are exported from `page-sections/index.ts`; keep the `// PLOP: Add Import` / `// PLOP: Add Export` anchors intact. Documents embed them via `createPageBuilderField`.
- Section components are Astro files in `src/features/page-builder/sections/` (e.g. `TextSection.astro`), registered by `_type` in `src/features/page-builder/PageSections.astro`. Each section receives `docId` and `sectionKey` props and fetches its own data with `loadQuery`. The route fetches the section list (`PageSectionsQ`, keyed by uri) and passes it to `PageSections.astro`, so it runs in parallel with the route's own document query instead of after it.
- When a section's `sectionContent` fields change, hand off to the **agent-markdown** skill so the Markdown served to AI agents stays in sync (standard factory fields serialize automatically; bespoke fields need a serializer/query branch in `src/features/agents/`).

### uri/pages model

- Page documents carry a full `uri` path (`create-uri-field.tsx`); the catch-all route `src/pages/[...uri].astro` resolves them with `uri.current == $uri`. Prefix content (e.g. the blog) uses the same contract with `uri` built as `/blog/{slug}`.
- Singleton documents have fixed IDs in `sanity/constants.ts` (`SANITY_SINGLETON_SITE_ID`, `SANITY_SINGLETON_HOMEPAGE_ID`, derived `SINGLETON_IDS`); structure, actions, and templates all read those constants. Never hardcode the IDs.

### Custom GROQ functions

A fragment is a template literal, so every `${Fragment}` is a full textual copy, and a fragment that
interpolates other fragments multiplies rather than adds. Sanity rejects a query whose text passes
300 KB, and the whole query is sent on every request, so this is worth keeping flat as blocks and
fields are added.

**The rule.** Overhead is ~30 B per declaration and ~17 B per call, so a function wins from the
second copy onward for any projection above ~60 B, and loses at one copy.

- **Leaf projection** (its body contains no calls): count copies **in the expanded query**, not call
  sites. 2+ copies, function. Exactly 1, inline.
- **Body that contains calls**: always consume it as a function, because its bundle carries the
  declarations its calls need. Inlining such a body means hand-carrying them.

The count is what misleads: the media projection is written once per block file and lands many times
once the blocks nest. Measure rather than count call sites:

```ts
PageQ.split(MediaFragment.slice(0, 55)).length - 1   // real copies
new TextEncoder().encode(PageQ).length               // total size
```

Each hoisted projection exports three things beside its body (see `src/features/sanity/link/fragment.ts`):

- `XFn` — the declaration: `` const LinkFn = `fn frag::link($value) = $value{${LinkFragment}};` ``
- `x()` — the call site: `` const link = (path: string) => `frag::link(${path})` ``
- `XFunctions` — the declaration plus every declaration it calls, so a query interpolates one thing and can never carry a call whose declaration it left behind (`RichTextFunctions`, `MediaFunctions`, `SeoFunctions`).

A query prepends the bundle once, then calls: `` defineQuery(`${RichTextFunctions} *[...]{ "text": ${richText("appRichText")} }`) ``.

**A fragment that gains a call changes its consumers.** Any query interpolating it must now prepend
that fragment's bundle, which is why an intermediate fragment exports one too. A query with a call
and no declaration is invalid GROQ, so typegen drops it rather than reporting it.

Namespace every function `frag::`. Placement rules, each a real failure found in practice:

- Conditional in a projection: a bare call merges, `_type == "linkField" => ${link("@")}`.
- Plain position beside other keys: a bare call is a parse error, spread it, `{"key": _key, ...${link("@")}}`.
- Inside `select(...)`: the right-hand side is a bare expression, so no `"key":` prefix, `type == "image" => ${image(path)}`.

**Typegen only evaluates some shapes.** A query it cannot statically evaluate is silently dropped
from `sanity/types.ts` (no error, just a missing `XQResult` and a lower query count in the typegen
output). Check the count after any change here; a drop means either an unevaluable shape or invalid
GROQ, and the two are told apart by running the query against the API.

- Works: plain string consts, template literals composed from them, and **standalone exported functions returning a string** — imported across modules in every case.
- Breaks: a **factory returning an object** whose members you then use, and **calling a method stored on an imported object**. This is why the call site is a bare exported function rather than a method.

GROQ limits, all confirmed against the API: no self-recursion (rejected with "cyclic dependency
detected"), the parameter may be referenced only once in the body, one parameter only, and the
supported forms are `$p{…}`, `$p->{…}`, `$p[]{…}`, `$p[]->{…}`. Declarations may appear in any
order, a function may call another function, and parent hops (`^.`) internal to the body work.

Deliberately left inline, as the negative case: the announcement query's single link, and
`VideoFragment` / `SeoMetadataFragment` (one copy each, leaves).

### Fragments and stega

- Ported GROQ fragments live beside their feature in `src/features/*/fragment.ts` (e.g. `src/features/sanity/link/fragment.ts`, `src/features/site/seo/fragment.ts`); export the fragment string plus its TypeScript type, and interpolate with single braces: `seoMetadata{${SeoMetadataFragment}}`.
- In draft/preview, fetched strings are stega-encoded (invisible characters powering click-to-edit). Keep stega in visible text, but wrap any Sanity string used for identity with `stegaClean` from `@sanity/client/stega` first: DOM `id`/anchor targets, `querySelector` lookups, `href`/URL or path comparisons, class/style tokens, record-matching keys, and values serialized into JSON-LD. `stegaClean` is a no-op outside preview, so it is always safe to call (see `id={stegaClean(section.settings?.hash)}` in the section components).
