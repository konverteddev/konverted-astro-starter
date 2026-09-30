---
name: code-style
description: Pure code-style conventions for this repo's TypeScript and Astro. Braced control flow with intentional blank-line spacing (code that breathes, not one-liners), `type` over `interface`, naming (identifiers, files, and the PascalCase-component-bundle vs kebab-case-module folder rule), minimal comments, import and path-alias usage, and the Biome setup. Client-behavior structure lives in `custom-elements`, styling in `tailwind`, page and component composition in `astro`. Also owns the simplicity review: a complexity-only review lens (duplication, dead code, hand-rolled stdlib, unused flexibility) with a one-line finding format. Use when editing `.ts`/`.tsx`/`.astro`, when the user asks for readability, naming, control-flow spacing, or formatting, or when they ask to simplify, review for over-engineering, find duplication, find what can be deleted, or audit for bloat.
---

# Code style

This skill covers two things: how code is written and formatted at the language level, and the simplicity review (a complexity-only review lens, in Detailed conventions). It does not cover the custom-element pattern (`custom-elements`), Tailwind/styling (`tailwind`), Astro page/component composition (`astro`), or any subsystem rules.

## Core Rules

- Braced `if`/`else` with intentional blank-line spacing. No one-line `if`. Let conditionals breathe (see If statement readability). Biome's `useBlockStatements` enforces the braces; the spacing is a convention.
- Prefer `type` over `interface`. The only `interface` exceptions are ambient declaration-merging blocks (`src/env.d.ts`).
- Names: `PascalCase` types/classes, `camelCase` functions/variables, `UPPER_SNAKE_CASE` module constants, `#name` private fields. GROQ query consts are the exception: PascalCase ending `Q` (`PageQ`), which is what typegen keys its result types off. Booleans read as predicates (`isDraftMode`, `canDownload`).
- Comments are minimal and match the surrounding density. Explain why, not what.
- Import with the `~/` alias (`~/components`, `~/layouts`, `~/features`, `~/lib`); `~/sanity/*` reaches the root Studio folder (constants, generated types). Inside either `sanity/` folder use relative paths only. Never guess a path.
- Biome owns formatting and linting (`biome.jsonc`): double quotes, semicolons, `lineWidth` 130. Run `npm run format` (`biome check --write --unsafe`). Biome sees only the frontmatter of `.astro` files; keep template markup consistent by hand.
- Reuse before writing: check `~/features/utils`, `~/lib`, `sanity/utils.ts`, and neighboring modules before accepting new helper code as "new". Duplication is the highest-value review finding.
- Simplicity review requests use the one-line finding format in Detailed conventions (tags, grep-verified claims, `net:` scoring).

## Trigger Conditions

Apply when editing `.ts`, `.tsx`, or `.astro` in this repo, or when the user asks for consistent style, readability, naming, control-flow spacing, or formatting. Apply the Simplicity review section when the user asks to simplify, review for over-engineering, find duplication, find dead code, or audit the repo for bloat.

## Execution Checklist

1. Match existing patterns in the touched files.
2. Run `npm run check` after substantive edits (Astro type check plus Biome; runs typegen first).
3. Run `npm run format` (Biome) when formatting or control-flow spacing changed.
4. Run `npm run check.biome` after editing `.ts`/`.tsx`; it reports error-level Biome diagnostics. `npm run format` auto-applies fixes.

Always use npm; this project uses no other package manager.

## Scope Guidance

- This skill owns language-level readability for `.ts`, `.tsx`, and the script portions of `.astro`.
- Client behavior (custom HTML elements, lifecycle, data hooks): hand off to `custom-elements`.
- Styling, Tailwind tokens, `<style>` policy, z-index: hand off to `tailwind`.
- Page/component composition, frontmatter logic, layouts, routing: hand off to `astro`.
- The simplicity review covers complexity only. Correctness bugs, security holes, and performance route to a normal review pass or `performance-audit`.

## Non-Goals

- Drive-by reformatting of unrelated files (especially the generated `sanity/types.ts` / `sanity-schema.json`).
- Any subsystem rule (custom elements, Tailwind, Astro routing, Sanity, server). Those live in their own skills.
- Changing the Biome configuration as part of a style edit.

## Done Criteria

- Every `if`/`else if`/`else` branch you touched is braced, and independent `if` blocks are separated by a blank line.
- New props and shapes use `type` (not `interface`, outside ambient `.d.ts`).
- Names follow the casing rules; comments are minimal and explain why.
- Imports use the `~/` alias or relative `sanity/` paths; no guessed paths.

## Reference Files

- None. This skill is self-contained under Detailed conventions.

## Detailed conventions

### If statement readability

This is the headline rule for this repo. A lot of existing code is compact (one-line `if`s, no spacing). New and edited code should breathe.

#### Core rules

- Never use one-line `if` statements.
- Always use braces for every `if`, `else if`, and `else` branch, even for a single statement.
- Keep conditional expressions readable. Extract a complex condition into a well-named boolean when it helps.
- Prefer early returns to reduce nesting.

