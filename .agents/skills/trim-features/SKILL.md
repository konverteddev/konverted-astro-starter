---
name: trim-features
description: Use when removing a shipped feature from this project (blog, authors, legal pages, contact form, the form layer, a page-builder section) in the code, the dataset, or both, when asking what of the starter a project still has or uses, and when teaching the trim to remove something it does not cover yet. Covers `npm run trim` and its `--status`/`--reconcile` modes, `npm run trim:update`, finishing the edits it cannot apply, purging stranded content with `--dataset-only`, the `project.json` record, adding an entry to `features.ts`, and fixing `manifest.test.ts` when it goes red. Do NOT use for building a new product feature (see `scaffolding-plop`), or for deleting individual documents an editor could delete in the Studio.
---

# Trimming features

`npm run trim` removes a feature across its files, registries, docs, dependencies and content. This
starter is a superset on purpose, so the normal moment for it is late: a project several months in
where someone concludes they never needed the blog.

The script does the deterministic part and refuses to guess at the rest. Your job is the rest.

## Core Rules

- **Ask the tree before you answer.** `npm run trim -- --status` says what this repository has of the
  starter: each feature's state, its content in every dataset, the project code importing it, and
  the edits it drifted from. Never answer "is the blog used?" from memory.
- **Two files, two owners.** `features.ts` is the starter's and is never edited in a project;
  `project.json` is the project's and is never edited by an update. A project fixes its record, never
  the manifest, and the starter fixes the manifest.
- **Run the script first, always.** `npm run trim -- --dry-run` before anything. Never hand-edit
  something the script can do: if an edit belongs to a feature in `scripts/trim-features/features.ts`,
  rerun the script rather than reproducing it by hand.
- **Never hand-edit to make an anchor match.** If the script cannot find an anchor, finish that one
  edit by hand afterwards. Reshaping the code so the matcher fits is backwards and loses the record.
- **The dataset is never your judgement.** You do not decide what content is unused. `--dataset-only`
  diffs `sanity-schema.json` against the types the dataset stores; a `_type` with no schema entry is
  orphaned, and that is the only rule. Do not delete documents on any other basis.
- **Do not weaken a matcher to make a run pass.** An anchor that matches twice is ambiguous, and the
  fix is to anchor it on more context, never to accept the first hit.
- **One feature at a time when a project has diverged.** Combined runs are fine on a clean tree, but a
  drifted project is far easier to review one feature at a time.

## Trigger Conditions

Apply this skill when the task is **remove / drop / delete / "we don't need"** for a feature this
starter ships: the blog, author profiles, legal pages, the form layer, the contact form, or a
page-builder section. Also apply it for "what of the starter are we still using?", after cloning or
porting the trim into a project, and when `npm test` fails in `scripts/trim-features/manifest.test.ts`.

## Execution Checklist

A person runs `npm run trim` and answers its questions; it covers every step below in order. An agent
has no terminal to answer prompts in, so it runs the same steps with flags:

1. `npm run trim -- --status`. If it says the project has no cut date, or lists anything as absent
   or unaccounted, run `npm run trim -- --reconcile` first and commit `project.json`.
2. Confirm the working tree is clean. The undo is `git checkout .`, and the script refuses a dirty
   tree for that reason. Do not reach for `--allow-dirty` to get past it.
3. `npm run trim -- --dry-run --feature <id>`. Read the plan: files to delete, edits per file, the
   dependencies and env vars going, anything already gone, and any project file that imports it.
4. Run it for real. If some edits do not resolve, or project code imports the feature, it prints them
   and asks; accept, and finish them yourself. With `--yes` it stops instead unless you pass
   `--partial`.
5. Work the unresolved list (see **Finishing an unresolved edit**), then the docs and skills the
   closing report says still describe the feature.
6. `npm run check` and `npm test`. On a partial run the type errors are the checklist: each one is a
   place the code still references what was removed.
7. In the starter, after editing `features.ts`: `npm run trim:verify`. It applies every trim to a
   throwaway worktree and runs the gates on the result, which is the only check that catches one
   feature reaching into another's files. It never writes to the working tree or a dataset.
