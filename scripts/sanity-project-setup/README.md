# Sanity project setup (`npm run sanity:project-setup`)

**Interactive** CLI, on the same shared flow as every other script (`scripts/README.md`): prompts for org, project name or existing ID, dataset, tokens, CORS, how the dataset should start, and `.env` path, then a `📋 Summary` and one confirmation, with [ora](https://github.com/sindresorhus/ora) spinners for the steps that run.

It automates:

1. **Create a project** (`sanity projects create`) or **use an existing** project ID.
2. **API tokens**: `Frontend - View` (viewer) and `Frontend - Edit` (editor).
3. **CORS**: `sanity cors add --credentials` for one or more origins (defaults to the local dev origin in `.env.example`).
4. **Seed content**: unless you answer the last question with **Completely empty**, `sanity dataset import seed/seed-dataset.tar.gz --replace` runs against the dataset you named, so a fresh project boots with example pages, the `site` and `siteSettings` singletons, the blog, and their assets. `--replace` means re-running the wizard re-lands the full seed instead of failing on documents that already exist. The step is **skipped silently** when the checkout has no `seed/seed-dataset.tar.gz`, and it runs last, after `.env` is written; if the import fails, everything before it is already done, so retry with the `sanity:dataset-import` command the error prints rather than re-running the wizard.
5. **Starter cut**: records today as `starter.cutFrom` in `scripts/trim-features/project.json`, so `npm run trim` can later tell the starter's features from ones this project wrote. It asks first only when the checkout's `origin` is still the starter's own repository.

Writes the project's public `*_SANITY_*` keys, `SANITY_API_VIEW_TOKEN`, and `SANITY_API_EDIT_TOKEN`. The public prefix and the CORS default are both read from `.env.example`, so the wizard writes keys this project actually reads.

The wizard registers no content webhook. The app does expose `/api/revalidate` for tag-based cache invalidation; create that webhook once by hand at sanity.io/manage (see docs/sanity/revalidation-and-caching.md).

Optional **HTTP Basic Auth** (`BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`) is **not** written by this script; add them in `.env` or your host if you use the feature.

If the target `.env` file does not exist but **`.env.example`** does, the script **copies** `.env.example` to that path first, then merges/upgrades the keys above (so you keep placeholders like `RESEND_*`, etc.).

## Prerequisites

- `npm run sanity:cli -- login`
- Organization id/slug from [manage](https://www.sanity.io/manage) if you create a **new** project
- First run may not have a `.env` yet — the npm script ignores `MISSING_ENV_FILE` so dotenvx does not fail; the wizard can create `.env` from `.env.example`.

## Run

```bash
npm run sanity:project-setup
```

Answer the prompts. At the end you confirm a **summary** before anything runs.

**Quick defaults (Enter):** dataset `production` · public · create tokens · add CORS for the local dev origin · seed content.

### Dry run

```bash
npm run sanity:project-setup -- --dry-run
```

Walks through the same questions, prints the summary, then exits without calling Sanity or writing `.env`.

## After setup

```bash
npm run sanity:typegen
```

The seed content is already in your dataset unless you asked for an empty one. To load it later, or into another dataset:

```bash
npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz
```

Seed details: `seed/README.md`.

## Security

- Never commit `.env` or tokens.
- Revoke leaked tokens in Manage → API → Tokens.
