# Seed dataset (starter content)

The repo ships a small **seed dataset** at [`seed/seed-dataset.tar.gz`](../../seed/) so a freshly cloned project starts with real example content instead of an empty Studio.

## What's in it

A standard Sanity dataset export with:

- example **pages**
- the **`site`** singleton (header, footer, SEO defaults) and the **`siteSettings`** singleton (site-wide configuration)
- the **`blog`** index singleton plus its example **articles**, **article categories**, and the **`person`** they are bylined to
- the **image and file assets** they reference (about 5 MB total)

`npm run sanity:project-setup` imports it for you at the end of its run; `npm run sanity:dataset-import` imports it on demand, and the `sanity:cli` export command below refreshes it.

## Seed a new project

Nothing to run: [`npm run sanity:project-setup`](./project-setup.md) asks how the dataset should start and, on the default answer, imports this archive with `--replace` right after it writes `.env`. So the first run is:

```bash
npm run sanity:project-setup   # create project, tokens, CORS, .env, seed content
npm run sanity:typegen         # generate sanity/types.ts
npm run dev
```

## Seed it separately

Answered **Completely empty**, or seeding a second dataset? With an authenticated CLI (`npm run sanity:cli -- login`):

```bash
npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz
```

Or run `npm run sanity:dataset-import` with no flags and pick the seed from the list. It then asks which dataset to import into, with the `.env` one offered first; pass `--dataset <name>` to answer that up front, or `--replace` to overwrite existing documents.

## Refresh the seed

When you change the demo content and want the committed seed to match:

```bash
npm run sanity:cli -- dataset export production seed/seed-dataset.tar.gz \
  --types page,legalPage,site,siteSettings,blog,article,articleCategory,person,sanity.imageAsset,sanity.fileAsset --overwrite
```

The committed `seed/seed-dataset.tar.gz` is tracked in git via a `.gitignore` exception, even though `*.tar.gz` is otherwise ignored.

**Security note:** a full dataset export includes **every** document, including secret-bearing ones. In this project that means the Mux config document (`mux.apiKey`), which stores a private signing key and access token. The `--types` allowlist above is what keeps secrets out of the committed seed: it exports only content types (pages, the `site` and `siteSettings` singletons, and image/file assets). Keep that list, and extend it when you add new content document types. The same caution applies to full backups from [`npm run sanity:dataset-export`](./dataset-migration.md): treat those archives as sensitive and never commit or share them.

See also: [Dataset export and migration](./dataset-migration.md), [Sanity project setup](./project-setup.md).
