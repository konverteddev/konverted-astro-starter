# Trimming features

This starter is a **superset**. Every project that starts from it inherits a blog, legal pages, a
contact form, a shared form layer and five page-builder sections, whether or not that project wants
them. That is deliberate: it is cheaper to remove a feature you can see than to rebuild one you
deleted early.

`npm run trim` is how you remove one, on day one or months in. It is the only command you need:

```bash
npm run trim
```

It walks you through the whole job, one question at a time:

1. **Is this copy of the trim current?** If the starter ships a newer one, it offers to update first.
2. **What does this project have?** Every starter feature, its content in each dataset, and any of
   your code that imports it.
3. **Is anything unrecorded?** The cut date, a starter feature you rebuilt as your own, sections you
   wrote by hand. It offers to record them before it offers anything else.
4. **What do you want to do?** Remove features, delete content an earlier trim left behind, or stop
   at the overview.
5. **After a removal, the content.** Delete it now or later. Later is the default: until the code is
   deployed, the live site may still ask for it, and the next `npm run trim` finds it by itself.

The flags below are for scripts and for skipping ahead; the guided run covers everything they do.

Full reference, including how to add a feature to the manifest:
[`scripts/trim-features/README.md`](../../scripts/trim-features/README.md).

## It knows what your project has

Two files split the knowledge:

- `scripts/trim-features/features.ts` is the **starter's** manifest: what each feature is made of,
  and the day it joined the starter. A project never edits it; `npm run trim:update` replaces it.
- `scripts/trim-features/project.json` is the **project's** record: the day it was cut from the
  starter, what it did with each feature, and the sections and document types it wrote itself.

From those two and the tree, every starter feature has one state:

| State | Meaning |
| --- | --- |
| present, partial | Here, all or in part. The only ones the trim offers |
| trimmed | Removed by the trim, which recorded it |
| removed | Gone by hand, before the trim or outside it |
| adopted | The project took it over and changed it; never offered, never asserted |
| never had | Joined the starter after this project was cut, so a file by its name is the project's own |

`npm run trim -- --status` prints that table, with each feature's content in **every** dataset
(production first) and any project code that imports it. Imported means used: removing it would break
that code, so the trim says so before it asks.

## Day one, and five weeks in

`npm run sanity:project-setup` stamps the cut date when it sets up a new project. From then on, plop
records every section or prefix-route type it scaffolds as the project's own, so `npm test` stays
green as the project grows.

A project that skipped the setup, or predates the record, runs this once:

```bash
npm run trim -- --reconcile
```

It asks when the project was cut (the fork point with the starter is the default, or the first
commit for a template copy), records what is gone, asks about each starter feature that was partly
removed or rewritten ("still the starter's, or yours now?"), and records the sections and types the
starter's manifest does not know as the project's.

## Keeping the trim current

The trim in a project is a copy. The starter keeps fixing and extending it, and a project picks that
up with:

```bash
npm run trim:update
```

It replaces the trim's files, skill and this doc with the starter's, and never touches what
`project.json` records. A feature the starter added after your cut shows up as "never had", so
nothing new is offered for removal that your project could not have.

A project that predates `trim:update` runs it once from a starter clone:
`node --import=tsx <starter>/scripts/trim-features/update.ts --from <starter>`.

## What ships as removable

| Id | What goes |
| --- | --- |
| `blog` | The blog index, articles, categories, the RSS feed, and the author profiles that byline them |
| `authors` | The same removal from the other side (see below) |
| `legal-pages` | The `legalPage` type and the prose route that renders it |
| `forms` | The shared form layer: validation, spam prevention, the field components. Takes the contact form with it |
| `contact-form` | The section, the submissions inbox, and the Resend notification path |
| `section:media`, `section:cta`, `section:text`, `section:contact-form`, `section:headline` | One page-builder section each |

`blog` and `authors` imply each other. A person only exists as an article's author, and the byline is
part of the article route and its JSON-LD, so "a blog without bylines" would mean rewriting that route
rather than unwiring a registry. `forms` implies `contact-form` one way only: a project can drop the
contact form and keep the layer to build its own forms.

