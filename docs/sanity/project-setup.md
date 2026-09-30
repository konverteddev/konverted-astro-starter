# Automated Sanity project setup

Run `npm run sanity:project-setup` for an **interactive** wizard (prompts + spinners). It can provision a Sanity project (or link an existing ID), create the viewer/editor API tokens, add CORS with credentials, merge values into `.env`, and import the bundled [seed content](./seed-dataset.md). Use `--dry-run` to rehearse without side effects.

Details: `scripts/sanity-project-setup/README.md`.

If `.env` is missing, the wizard seeds it from **`.env.example`** (when present), then fills Sanity-related keys.

## Why a script

The [Sanity CLI](https://www.sanity.io/docs/apis-and-sdks/cli) covers projects (`sanity projects create`), tokens (`sanity tokens add`), and CORS (`sanity cors add`), but chaining them by hand for every new project is error-prone; the wizard runs them in the right order and writes a consistent `.env`.

## Alignment with this repo

- **Webhook is manual.** The wizard registers no content webhook. The app exposes `/api/revalidate` for tag-based cache invalidation; create the webhook once at [sanity.io/manage](https://www.sanity.io/manage) with projection `{_id, _type, "uri": uri.current}` and the `SANITY_REVALIDATE_SECRET` value. See [Revalidation and Caching](./revalidation-and-caching.md).
- **Env**: writes the variables the app expects (`PUBLIC_SANITY_*`, `SANITY_API_VIEW_TOKEN`, `SANITY_API_EDIT_TOKEN`).
- **CORS**: defaults include `http://localhost:4321` (the Astro dev server).
- **Seed content**: the last question asks how the dataset should start. The default imports `seed/seed-dataset.tar.gz` with `--replace` into the dataset you named, so the site renders on the first `npm run dev` instead of showing Not Found; **Completely empty** skips it, and you can import it later with `npm run sanity:dataset-import`. See [Seed dataset](./seed-dataset.md).
- **Studio public path**: the Studio is embedded at `PUBLIC_SANITY_STUDIO_BASE_PATH` (default `/studio`). If you need a different public URL, align the env var with [Studio Config and Structure](./studio-and-structure.md).
- **Optional HTTP Basic Auth**: the wizard does **not** set `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD`; add them in `.env` or your host if you use the gate. Toggles live in Sanity; see [Basic Authentication](../features/basic-auth.md).

## After setup

```bash
npm run sanity:typegen
npm run dev
```

The seed content is already in your dataset unless you asked for an empty one; `npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz` loads it later or into another dataset.
