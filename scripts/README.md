# Scripts

Root `package.json` exposes Sanity helpers under the `sanity:*` namespace (see `package.json`).

- **`lib/`**: The shared interactive shell every script below is built on (`cli.ts`): header, prompts, summary block, confirmation, cancel and failure exits.
- **`sanity-dataset/`**: Dataset export, import, and migration CLIs. Entry points: `npm run sanity:dataset-export`, `npm run sanity:dataset-import`, `npm run sanity:dataset-migrate`. Details: `sanity-dataset/README.md`.
- **`trim-features/`**: Interactive feature removal for this superset starter (code, docs, dependencies and Sanity content). Entry points: `npm run trim` (with `--status` and `--reconcile`), `npm run trim -- --dataset-only` for content an earlier trim left behind, and `npm run trim:update` to take the starter's current copy. Details: `trim-features/README.md`.
- **`sanity-project-setup/`**: Interactive Sanity project bootstrap (tokens, CORS, `.env`, seed content). Entry point: `npm run sanity:project-setup`. Details: `sanity-project-setup/README.md`.

## One shape for every script

Run any of them with no flags and you get the same flow:

1. **Header** naming the script and what it does.
2. **Questions** for whatever the flags did not already answer. Datasets come from a picker listing the project's real datasets (`sanity dataset list`), with the `.env` one first and "Other (type a name)" last; if the list cannot be read the prompt falls back to typing the name.
3. **`📋 Summary`** of exactly what is about to happen.
4. **One confirmation**, defaulting to no.
5. **Result**: `✅` on success, `👋 Cancelled.` when you decline or press Ctrl-C (exit 0), `❌` with the reason on failure (exit 1).

Every flag answers one question up front, so scripting stays possible:

| Flag           | Meaning                                                            |
| -------------- | ------------------------------------------------------------------ |
| `--dry-run`    | Ask nothing, print the summary, exit without touching anything     |
| `-y`, `--yes`  | Answer every prompt, for CI and scripts                            |

`npm run trim` follows the same shape, with one addition before the summary: it resolves every edit
against the tree first and aborts with the full list if any anchor no longer matches, so a drifted
repo is never left half-trimmed.

`--dry-run` and `--yes` are non-interactive, so anything the flags leave unanswered either falls back to the `.env` value or exits with an error naming the missing flag.

## Tests

The pure helpers in each `lib.ts` and in `lib/cli.ts` (env parsing, arg builders, validation, dataset-list parsing, summary formatting, env-file upserts, CLI output parsing) are covered by colocated `*.test.ts` files using the Node test runner. Run them with:

```bash
npm test
```
