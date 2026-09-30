# Seed dataset

Starter content that ships with the template so a freshly cloned project boots with example data instead of an empty Studio.

`seed-dataset.tar.gz` is a standard Sanity dataset export containing:

- example **pages**
- the **`site`** singleton (header, footer, SEO defaults) and the **`siteSettings`** singleton (site-wide configuration)
- the **`blog`** index singleton plus its example **articles** and **article categories**
- the **image and file assets** they reference (about 5 MB total)

## Import it (seed your dataset)

[`npm run sanity:project-setup`](../docs/sanity/project-setup.md) already does this: its last question asks how the dataset should start, and the default answer imports this archive with `--replace`.

To import it separately (you answered **Completely empty**, or you are seeding another dataset), with the CLI authenticated (`npm run sanity:cli -- login`):

```bash
npm run sanity:dataset-import -- --file seed/seed-dataset.tar.gz
```

Or run `npm run sanity:dataset-import` with no flags and pick the seed from the list. It then asks which dataset to import into, with the `.env` one offered first; pass `--dataset <name>` to answer that up front, or `--replace` to overwrite existing documents.

## Refresh it (template authors)

To regenerate this archive from your own content:

```bash
npm run sanity:cli -- dataset export production seed/seed-dataset.tar.gz \
  --types page,legalPage,site,siteSettings,blog,article,articleCategory,sanity.imageAsset,sanity.fileAsset --overwrite
```

**Security note:** a full dataset export includes **every** document, secrets included. In this project that means the Mux config document (`mux.apiKey`), which stores a private signing key and access token. The `--types` allowlist above is what keeps secrets out of the committed seed: it exports only content types (pages, the `site` and `siteSettings` singletons, and image/file assets). Keep that list and extend it when you add new content types. The same caution applies to full backups from `npm run sanity:dataset-export`: treat those archives as sensitive and never commit or share them.

Full reference: [`docs/sanity/seed-dataset.md`](../docs/sanity/seed-dataset.md).