8. `npm run trim -- --dataset-only --dry-run` to see what content is now stranded, per dataset (whole
   documents, and section items left inside pages), then
   drop `--dry-run` to delete it once the code is deployed. This needs `SANITY_API_EDIT_TOKEN` and a
   logged-in Sanity CLI.
9. Read the closing report. It lists what was deliberately left: dangling weak references, orphaned
   section anchors, stale generated Markdown, prose that still describes the feature.

## Keeping a project's copy current

The trim in a project is a copy of the starter's. `npm run trim:update` replaces it (the folder, this
skill, the contributor doc) and never touches what `project.json` records; follow it with
`--reconcile` and `npm test`. When `--reconcile` cannot fetch the starter in a `git clone`, it will not
guess the cut under `--yes`: pass `--from <starter clone>` or `--cut-from`, never an early date. Do not port starter fixes by hand, and do not delete a manifest entry to make a project
test pass: record the feature as `adopted` instead.

## Modelling a feature the trim does not cover yet

This starter ships more than the manifest describes, so growing it is ordinary work rather than a
rewrite. `docs/features/` is the inventory to work from: anything documented there and genuinely
optional is a candidate. An entry is data, not code, because `edits.ts` already knows how to perform
every removal in the README's edit-kind table.

1. **Find the boundary before writing anything.** Grep the whole repo for importers, not `src/`
   alone. A package the config or a script also imports is not this feature's to uninstall, and
   declaring it under `dependencies` uninstalls it for everyone.
2. **Separate what the feature owns from what it merely uses.** A component only this feature renders
   belongs in `paths`. A shared one stays, and goes under `orphans` when nothing else will use it
   once this is gone.
3. **Date it.** `since` is the day the entry lands in the starter. A project cut before that never had
   the feature, so a file there by the same name is treated as the project's own. Only an entry for
   code that already shipped takes an earlier date.
4. **Declare the Sanity surface.** `documentTypes` for stored documents, `sectionTypes` for page
   builder members. Never declare a namespaced type: a dot means a plugin owns it. A feature that
   stores nothing at all is `codeOnly`, the only way past the check that every feature can be purged.
5. **Write the edits**, preferring a structural kind over `replaceText`. Where text is unavoidable,
   match the smallest distinctive fragment, never begin or end the matcher on whitespace, and split a
   comment into its own `optional` edit so rewording prose cannot stop a trim. A group that only
   makes sense beside something else takes `requires`.
6. **`npm test`.** It checks every path, anchor, dependency, env var, doc and type the entry names.
7. **`npm run trim:verify <id>`.** It applies the trim to a throwaway copy and builds the result,
   which is the only check that catches another feature reaching into the files yours deletes.

### Couplings run one way more often than both

`forms` implies `contact-form`, because the contact form is built out of the layer and cannot outlive
it, while a project can drop the contact form and keep the layer to build its own. `blog` and
`authors` imply each other, because an article's byline is part of the route.

This is not a judgement to make in advance. Declare the entry, run `trim:verify`, and read the build
errors: they name the direction.

## Scope Guidance

### Finishing an unresolved edit

An unresolved edit means this project rewrote that code. The script's description states the intent;
apply it to whatever is there now. The three that come up:

- **A GROQ projection** (`src/features/agents/query.ts`, `src/sanity/queries.ts`,
  `src/pages/api/agents/llms-txt.ts`). The projection has been customized, so the exact span no longer
  exists. Remove the fields belonging to the departing type and nothing else. A byline built from
  several fields is still a byline: remove the whole thing rather than part of it.
- **A conditional in a component template** (`src/pages/[...uri].astro`). A ternary branching on the
  removed `_type` collapses to its other branch. Keep whatever wrapper markup the project added around
  it. The AST edits only ever touch frontmatter, so anything in the template half arrives here.
- **A type list** (`_type in [...]`, the `tags` on a `cache.set`, `to:` reference targets). Remove the
  entry, leave the rest, and check whether the surrounding construct still needs to be a list at all.

After each one, rerun `npm run check.types`. It is the fastest confirmation you removed the right
thing, because anything you missed still references a deleted symbol.

### When the manifest test is red