#### Spacing rules

- Treat every braced `if`/`else` block as its own visual unit. Put blank lines before and after it when the surrounding code is a different step (an assignment, another `if`, a `return` that is not the only line of the block).
- Back-to-back independent `if` blocks (not `else if`/`else`) get one blank line between each closing `}` and the next `if`, whether the branches return early, mutate state, or call functions.
- Same chain stays contiguous: do not insert blank lines between `if`, `else if`, and `else`.
- After a braced block, add a blank line before the next statement when it starts a new concern (including the main body after one or more leading guard `if`s).
- Comment then `if`: do not add a blank line between a full-line comment (`//`, `/* ... */`) and the `if` directly below it. The `if` stays under the comment.

#### Rewrite patterns

One-liner to block:

```ts
// Avoid
if (!form) return;

// Use
if (!form) {
  return;
}
```

Let guard clauses breathe:

```ts
#onSubmit = async (event: SubmitEvent) => {
  event.preventDefault();

  const form = this.#form;

  if (!form) {
    return;
  }

  const formData = new FormData(form);

  this.#setDisabled(form, true);

  // ...submit
};
```

Keep branches in one chain visually connected:

```ts
if (result.ok) {
  form.reset();
  this.#setMessage(SUCCESS_MESSAGE, false);
} else if (typeof result.error === "string") {
  this.#setMessage(result.error, true);
} else {
  this.#setMessage(ERROR_MESSAGE, true);
}
```

Multiple independent guards, one blank line between each:

```ts
if (event.type === "pointerup" && event.button !== 0) {
  return;
}

if (!isDragging) {
  return;
}

isDragging = false;
applyPointerPosition(event);
```

#### Application checklist

1. Convert any one-line `if` to a braced block.
2. Ensure every branch in each chain uses braces.
3. Add or remove blank lines so each conditional reads as a clear visual unit.
4. Re-check surrounding code so spacing reflects logical grouping.

### TypeScript: `type` over `interface`

- Prefer `type` for object shapes, props, and contracts (including optional fields, unions, and intersections).
- Astro component props: use `type Props = { ... }`. Astro reads either an `interface Props` or a `type Props`, and some existing components still use `interface`. Write new ones with `type` and convert when you are already editing the frontmatter.
- Exception: ambient declaration-merging blocks must use `interface` (for example `ImportMetaEnv` and `HTMLElementTagNameMap` in `src/env.d.ts`). `type` cannot merge.

```ts
// Prefer
type Props = {
  endpoint: string;
};

const { endpoint } = Astro.props;
```

### Naming

- Types and classes: `PascalCase` (`ContactFormElement`, `type Props`, `MediaType`).
- Functions and variables: `camelCase` (`loadQuery`, `getImageSrcSet`).
- Module-level constants: `UPPER_SNAKE_CASE` (`HONEYPOT_FIELD_NAME`, `MIN_SUBMISSION_TIME`, `SITE_CACHE_TAG`). GROQ query consts break the rule on purpose: `PageQ`, `SitemapQ`.
- Private class fields: `#name` (`#form`, `#onSubmit`).
- Booleans read as predicates: `isDraftMode`, `isExcludedPath`, `shouldBypassCache`.

#### Files and folders

- Component files are `PascalCase.astro` / `PascalCaseElement.ts`, named after what they export. Every other module is kebab-case: `load-query.ts`, `format-date.ts`, `query.ts`, `fragment.ts`, `field-errors.ts`.
- A folder's case says what kind of thing it is:
  - **PascalCase = a component bundle.** Everything inside it exists to render one component: the entry `Name.astro` repeating the folder name, its `NameElement.ts`, sub-components, scoped assets, and helpers only that component uses. `Marquee/`, `Icon/`, `Form/`, `AnimatedText/`, `sections/ContactFormSection/`.
  - **kebab-case = a module.** The folder owns a layer, not a component: GROQ (`query.ts`, `fragment.ts`), server endpoints, state, helpers that outlive any one component. It may hold PascalCase component files and PascalCase component folders. `site-error/`, `site-footer/`, `site-header/`, `site-announcement/`, `page-builder/`, `forms/`, and every folder directly under `src/features/`.
- The tell is the data layer, not the file count: a `query.ts` or `fragment.ts` in the folder makes it kebab-case. Component-scoped helpers do not (`ContactFormSection/validate-contact-form.ts` keeps that folder PascalCase). A section folder stays PascalCase because its query lives one level up in `page-builder/queries.ts`, so the folder really is only the component.
- Renaming a component bundle into a module (a component grows a query) renames the folder, never the files inside it: `SiteHeader.astro` moves to `site-header/SiteHeader.astro`. Fix the import at each call site and any `src/env.d.ts` element path.

### Comments

