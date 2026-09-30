# Dataset export, import, and migration

Use these workflows to back up a dataset, restore an archive into one, or copy content between Sanity datasets (for example production to staging).

## Commands

| Script                           | Purpose                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run sanity:dataset-export`  | One-off backup of a dataset to `./backups/`                                                 |
| `npm run sanity:dataset-import`  | Restore a `.tar.gz` into a dataset (pick from `./backups`/seed, or `--file`)                |
| `npm run sanity:dataset-migrate` | Export one dataset, then import it into another (standard, replace, or clean)               |

All three are interactive: run them with no flags and they ask what they need (datasets come from a picker over the project's real datasets), print a `📋 Summary`, then ask for one confirmation. Flags answer those questions up front; `--dry-run` prints the plan and stops, `--yes` skips every prompt. The shared flow is described in `scripts/README.md`.

Full flag reference: `scripts/sanity-dataset/README.md` (or the scripts' `--help`).

For the bundled starter dataset that ships with the template (to seed a fresh project), see [Seed dataset](./seed-dataset.md).

## Environment

Scripts resolve the project and default dataset from `.env`:

- Prefer `SANITY_PROJECT_ID` and `SANITY_DATASET` if set.
- Otherwise they use `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET` (the same variables as the app).

You must be logged into the Sanity CLI in the shell where you run the scripts (`npm run sanity:cli -- login`). Dataset operations use your CLI session, not the app's API tokens, and so do the dataset pickers: without a session they fall back to typing the dataset name.

## Safety notes

- **Migration** shows the full plan (source, target, mode, export path) and takes one confirmation before anything runs. In clean mode that confirmation spells out that the target is permanently deleted first, so only accept it when you intend to wipe that dataset.
- **`--clean` snapshots the target first.** Before deleting `--to`, the script exports it to `./backups/<to>-pre-clean-<timestamp>.tar.gz`. If that backup cannot be created (the dataset does not exist yet, or the export fails), it asks you to confirm before deleting. This snapshot is kept even when the temporary source export is cleaned up.
- Export archives are written under `./backups/` and are git-ignored as `*.tar.gz`. Filenames include a `YYYY-MM-DD-HHMMSS` timestamp, so two runs on the same day never overwrite each other.
- After a `--clean` migration, the target dataset is **private**; adjust visibility in [Sanity manage](https://www.sanity.io/manage) if the site expects a public dataset API.
- **Exports contain secrets.** A full dataset export includes every document, including secret-bearing ones such as the Mux config (`mux.apiKey`, which stores a private signing key and token). Treat `./backups/*.tar.gz` as sensitive: do not commit or share them. The committed [seed dataset](./seed-dataset.md) avoids this by exporting only content types via `--types`.
