# Redirects

This starter includes a redirect system managed in Sanity and baked into the Astro build.

## How It Works

- Redirects are stored in the `Settings` document in Sanity (schema type `siteSettings`)
- They are fetched once at config load by `astro.config.mjs` (`fetchRedirects()`) and passed to Astro's [`redirects`](https://docs.astro.build/en/reference/configuration-reference/#redirects) config
- The fetch is fail-soft: a fresh clone without env (or Sanity unreachable) builds with no redirects instead of crashing

Supported behavior:

- Exact path redirects (`/old-page` to `/new-page`)
- `301` (permanent) and `302` (temporary) status codes

Astro's config-level redirects match exact paths; pattern and wildcard syntax is not supported.

## Managing Redirects

1. Open Sanity Studio at the public path from `PUBLIC_SANITY_STUDIO_BASE_PATH` (default `/studio`; see [Studio Config and Structure](../sanity/studio-and-structure.md))
2. Go to `Settings` -> `Redirects`
3. Add a redirect:
   - `From`: source path (`/old-page`)
   - `To`: destination path (`/new-page`)
   - `Status Code`: `301` or `302`

## Example

- From: `/about`
- To: `/about-us`
- Status: `301`

## Notes

- Redirects are resolved at build time
- Rebuild the app after redirect changes (the **Redeploy site** button next to the field is the placeholder seam for that trigger; see [Revalidation and Caching](../sanity/revalidation-and-caching.md))
- Duplicate `from` values are blocked by schema validation
