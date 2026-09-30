---
name: comments
description: Comment minimalism. Comments are rare, one line, and explain WHY when the reason is non-obvious. No comments inside template markup at all. Module headers are two lines at most; anything longer is a docs page. No banners, no per-element narration, no "for later" notes on empty slots. Applies to `.ts`, `.tsx`, `.astro`, `.jsx`, `.vue`, `.svelte`, `.mjs` and CSS. Language-level comment policy that extends `code-style`. Use when adding, editing, or reviewing comments, when asked to trim or clean up comments, or when auditing a codebase for comment bloat.
---

# Comments

Comments are the exception, not the default. Code, names, and types carry the "what". A comment
earns its place only when it explains a "why" a reader could not infer from the code itself.

This skill is the authoritative comment policy. `code-style` references it; subsystem skills defer
to it. It is written to be portable: nothing below depends on this repo's stack.

## The budget

These are the numbers, not vibes. A codebase in good shape sits at:

- **Under 3% of source lines** are comment lines. Past 5%, the comments have become a second,
  parallel description of the codebase that has to be maintained alongside the first.
- **One line per comment**, with one exception: a module header may run to two (see below).
- **Under 100 characters**, and never past the project's line width. If the why does not fit, it is
  describing something that belongs in a doc, or is not worth saying.

Run the audit recipe at the bottom to check a repo against these.

## Core rules

1. **Default to no comment.** Prefer a clearer name or a small refactor.
2. **A comment explains WHY, never WHAT.** If it restates the next line, delete it.
3. **One line.** If a why needs two, cut it to the essential clause or delete it. The only comment
   allowed a second line is a module header. No preambles, no ASCII banners, no section dividers.
4. **Never inside template markup.** See below. This is absolute.
5. **A module header is two lines at most.** See below.
6. **Engineering register, not prose.** See below.
7. **Match the surrounding density.** Do not be the one file that suddenly grows paragraphs.
8. **No per-element narration.** One comment per `<div>`, per branch, per slot is narration.
   (Prop and field docs are a named exception, below.)
9. **No "out of scope / for later / TODO-ish" notes on empty slots.** An empty slot is
   self-explanatory. If it needs tracking, it is an issue, not markup.
10. **The same comment in three places is not a comment.** It is a pattern. Document the pattern
    once, in the skill or doc that owns it, and delete the copies. The one exception is a footgun
    guard (rule 11): it has to sit where the mistake would be made, so shorten each copy instead.
11. **Never delete** license headers, tool directives (`biome-ignore`, `eslint-disable`,
    `@ts-expect-error`, `@ts-ignore`), language-injection tags (`/* glsl */`, `/* sql */`),
    accessibility rationale, or a comment that prevents a real footgun.

## No comments in template markup

Zero comments in the template half of a component: `.astro` markup, JSX/TSX returns, `.vue`
templates, `.svelte` markup. Not scarce. None.

```astro
<!-- WRONG -->
{/* Opaque, so the grain's colour burn meets the page white and dies there. */}
{/* `bg-origin-border`: sized to the padding box, the repeating gradient wraps its far edge. */}
<div class="bg-white bg-origin-border ...">
```

Markup comments are the fastest-growing kind because every interesting class attribute invites one,
and they are the least useful because they sit furthest from the logic. They also cannot be
collapsed by an editor, so they pad the file a reader is scanning for structure.

Where the content goes instead:

| The comment was about | Put it |
| --- | --- |
| Why a value is what it is | A named constant in the module scope above the markup |
| Why a layout technique was chosen | A `docs/` page, linked from a one-line module header |
| A design-system gap | The project's `TODO(design)` convention, in the module scope |
| Nothing a reader could not re-derive | Nowhere. Delete it. |

The only thing that may appear in markup is a tool directive that must be adjacent to the node it
suppresses.

## Module headers are two lines

A file may open with at most **two lines** saying what the module is for and, when it is not
obvious, what owns it. That is the ceiling, and most files need zero.

```ts
// GOOD
// Cache tag model, shared by the pages that set tags and the webhook that invalidates them.
// Tag convention and the invalidation flow: docs/features/caching.md
```

```ts
// WRONG: a documentation page hiding at the top of a source file
// The route cache itself: what may be cached, what is bypassed, gated vs public keying,
// SWR serving and tag invalidation. Storage and credentials are injected so the policy runs
// (and is tested) identically on a long-lived Node server and on serverless. The deployed
// wiring is ./provider.ts; the design rationale lives there.
// ...six more lines
```

If the module genuinely needs an essay, **the essay is a docs page** and the header is a one-line
pointer to it. A long header is documentation nobody can find, that no docs review will ever see,
and that goes stale silently. Promoting it is the fix, not deleting it.

This is the single biggest source of comment bloat in a codebase that already has good comment
hygiene elsewhere. Check it first.

## Engineering register, not prose

Write the fact. Do not narrate it.

```ts
// WRONG: 140 characters of prose for a 40-character fact
// A label reads as every denomination at once until it settles into the one the page is written in.
const CIPHER = "$€£¥₹"

// RIGHT
// Only marks the mono face draws itself; a fallback glyph changes the advance mid-run.
const CIPHER = "$€£¥₹"
```

