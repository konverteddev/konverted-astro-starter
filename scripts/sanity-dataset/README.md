# Dataset CLI (`scripts/sanity-dataset/`)

Sanity dataset **export** (backup), **import** (restore or seed), and **migration** (copy between datasets). All three are interactive: run them with no flags and they ask, summarise, then confirm (see the shared flow in `../README.md`). Shared logic lives in `lib.ts`.

| File                 | Role                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| `export.ts`          | Backup one dataset → `./backups/<dataset>-YYYY-MM-DD-HHMMSS.tar.gz`          |
| `import.ts`          | Import a local `.tar.gz` into a dataset (interactive picker, or `--file`)    |
| `migrate.ts`         | Export one dataset, then import it into another (standard, replace, clean)   |
| `dataset-picker.ts`  | The shared "which dataset?" prompt, backed by `sanity dataset list`          |
| `lib.ts`             | Env parsing, CLI arg builders, validation, dataset-list parsing (no I/O)     |
| `lib.test.ts`        | Unit tests for the pure `lib.ts` helpers (`npm test`)                        |

Backup filenames include a `YYYY-MM-DD-HHMMSS` timestamp so repeated runs on the same day never overwrite a prior archive.

Entrypoints are still the root `package.json` scripts (`npm run sanity:dataset-export`, `npm run sanity:dataset-import`, `npm run sanity:dataset-migrate`).

## Dataset export

With no flags it asks which dataset to export (picker) and whether to include assets, then confirms.

```bash
npm run sanity:dataset-export
npm run sanity:dataset-export -- --dataset staging
npm run sanity:dataset-export -- --dataset staging --no-assets --yes
```

| Flag               | Description                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `--dataset <name>` | Dataset to export (defaults to the interactive picker, or the `.env` dataset with `--yes`)  |
| `--no-assets`      | Documents only (faster, smaller)                                                            |
| `--dry-run`        | Print the plan and exit                                                                     |
| `--yes`            | Skip all prompts                                                                            |

## Dataset import

Interactive restore (the counterpart to export). With no flags it prompts for the archive (a picker over the seed and `./backups`), the target dataset, replace mode, and a final confirmation.

```bash
npm run sanity:dataset-import
npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz
npm run sanity:dataset-import -- --dataset staging --replace
```

| Flag               | Description                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `--dataset <name>` | Target dataset (defaults to the interactive picker, or the `.env` dataset with `--yes`)            |
| `--file <path>`    | Archive to import (defaults to the interactive picker)                                             |
| `--replace`        | Overwrite documents with the same IDs                                                              |
| `--dry-run`        | Print the plan and exit (requires `--file`)                                                        |
| `--yes`            | Skip all prompts (requires `--file`)                                                               |

## Dataset migration

With no flags it asks for the source, the target, and how the import should treat the target, then confirms once before anything runs.

```bash
npm run sanity:dataset-migrate
npm run sanity:dataset-migrate -- --from <source> --to <target>
```

| Flag               | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `--from <dataset>` | Source dataset (defaults to the interactive picker)                 |
| `--to <dataset>`   | Target dataset (defaults to the interactive picker)                 |
| `--replace`        | Overwrite documents with the same IDs                               |
| `--clean`          | Back up the target, then delete it, recreate as private, and import |
| `--skip-cleanup`   | Keep the source `.tar.gz` after import                              |
| `--dry-run`        | Print the plan and exit (requires `--from` and `--to`)              |
| `--yes`            | Skip all prompts (requires `--from` and `--to`)                     |

`--replace` and `--clean` are mutually exclusive. Passing neither leaves the mode to the prompt, which offers standard, replace, and clean.

`--clean` exports the target to `./backups/<to>-pre-clean-<timestamp>.tar.gz` before deleting it. If that snapshot fails (for example the target does not exist yet), the script asks you to confirm before continuing. The snapshot is preserved even when the source export is cleaned up.

### Examples

```bash
npm run sanity:dataset-migrate -- --from production --to staging --clean
npm run sanity:dataset-migrate -- --from production --to staging --replace
npm run sanity:dataset-migrate -- --from production --to staging --skip-cleanup
```

## Seed dataset

Bundled starter content lives in `seed/seed-dataset.tar.gz` and ships with the template. There is no dedicated script; use the raw `sanity:cli` wrapper:

```bash
# seed a project (or run `npm run sanity:dataset-import` and pick the seed)
npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz

# refresh the seed from your content (the --types allowlist keeps secrets out)
npm run sanity:cli -- dataset export production seed/seed-dataset.tar.gz \
  --types page,legalPage,site,siteSettings,blog,article,articleCategory,sanity.imageAsset,sanity.fileAsset --overwrite
```

A full export bundles **every** document, including secret-bearing ones such as the Mux `mux.apiKey` doc (private signing key + token); the `--types` allowlist is what keeps them out of the committed seed.

## Requirements

- `.env` with project and dataset: either `SANITY_PROJECT_ID` / `SANITY_DATASET` **or** the app's own public pair, whatever prefix its framework gives them.
- Authenticated Sanity CLI: `npm run sanity:cli -- login`. The dataset pickers list the project's datasets through it; without a session they fall back to typing the name.
- Permissions to export/import datasets for the project (dataset create/delete for `--clean`).
