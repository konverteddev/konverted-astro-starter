# Code Generation (Plop)

This starter uses [Plop](https://plopjs.com/) to scaffold page builder sections, prefix page routes, and rich text blocks with consistent structure.

## Usage

Run:

```bash
npm run plop
```

Then choose one of the available generators and provide the requested inputs. The generators and templates live in `plopfile.mjs` and `templates/`.

## What Gets Generated

### Page Builder Section

- Schema file in `sanity/schemas/page-sections/`
- Component file at `src/features/page-builder/sections/{PascalName}.astro`
- Section query added to `src/features/page-builder/queries.ts`
- Automatic registration in `src/features/page-builder/PageSections.astro` and the schema index
- Runs `npm run sanity:typegen` and Biome format via `plopfile.mjs`

### Prefix Page Route

- Schema file in `sanity/schemas/documents/`
- Schema registration in `sanity/schemas/index.ts`
- Studio structure entry in `sanity/structure.tsx`
- Route file at `src/pages/{prefix}/[slug].astro`
- Route query added to `src/sanity/queries.ts`
- Runs `npm run sanity:typegen` and Biome format via `plopfile.mjs`

This generator scaffolds routes like `/{prefix}/{slug}` (for example `/articles/my-post`) and wires a matching Sanity document type.

### Rich Text Block

- Schema file in `sanity/schemas/fields/create-rich-text/blocks/`
- Component file at `src/sanity/rich-text/components/{PascalName}.astro`
- GROQ fragment at `src/features/rich-text/blocks/{kebab-name}/fragment.ts`
- Automatic registration in `SanityRichText.astro`, `src/features/rich-text/fragment.ts`, and the schema block index
- Runs `npm run sanity:typegen` and Biome format via `plopfile.mjs`

## Why Use It

- Consistent patterns across the codebase
- Less boilerplate work
- Fewer manual registration mistakes