```ts
// WRONG
// The lag is the whole effect: instant tracking reads as being stuck to the cursor, where
// trailing behind reads as attraction.

// RIGHT
// Trails on purpose: instant tracking reads as stuck rather than attracted.
```

Tells that a comment has drifted into prose: it has a subject and a narrative arc, it uses "reads
as" / "so that the reader" / "which is what lets", it explains the aesthetic intent of a design
decision rather than the constraint behind a code decision. Aesthetic intent belongs in the design
docs; the code comment carries only what a maintainer needs in order not to break it.

## Prop and field docs (the named exception)

A JSDoc line on a **prop, option, or public field whose meaning is not in its name and type** is
kept. It surfaces in editor tooltips, which is a real payoff a plain comment does not have.

```ts
type Props = {
  /** `false` skips viewport gating; `margin` overrides the observer rootMargin. */
  viewport?: false | { margin?: string }
  class?: string          // no doc: name and type say everything
  variant?: "a" | "b"     // no doc: the union is the documentation
}
```

The test: **would a caller guess wrong without it?** Roughly one prop in five qualifies. If every
prop in a type carries a doc line, that is per-field narration and most of them go.

Same rule for a constant: a doc line that decodes a magic value (`// Half the track, so the second
copy lands where the first started`) is kept; one that restates the identifier is not.

A `@example` tag counts as tooling too, and may take a second line, when the thing being documented
is a string format prose cannot pin down (`responsiveSizes('100vw md:50vw')`). One example, no prose
around it.

## Keep test (a comment is justified when)

- It records **why a non-obvious choice** was made: a deliberate deviation, a workaround, an
  ordering constraint between files.
- It decodes a **magic value**.
- It records an **external constraint** a reader cannot find in this codebase: a third-party API's
  undocumented shape, a platform limit, a browser bug, a codegen tool's parser limitation.
- It is a **required directive**: `biome-ignore`, `eslint-disable`, `@ts-expect-error`, a license
  header, a codegen anchor a generator writes into (`// PLOP: Add Import`), or a language-injection
  tag an editor highlights a template literal by (`/* glsl */`, `/* sql */`).
- It flags a **known gap** in the project's tracking convention (`TODO(design)`, `TODO(TICKET-123)`).

## Smell test (delete if any are true)

- It restates the code on the next line.
- It narrates structure a reader can see.
- It is a banner, a divider, or a paragraph explaining the file in prose.
- It wraps onto a second line.
- It sits inside template markup.
- It documents an empty slot or placeholder as "for later".
- The same sentence appears in another file.
- It explains how something looks or feels rather than what would break.
- Removing it loses nothing a competent reader could not re-derive in seconds.

## Trigger conditions

Apply when adding or editing comments in any source or style file, when the user asks to trim,
clean, or remove comments, during any readability pass, and before opening a PR that adds comments.

## Audit recipe

To check a repo (or a diff) against the budget. Requires Node.

1. Extract every comment with its file, line, and whether it spans multiple lines. A regex over
   `//` and `/*` is not enough: it hits URLs and regex literals. Walk the source with a small
   state machine that tracks string and template-literal state, and classify each comment as
   `line`, `block`, or `markup` (`{/* */}` and its equivalents).

   Three traps that will make the report lie to you, all learned the hard way:

   - **Consecutive `//` lines are one comment, not N.** A naive extractor emits each line
     separately, so every multi-line `//` comment reads as a run of compliant one-liners and the
     multi-line count comes out at half the truth. Group adjacent `//` lines before counting.
   - **A blank `//` line does not end a header.** Multi-paragraph headers separated by a bare `//`
     look like two short comments. Treat a bare `//` as a continuation.
   - **A `//` directly inside a JSX `return (` or `=> (` is markup too.** It never looks like
     `{/* */}`, so a count that only matches braces misses it. Directives there (`biome-ignore`,
     `@ts-expect-error`) stay put.
2. Report, and compare against the budget:
   - total comment lines / total source lines (target: under 3%)
   - count of multi-line comments (target: 0)
   - count of markup comments (target: 0)
   - per-file module-header line count (target: at most 2)
   - comments appearing verbatim in 2+ files (target: 0)
   - average comment length (target: under 100 characters)
3. Rank files by `markup * 3 + multiLine * 2 + headerLines` and cut from the top.

When rewriting a comment that sits inside a template literal (a GROQ query, an inline SQL string),
do not put backticks in the replacement: it terminates the literal and the file stops parsing. Run
the linter after each batch rather than at the end, so a break is attributable to one batch.

Cut in this order, because it is roughly the order of effort-to-payoff: markup comments, then
module headers, then multi-line comments, then duplicates. Leave everything that passes the Keep
Test alone.

## Out of scope

- Generated files (codegen output, `*.d.ts` emitted by a tool, lockfiles): never hand-edit.
- Third-party code vendored into the repo.
- Markdown, including docs. This skill governs source comments only; prose in `docs/` is supposed
  to be prose.

## Done criteria

- Every comment left passes the Keep Test; everything matching the Smell Test is gone.
- Zero comments inside template markup.
- Zero multi-line comments.
- No module header over two lines; anything longer was promoted to a docs page, not deleted.
- No new banners, per-field narration, or empty-slot notes were introduced.