## It expects a project that has been worked in

By the time you decide you never needed the blog, queries have extra fields and routes have been
edited around. So the trim resolves every edit against the tree first, and if some no longer apply it
says which, and offers to do the rest and leave those to you. `npm run check` then fails on exactly
those spots, so the type errors are your checklist. With `--yes` it stops instead, unless you add
`--partial`: a scripted run should not quietly do most of a job.

Commit or stash first: the undo is `git checkout .`, and the script refuses a dirty tree for that
reason. `npm run trim -- --dry-run` prints every file it will delete and every edit it will make.

## The dataset is a separate decision

The trim **reads** the datasets and prints what each feature holds before it asks anything. It
deletes nothing unless you add `--dataset`, which has its own confirmation, exports the dataset to
`./backups/` first, and deletes every document of the removed types, drafts included, in one
transaction.

```bash
npm run trim -- --feature blog --dataset
```

The purge needs `SANITY_API_EDIT_TOKEN`, because deleting and patching documents cannot be expressed
as Sanity CLI commands. Purge production only after the code trim is deployed, or the live site
queries content that is already gone.

### You can purge later, in any project

The two halves are usually days apart, so the purge is not a one-shot. Run `npm run trim` once the
code is deployed: it lists what each dataset still holds that the schema no longer declares, and
offers to delete it. For a script:

```bash
npm run trim -- --dataset-only --dry-run   # read-only: what is stranded?
npm run trim -- --dataset-only             # pick from it and delete
```

This half **reads no manifest**. A `_type` with documents but no entry in `sanity-schema.json` cannot
be rendered, queried by the app, or opened in the Studio, and a page-builder item whose type the
schema no longer declares is skipped by the site and flagged in the Studio. So it diffs the extracted
schema against what the dataset stores: whole documents, and section items inside pages. Any type whose name contains a dot is excluded, because a plugin owns
it and may write documents at runtime that the extract never mentions. Run it once per dataset.

### Why it matters that you do

Routes are file-based, so a code-only trim is already enough for `/blog` to answer a real `404`. The
sitemap is the part that costs you. It selects **every** document with a `uri.current`, with no
filter on type:

```
*[defined(uri.current) && seoMetadata.noIndex != true && passwordProtected != true]
```

So after a code-only trim of the blog, `/sitemap.xml` still lists `/blog`, every article and every
author, and every one of those URLs now 404s. Search engines read that sitemap.

## What it deliberately leaves alone

It removes; it does not repair. The closing report lists what is left:

- **Prose.** Docs and skills that still describe the feature are listed by file and line. The trim
  prunes links to a deleted doc, but a sentence explaining the feature is yours to rewrite.
- **Dangling weak references.** `internal.link` is `weak: true`, so a footer link to a deleted legal
  page survives as a `_ref` to nothing. Every holder is listed in the purge plan.
- **Orphaned section anchors.** `internal.sectionTarget` stores a section's `_key` as a plain string,
  so nothing in Sanity flags it. The report covers a section's own `appLink`; an anchor written into
  a rich text annotation is not reachable by GROQ, so treat the report as a floor.
- **Stale generated Markdown.** `agentMarkdown.content` and `siteSettings.llms.content` are stored
  verbatim. Regenerate them from the Agents tab. See [Agent Markdown](./agent-markdown.md) and
  [llms.txt and AI agents](./llms-txt.md).

## When it refuses to start

> ❌ The manifest does not describe this repository, so nothing was changed.

The shared registries the manifest is written around (`sanity/schemas/index.ts` and the like) are not
where it looks, so the tree was restructured rather than trimmed. Read the `--dry-run` plan as a
specification and apply it by hand.

> ❌ That selection would not leave a working starter, so nothing was changed.

Removing every page-builder section left on disk, the project's own included. Each edit is valid on
its own, but a page builder with nothing to build from breaks the Studio and the build.

> ❌ Not something this run can remove, so nothing was changed.

The feature is already trimmed, removed, adopted, or one this project never had. The message says
which.