In the starter, `manifest.test.ts` asserts everything, and fails for two opposite reasons that need
opposite fixes. An anchor no longer resolves, usually because a registry moved: update the manifest,
not the test. Or something in the tree is not declared: a section with no entry (flat file or
folder), or a document type that is neither removable nor in `CORE_DOCUMENT_TYPES`. That is starter
kit that lost its entry, and it gets the entry back.

In a project, the per-feature assertions are skipped (`--status` shows the same drift), and only the
coverage checks and the record run. An unaccounted section or type there is the project's own:
`npm run trim -- --reconcile` records it, and plop does it for scaffolded ones. A record entry the
tree contradicts (a trimmed feature whose files came back) means fixing `project.json`. What you must
never do, in either, is delete the assertion or edit `features.ts` in a project.

Prefer a structural edit kind over `replaceText`: they name one specific binding, key or element, so
they survive reformatting and are treated as already satisfied when the thing is simply absent. Where
text is unavoidable, match the smallest distinctive fragment rather than a block, and never begin or
end that fragment on whitespace: matching collapses whitespace, so a leading newline or indent
swallows the blank line beside it and collides with the edit that owns the line above. A matcher that
only removes a comment belongs in a separate `optional` edit, so rewording the prose cannot stop the
trim.

### When the manifest does not fit at all

In a project that has restructured, the run refuses to start: the shared registries the manifest is
written around are not where it looks, so it is describing a different repository and every file it
cannot find would otherwise be reported as "already gone". That is the correct outcome rather than
something to force. Use the `--dry-run` plan as a specification: each line states one intent, in
order. Apply them by hand, then run the gates.

A softer version of the same problem gets a warning rather than a refusal. A feature that is only
partly present is either half-removed by an earlier run, or kept by this project under a new meaning:
the route is gone but a document type survived because it is used for something else now. The second
case is `adopted`: record it with `--reconcile` (or `--adopt <id>`) and the trim stops offering it.
Otherwise the run prints which of its files are left and which are absent, and the ones left are the
ones about to be deleted. Read that list before confirming, especially with `--dataset`.

`--dataset-only` still works unchanged there, because it reads the schema rather than the manifest.

### Handoffs

- Building a new product feature rather than removing one: **`scaffolding-plop`**. Teaching the trim
  to remove something is the section above, not a handoff.
- The removal changes what agents are served: **`agent-markdown`**.
- Page-builder shape questions while removing a section: **`section-anatomy`**.
- Documentation left inaccurate by the removal: **`docs-maintenance`**.

## Non-Goals

- **Deleting individual documents.** An editor does that in the Studio. This removes a whole type.
- **Disabling rather than removing.** `sanity/utils.ts` exports `selectByName`, which the schema
  factories accept for whitelisting and blacklisting. That is the tool for switching something off;
  this script removes.
- **Rewiring what a removal breaks.** A footer link to a deleted legal page becomes a dangling weak
  reference. The purge plan names every holder; repairing them is content work, not this.
- **Trimming to make a build smaller.** Removing an unused feature costs nothing at runtime; do it
  because the content model should not offer it, not for bundle size.

## Done Criteria

- `npm run check` and `npm test` pass.
- `npm run build` passes when a route was removed.
- No unresolved edit is left unaddressed, or each one is explicitly reported as intentionally kept.
- `npm run trim -- --dataset-only --dry-run` reports nothing stranded, or the remainder is named and
  explained.
- The closing report's leftovers have been actioned or handed back to the user.

## Reference Files

- `scripts/trim-features/README.md` — the flow, every flag, the edit kinds, and how to add a feature.
- `docs/features/trimming-features.md` — the contributor-facing version, including why skipping the
  dataset half leaves URLs in `sitemap.xml` that no longer resolve.
- `scripts/trim-features/features.ts` — the starter's manifest. One entry per removable feature, no logic.
- `scripts/trim-features/project.json` — the project's record; `project.ts` reads it and derives each state.
- `scripts/trim-features/schema.ts` — the schema-versus-dataset diff behind `--dataset-only`.
- `scripts/trim-features/verify.ts` — `npm run trim:verify`, which builds each trim in a throwaway copy.
