# Trim features

`npm run trim` removes a feature from this starter: its files, its registry entries, its docs, its
dependencies, and, when you ask for it, its content in Sanity.

The starter is a superset on purpose, so every project that starts from it inherits a blog, legal
pages, a contact form, a form layer and five page-builder sections whether or not the client wants them. Removing
one by hand means thirty-odd files across routes, schemas, registries, GROQ strings, sitemap tags and
docs, and it never includes the dataset. This does all of it deterministically, or refuses to start.

It **only removes**. Nothing is added back and nothing is rewired: a feature whose removal would mean
rewriting a route rather than unwiring a registry pulls in the feature it is welded to instead.

Undo is `git checkout .`, which is why a dirty working tree stops the run.

## Usage

`npm run trim` on its own is the guided run: it checks for a newer trim, shows the overview, offers
to record what is unrecorded, asks whether to remove features or delete content an earlier trim left
behind, and after a removal offers the content (later by default). The flags are for scripts.

```bash
npm run trim -- --status                           # what this repo has of the starter, and uses
npm run trim -- --reconcile                        # record what the tree cannot say (once per project)
npm run trim:update                                # take the starter's current trim, keep project.json

npm run trim                                       # interactive
npm run trim -- --dry-run --feature blog           # print the plan, write nothing
npm run trim -- --feature blog                     # skip the picker
npm run trim -- --feature blog --dataset           # also purge the dataset
npm run trim -- --feature blog --dataset trim-test --yes

npm run trim -- --dataset-only --dry-run           # what content is stranded?
npm run trim -- --dataset-only                     # purge it, nothing else
```

| Flag | Meaning |
| --- | --- |
| `--feature <id...>` | Feature ids to remove; skips the picker. Required with `--yes` or `--dry-run` |
| `--dataset [name]` | Also purge the dataset. Optionally names the dataset to read and purge |
| `--dataset-only` | Purge only, against a tree an earlier run already trimmed. Implies `--dataset` |
| `--no-dataset-check` | Skip the usage report and choose without it |
| `--no-knip` | Skip the sweep for what the manifest did not know about |
| `--allow-dirty` | Run against an uncommitted tree (undo stops being `git checkout .`) |
| `--partial` | Apply the edits that still resolve; report the rest as manual follow-up |
| `--status` | Print every starter feature's state, content per dataset, importers and drift. Writes nothing |
| `--reconcile` | Record the cut date, adopted features and the project's own sections and types in `project.json` |
| `--cut-from <date>` | With `--reconcile`, the cut date (`YYYY-MM-DD`); required to reconcile the starter's own clone non-interactively |
| `--adopt <id...>` | With `--reconcile`, starter features this project took over |
| `--dry-run` | Print the plan and exit |
| `-y`, `--yes` | Answer every prompt |

## The flow

1. **Preflight.** A dirty tree aborts, because `git checkout .` beats any backup scheme. Then the
   landmarks: the shared registries this manifest is written around, which no feature owns and no
   trim removes. One of them missing means the manifest is describing a different repository, so the
   run stops rather than reporting every file it cannot find as "already gone".
2. **Survey**, printed *before* the question: every starter feature's state, its content in every
   dataset (production first), the project code that imports it, and the edits it has drifted from.
3. **Pick** from the features still here. Coupled ones auto-select with a printed note; a coupled one
   that is already gone is skipped. Asking for one that is trimmed, removed, adopted or never here
   fails with the reason. A feature only *partly* here is spelled out: which files are left and which
   are absent, because the files still standing are the ones about to be deleted.
4. **Plan**: files to delete, edits by file, dependencies, env vars, docs, and the purge plan. Edits
   the project changed away, and project code importing the selection, are listed as work for a
   human, and need `--partial` under `--yes`.
5. **`📋 Summary` and one confirmation**, defaulting to no. `--dry-run` stops here.
6. **Apply** → record the features as trimmed in `project.json` → `npm install` (only if a dependency
   went) → `npm run sanity:typegen` → `npm run format`.