The authoritative comment policy lives in the `comments` skill. Read it before adding a comment and before any comment-trimming pass. In short: default to no comment, explain why (not what), one line always, never inside `.astro` markup, and a module header of at most two lines (anything longer is a `docs/` page). The one language-level placement rule: a full-line comment sits directly above the code it explains, with no blank line between it and a following `if` (see the spacing rules).

### Imports and path aliases

- Use the aliases from `tsconfig.json`: `~/*` for anything under `src/` (`~/components/*`, `~/layouts/*`, `~/features/*`, `~/lib/*`) and `~/sanity/*` for the root Studio folder.
- Relative paths are only for same-folder siblings and for imports that stay inside a `sanity/` folder, so both stay portable. Everything else is absolute: `~/lib/utils`, never `../../lib/utils`. Biome enforces this under `src/` (`noRestrictedImports`); `scripts/` sits outside the alias and stays relative.
- Import `sanity/` and `src/sanity/` modules with relative paths, not an alias, so that folder stays portable.
- Inside an `.astro` `<script>`, import the paired element with a relative path (`import "./ContactFormElement"`).
- Never guess a path. Match an import that already exists.

### Formatting

Biome owns formatting (config in `biome.jsonc`): double quotes, semicolons, `lineWidth` 130, and Tailwind class sorting via `useSortedClasses`. Do not fight it by hand. Run `npm run format` after style changes. Biome formats only the frontmatter of `.astro` files; keep template markup consistent manually.

Braces are the one part of the If statement readability rules a linter checks: Biome's `useBlockStatements` rule flags every one-line `if`, and `npm run format` adds the braces. The blank-line breathing between blocks is a convention Biome does not check, so apply it by hand.

### Simplicity review

Review lens for unnecessary complexity. The best outcome is getting shorter. Two scopes:

- **diff** (default): the working diff or a branch.
- **repo**: the whole tree, ranked biggest cut first, ending `net: -<N> lines, -<M> deps possible.`

#### Format

One line per finding: `<file>:L<line>: <tag> <what>. <replacement>.`

Tags:

- `dup:` copy-pasted logic (the DRY hunt): the same block in two or more files, or a re-implementation of a helper that already lives in the repo. Replacement: the one extracted or existing helper. This is the highest-value tag. Check `~/features/utils`, `~/lib`, `sanity/utils.ts`, and neighboring modules before accepting new code as "new".
- `delete:` verified dead code: zero callers or setters, confirmed by grep across `src/pages/`, `src/components/`, `src/layouts/`, `src/features/`, `src/sanity/`, `sanity/`, `templates/`, `scripts/`, and `src/middleware.ts`. Never claim dead from memory.
- `stdlib:` hand-rolled thing JS or Node already ships. Name the replacement.
- `native:` code or a dependency doing what the platform or an already-installed dependency covers (CSS over JS, a native DOM or platform API over a hand-rolled listener, a custom HTML element over a framework shim, Astro built-ins, `node:` builtins over CLI libs). Name the feature.
- `shrink:` same logic, meaningfully fewer lines. Show the shorter form.
- `speculative:` unused flexibility (an option nobody passes, a config value nothing sets, a branch no caller reaches). Conservative bar, see below.

#### Speculative findings: the conservative bar

This repo is a starter template. Single-implementation seams are often the product, not bloat. Flag `speculative:` only when ALL of these hold:

1. Zero usage, verified by grep (no caller passes the option, nothing sets the flag, no template emits it).
2. Not a documented extension seam: Plop templates, `create-*` schema field factories, `sanity/config.ts`, the `SanityMedia` media-type dispatch, or anything a SKILL.md or `docs/` names as an edit point stays.
3. Recreating it later is roughly as cheap as keeping it.

When in doubt, do not flag it. An abstraction with one implementation is fine. The target is an abstraction with zero uses and no documented purpose.

#### Examples

✅ `src/features/agents/markdown-proxy-state.ts:L58: dup: fetch/cache/TTL block copy-pasted from src/features/auth/sanity-basic-auth-proxy.ts. Extract one shared helper.`

✅ `L4: native: JS class-toggle open/close for a modal. Native <dialog> element with showModal() and close().`

✅ `L52-71: delete: exported helper with zero callers (grep-verified). Nothing replaces it.`

✅ `L30-44: shrink: manual loop builds object. Object.fromEntries(entries), 1 line.`

❌ "This section component might be more complex than necessary, have you considered..." (prose instead of a finding)

❌ Flagging a `create-*` schema factory with one call site (documented extension seam).

#### Scoring and boundaries

- End with `net: -<N> lines possible.` Nothing to cut: `Lean already. Ship.`
- Scope is complexity only. Correctness bugs, security holes, and performance route to a normal review pass or `performance-audit`. Note them in one line each under "out-of-scope notes" if tripped over.
- A single smoke test or assert-based self-check is the minimum for non-trivial logic, not bloat. Never flag it for deletion.
- Lists findings. Applies nothing unless the user asks for fixes.