7. **Purge**, behind `--dataset`, its own confirmation and an automatic export to `./backups/`.
8. **knip sweep** for what the manifest did not know about, the docs and skills that still describe
   the feature, the quality gates, and a report of what was deliberately left for a human.

## What the trim knows about this repository

The manifest belongs to the starter; what a project did with it belongs to the project. So there are
two files, and the trim never guesses what one could record:

| File | Owner | Holds |
| --- | --- | --- |
| `features.ts` | The starter. Replaced by `npm run trim:update`, never edited in a project | What each feature is made of, and `since`: the day it joined the starter |
| `project.json` | The project. Never touched by an update | `starter.cutFrom`, a state per feature it decided about, its own `sections` and `documentTypes` |

A feature's state is the record's when there is one, and the tree's otherwise:

- **trimmed / removed / adopted** come from the record. `adopted` is a feature the project took over
  and changed (the blog that became a research section): never offered, never asserted.
- **never had**: `since` is later than `cutFrom`. A file by its names is the project's own, which is
  how a project's `HeadlineSection` written before the starter shipped one is never offered as kit.
- **present / partial / absent** otherwise, by which of its files exist.

**Role.** The starter is the repository `project.json` names, cloned from its own origin, with no cut
date. Anything else is a project. The role decides how strict `manifest.test.ts` is: in the starter
every path and anchor must resolve; in a project those checks are skipped (a project changes what it
keeps, and `--status` shows that drift without failing CI), while the coverage checks still run
against the record.

**Keeping the record without thinking about it.** `npm run sanity:project-setup` stamps `cutFrom` in
a new project. Plop runs `own.ts` after scaffolding a section or a prefix-route type, which records it
as the project's. `--reconcile` covers everything else once: it defaults the cut to the first
commit's date, records whatever is absent as removed, asks about anything partial or drifted, and
records what the manifest does not know as the project's own.

The cut it suggests is the fork point with the starter (`git merge-base` after fetching it), which is
exact for a `git clone`. A template copy shares no history, so there it is the first commit.
`starter.root` in `project.json` names the starter's own first commit, which is how a clone is told
apart from a template copy: when a clone cannot reach the starter, the suggestion falls back to the
last change to the manifest, which is late rather than early. Too early would hide real starter
features as "never had"; too late only misses a name clash. `--yes` refuses to record that fallback
and asks for `--from` or `--cut-from`.

**Updating.** `npm run trim:update [-- --from <url or path>] [--ref <ref>]` fetches the starter,
replaces this folder, the skill and `docs/features/trimming-features.md`, deletes files the starter
dropped, adds missing `trim*` scripts to `package.json`, and leaves what `project.json` records
alone (it only fills in the starter's `repository` and `root` when they are missing). A feature the
starter added after the cut arrives as "never had". It refuses a starter ref that predates
`project.json`, since taking it would delete the code that reads the record.

The updater that runs is the project's current copy, so a change to the updater itself takes effect
on the next run: run it twice after a large jump. A project that has no `update.ts` yet runs the one
from a starter clone: `node --import=tsx <starter>/scripts/trim-features/update.ts --from <starter>`.

`npm run trim:verify` works in a project too, and only verifies what is still offered there.

## Purging later

The code removal and the content removal are two decisions, usually days apart: the edit token, or
the `sanity login` the pre-purge export needs, is often not in place when the code goes.
`--dataset-only` is the second half on its own.

```bash
npm run trim -- --dataset-only --dry-run          # read-only: what is stranded?
npm run trim -- --dataset-only                    # pick from it and delete
npm run trim -- --dataset-only --type person --yes
```

**It reads no manifest.** "Is this content stranded?" has an exact answer that needs no knowledge of
where any file lives: a `_type` with documents but no entry in `sanity-schema.json` cannot be
rendered, queried by the app, or opened in the Studio. So this half diffs the extracted schema
against the types the dataset actually stores.

That makes it the one genuinely portable piece here. It works in a project that renamed its types or
moved its schema folder, where the manifest cannot resolve a single anchor, and it finds orphans of
types nobody ever wrote a manifest entry for. Any type with a dot in its name is excluded, because a
plugin owns it: Mux writes `mux.apiKey` at runtime, the extract never mentions it, and it holds live
credentials. It reads one dataset per run, so run it once per dataset.

It also finds page-builder items whose `_type` the schema no longer declares: a section trimmed from
the code leaves its items inside pages, and the extract names every member type (as an inline `_type`
literal), so the diff is exact there too. Those are stripped from their pages, not deleted.

It touches no files, so it does not care whether the working tree is clean, and it skips
`npm install`, typegen, format, knip and the gates. `--dry-run` needs no `--type`; `--yes` does,
because it deletes without asking and should name what it is deleting.

Nothing is ordered for deletion. Everything goes in one transaction, so a strong reference between
two doomed documents is not a problem, and anything pointing in from *outside* the set is found by
asking the dataset (`references()`), then read to tell a weak reference, which will dangle, from a
strong one, which would make Sanity refuse the whole transaction, and reported before you confirm — which no hardcoded ordering
could have done for a type the manifest has never heard of.

## Layout

| File | Owns |
| --- | --- |
| `trim.ts` | The flow: flags, preflight, plan, confirmation, apply, purge, report |
| `features.ts` | The starter's manifest. One declarative entry per removable feature, no logic |
| `project.json`, `project.ts` | The project's record, its role, and each feature's state |
| `status.ts` | The survey behind `--status`, the picker and `--reconcile` |
| `importers.ts` | Which files import a path, aliases resolved: the code-side answer to "is it used?" |
| `mentions.ts` | The docs and skills that still describe a removed feature |
| `own.ts` | Plop's hook: records a scaffolded section or type as the project's |
| `update.ts` | `npm run trim:update` |
| `edits.ts` | The pure source transforms, over the TypeScript AST |
| `dataset.ts` | The GROQ usage report, the purge plan and the purge |
| `knip.ts` | The second pass, diffed against a baseline taken before the trim |
| `verify.ts` | `npm run trim:verify`: every trim applied to a throwaway copy, and the gates run on it |
| `manifest.test.ts` | The manifest checked against the repository it describes |

## Verifying

`npm run trim:verify` applies every trim to a throwaway `git worktree` built from the tree as it
stands, runs the typecheck and the tests against each result, and tears the copy down. Pass feature
ids to narrow it. The working tree is never written to and nothing here reaches Sanity, so it is safe
against a project that is live.

It is the gate `manifest.test.ts` cannot be. That one checks every anchor still resolves; this checks
that what is left over still compiles, which is a different question and the one that catches a
feature reaching into another's files. Run it after editing a feature entry, and before merging.

It also greps what survives for the paths the trim deleted, because the typechecker is blind to a
stale `import()` inside a `.d.ts` while the base tsconfig sets `skipLibCheck`, and a custom element
registry is exactly the kind of file that lists modules by path.

## Adding a feature

This starter ships more than the manifest describes: `docs/features/` lists the inventory, and only
some of it has an entry here. Growing that coverage is ordinary work, and the **trim-features** skill
carries the procedure, including how to find a feature's boundary without uninstalling a package
something else needs.

Add an entry to `features.ts`. It is data, not code:

```ts
{
  id: "newsletter",
  title: "Newsletter",
  summary: "The signup section and the subscriber inbox.",
  since: "2026-10-01", // the day it lands in the starter: projects cut earlier never had it
  implies: ["section:newsletter"],
  paths: ["sanity/schemas/documents/subscriber.tsx"],
  edits: [
    { file: "sanity/schemas/index.ts", edits: [
      { kind: "dropImport", id: "subscriber" },
      { kind: "dropArrayElement", arrayName: "schemaTypes", id: "subscriber" },
    ]},
  ],
  dependencies: ["some-esp-sdk"],
  env: ["NEWSLETTER_API_KEY"],
  documentTypes: ["subscriber"],
  docs: ["docs/features/newsletter.md"],
}
```

Then run `npm test`. It also checks the other direction, which is the one a growing repository
breaks. Adding a page-builder section or a document type leaves every existing anchor resolving
perfectly while the new thing has no way to be removed, so a section nobody accounts for fails, and a
registered document type must be removable, in `CORE_DOCUMENT_TYPES`, or recorded as the project's.
The section half counts both shapes, flat file and folder: a section earns a folder only once it grows
a companion, and `plop` scaffolds the flat one.

In the starter, an unaccounted section is kit that lost its entry, which is the bug this check exists
for. In a project it is the project's own, and plop or `--reconcile` records it in `project.json`
once. It also asserts statically that nothing outside a feature imports what the feature deletes,
which is the cheap half of `trim:verify`.

`manifest.test.ts` checks every path, anchor, dependency, env var, doc and
schema type against the real tree, so a typo fails immediately rather than surfacing months later as
a half-trimmed repo.

Declare what the feature owns, not what only becomes unused in combination with another one. An
import that two features share goes unused only when both are removed, and no single entry can say
that; `npm run format` strips it, and the knip sweep names anything larger.

A shared layer only this feature happened to use goes under `orphans`. Those are reported, never
deleted, because whether they go is a judgement about what you plan to build. They are declared
rather than left to the knip sweep, which only names a file nothing at all imports: a module kept
alive by its own colocated test is invisible to it, and the sweep found 7 of the contact form's 25.

### The edit kinds

`edits.ts` walks the TypeScript AST rather than running regexes, because the registries it edits are
enumerations with `// PLOP: Add …` markers and this is the inverse of `plopfile.mjs`.

In a component, the AST kinds only ever see the frontmatter between the `---` fences, so a class name
in the markup that happens to match a removed key is never touched. `replaceText` and `dropLines` are
literal matchers and run over the whole file, which is where the conditional a removal has to
collapse actually lives.

| Kind | Removes |
| --- | --- |
| `dropImport` | One specifier, or the whole `import` when nothing it binds survives the batch |
| `dropExport` | One name from an `export { … }` clause, or the statement when it is the only one |
| `dropArrayElement` | An identifier from a named array (`article` from `schemaTypes`) |
| `dropObjectProperty` | A key from a named object, including `[SINGLETON_IDS.blog]:` |
| `dropVariableStatement` | A `const`, `function`, `type` or `interface`, with its JSDoc |
| `dropCallInArray` | A builder chain matched by its `.title()` argument |
| `dropStringFromArray` | A string entry from a named array |
| `dropObjectFromArray` | `{ type: "article" }` from a reference target list |
| `dropCallStatement` | A top-level `test("…", …)` block naming a removed function |
| `dropJsonKey` | One key from a generated JSON file, re-serialised so no comma dangles |
| `dropLines` | Whole lines, for Markdown and `.env` |
| `replaceText` | A literal span, for GROQ strings, which have no AST here |

Every matcher must hit **exactly once** (or its declared `count`). A zero match means the anchor
moved; an extra match means it is ambiguous.

A text matcher marked `optional` is the exception: finding nothing leaves the text alone and says
nothing. It is for spans whose removal is cosmetic, which in practice means the comment above a
branch being removed elsewhere. Prose is reworded far more often than the code under it, and the
anchors that broke first here were comments, not code. Split the comment off as an optional
`dropLines` and leave the code matcher required, so a reworded sentence cannot stop a trim.

### When a project has moved on

The usual case is not a fresh clone. Someone decides they never needed the blog after months of
building, by which point they have added fields to queries and edited the routes around them, and a
few anchors will have moved. "Nothing was changed" is a useless answer there.

So the whole plan is resolved first, and then:

- **Every anchor resolves** — it runs, as before.
- **Some do not, interactively** — the ones that failed are printed with their file, and you are
  asked whether to apply the rest and finish those by hand. Default is no.
- **Some do not, with `--yes`** — it stops, unless you pass `--partial`. A scripted run should not
  quietly do most of a job.

A partial run repeats the leftovers in its closing report, and `npm run check` will fail on them,
so the type errors are the checklist. The undo is still `git checkout .`.

A path that is already gone is never a failure: the goal is a tree without the feature, and a file
someone deleted by hand is a step towards it.

### Keep matchers narrow

`dropLines` and `replaceText` match literal text, and a wide matcher breaks the moment anything near
it is edited. Prefer a structural kind, and where text is unavoidable, match the smallest distinctive
fragment rather than a block: a one-line matcher survives reformatting, re-indentation and having a
wrapper added around it, where a fourteen-line one does not. `dropFieldByName` exists for exactly
this reason — a Sanity field's `name` cannot change without changing the content model, while
everything else in its definition is what a project customizes.

`dropLines` is the one transform with no structural safety net, since it deletes whatever text it
matches rather than a node. The plan prints the lines themselves underneath the matcher so they can
be read before they go.

A group of edits that only makes sense beside something takes `requires: "<path>"`. When that path is
absent the whole group is skipped rather than reported, which is how a project on an older cut of the
starter stops being told to hand-finish edits for a feature it never had. Anything that reaches the
literal matchers would otherwise read "never here" as "here in a shape I cannot recognise".

Never begin or end a `replaceText` matcher on whitespace. Whitespace is collapsed when matching, so a
leading newline or indent becomes `\s+` and swallows the blank line beside it, which then collides
with whatever edit owns the line above. Start and end on a real token and let the formatter tidy what
is left.

### Selections that resolve but do not work

Anchor checking cannot catch a selection whose *parts* are each valid and whose *combination* is not.
Removing every page-builder section left on disk, the project's own included, is the one that ships:
each edit resolves perfectly, but the result is an empty `sections` registry, which types `SectionName` as `never` and takes the Studio and
the build with it. `findSelectionConflicts` in `features.ts` runs alongside the anchor check, before
anything is written, and refuses it. Add to it if a future feature has the same shape.

## Why knip is stage two, not the driver

Knip cannot decide this. Nothing here is statically unreachable: `features/blog/**` is imported by a
route entry point, `article.tsx` is an entry in `sanity/schemas/index.ts`. It is also blind to the
three things that matter most — Sanity schema registries, where an array entry *is* the use; GROQ
strings that name `_type`s as plain text; and the dataset. And "this client has no blog" is a product
decision, not a static fact.

Where it earns its place is *after* the manifest has unwired a feature: the shared helper only that
feature used, the dependency that just became unused. The sweep diffs against a baseline taken before
the trim, so it reports what this run orphaned rather than the dozen files knip always finds here.

It is deliberately **not** in `npm run check`. The starter is a superset on purpose (`createIconField`
has no call sites by design), so a standing knip gate would fight that on every run.

One caveat worth knowing: knip collects imports from `.astro` files by regex rather than by parsing
them, so an unused *export inside* a component goes unreported. File-level and dependency-level
results still hold, which is what this sweep reads.

## What it does not do

- **Rewire.** A `legalPage` link in the Site singleton's footer becomes a dangling weak reference; it
  is reported, not repaired.
- **Take the content with it.** Routes are file-based, so deleting one is enough for a real `404`.
  The documents behind it stay, and the sitemap selects every document with a `uri.current` and no
  filter on type, so `/sitemap.xml` keeps advertising URLs that now 404. That is what `--dataset` and
  `--dataset-only` are for.
- **Regenerate stored Markdown.** `agentMarkdown.content` and `siteSettings.llms.content` are stored
  verbatim and go stale after a purge; regenerate them from the Agents tab.
- **Find every section anchor.** `internal.sectionTarget` is a plain string, not a reference. The
  report covers a section's own `appLink`; one written into a rich text annotation is not reachable by
  GROQ, so the anchor report is a floor, not a guarantee.
