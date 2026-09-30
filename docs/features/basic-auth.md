# Basic Authentication

HTTP Basic Auth uses **one username and password from the deployment environment** (`BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`). Sanity only stores **toggles**:

1. **Settings → Security**: **Protect entire site** gates every public page (except Studio, APIs, and static assets).
2. **Per page or article**: when the site is **not** fully protected, **Password protect** on that document gates its URL only. The same env credentials apply to site-wide and per-URL protection.

## How it works

1. Set `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` in your deployment environment. Local `astro dev` never gates (see **Excluded from Basic Auth**), so these are only needed locally if you build and run the production output.
2. **Site-wide:** **Settings** → **Security** → **HTTP Basic Auth** → enable **Protect entire site**.
3. **Per URL:** Leave **Protect entire site** off. On a **Page** or **Article**, turn on **Password protect**.
4. At runtime, `src/middleware.ts` reads the **published** toggles via `getSanityBasicAuthState()` (see **The middleware runs often; Sanity calls do not** below). Toggling a switch in the Studio only writes a **draft**; the change takes effect on **Publish**, and reaches the live site within about five minutes.

If Basic Auth is enabled in the CMS but env credentials are missing, the middleware responds with **503** and a short message so you can fix deployment config.

Draft mode (the Presentation tool's preview cookie) bypasses Basic Auth so editors can use Visual Editing without entering credentials on every request; the Studio itself sits behind Sanity auth.

The middleware also handles **agent Markdown content negotiation** (see [Agent Markdown](./agent-markdown.md)). That branch runs before the Basic Auth gate but defers to it: a request that prefers `text/markdown` is only rewritten to the Markdown route when the site is **not** site-wide protected and the path is **not** password protected, so protected content is never served as Markdown. It uses its own cached eligibility read (`src/features/agents/markdown-proxy-state.ts`), separate from the auth state below, and fires only for agent requests.

## The section preview is always gated

`/section-preview` and everything under it is authoring tooling, so it does not follow the toggles above. On every deployment it asks for the same env credentials whatever **Protect entire site** is set to, and it is checked before the preview cookie bypass and the agent Markdown rewrite, so neither opens it. With the credentials unset it answers **503** rather than serving anything. `astro dev` stays open, so local work and the thumbnail capture need no credentials. See [Section previews](./section-previews.md).

## The middleware runs often; Sanity calls do not

`src/middleware.ts` runs once per incoming request (the paths it skips in code are exempt: Studio, `/api/*`, `/_astro/*`, favicon, and any dotted path such as assets, `llms.txt`, `sitemap.xml`; `/feed.xml` is the one dotted path that stays gated, see [RSS feed](./rss-feed.md#basic-auth)). That is expected: each run is cheap (pathname checks and auth logic).

There is no shared data cache in the middleware, so the auth-state module manages its own caching. The layers that keep Sanity traffic negligible:

1. **Authenticated requests skip Sanity entirely.** Once a user passes the 401 challenge, the browser sends the `Authorization` header on every subsequent request. The middleware validates that header against env credentials first; if it matches, the request passes through without ever reading Sanity.
2. **Live Sanity API (no shared cache).** The auth-state query goes to `api.sanity.io`, deliberately not the API CDN. The CDN's publish-driven invalidation misses cached entries whose result set did not yet contain the published document (exactly what happens when a page turns **Password protect** on: it goes from non-matching to matching the query filter), and stale entries were observed serving pre-publish state for 20+ minutes, leaving a newly protected page public. The live API is always fresh; the hot cache below keeps the request volume negligible.
3. **Per-instance hot cache (5 minutes, bounded stale-while-revalidate).** Serves repeat requests from memory within a single server instance, so each instance queries Sanity at most about once per five minutes. Past the TTL, the last-known state is served while a single background refresh lands, so warm traffic never waits on Sanity and a transient Sanity error degrades to last-known state instead of failing open. Stale serving is capped at TTL + 60 seconds of grace; a long-idle instance blocks for a fresh read instead of serving old auth state. TTL + grace is the propagation ceiling: a published toggle change reaches every instance within roughly five minutes.
4. **In-flight deduplication.** If many requests land at once on a cold instance, they await a single shared fetch (with a 5-second timeout so a hung fetch cannot wedge them) instead of each issuing their own query.

The query is pinned to `perspective=published`, so unpublished draft changes can never flip auth on the live site.

## Gated pages are still cached

A protected site keeps the same route cache a public one has. The route cache (`src/lib/route-cache/`) lives in the app, past the shared-cache rule that refuses requests carrying an `Authorization` header (RFC 9111), so gated pages are stored and invalidated exactly like public ones: same tags, same webhook, and publishing content refreshes a gated page the same way. See [Revalidation and Caching](../sanity/revalidation-and-caching.md#basic-auth-traffic-is-cached-too) for the mechanics and why sharing an entry between authenticated visitors is safe.

## Excluded from Basic Auth

- **Local development.** `astro dev` returns every request unguarded, so no local browsing session, screenshot, or end-to-end run ever meets a 401. The check is `IS_DEV` (`import.meta.env.DEV`), which Vite folds to `false` in a build, so no deployment can take that path: preview deployments gate exactly like production. The gate is a deploy-time concern, and a 401 on localhost mostly breaks the browser rather than testing anything (Chrome drops URL credentials from subresource requests, so the page renders while all of its client JS 401s).
- Sanity Studio at the public path from `PUBLIC_SANITY_STUDIO_BASE_PATH` (see [Studio Config and Structure](../sanity/studio-and-structure.md))
- API routes under `/api/*` (for example `/api/draft-mode/*` and `/api/contact-form`)
- Astro internals under `/_astro/*` and `/favicon.ico`
- Static assets and metadata files (paths that look like files with extensions, including `llms.txt`, `sitemap.xml`, `robots.txt`), except `/feed.xml`, which carries article bodies and so follows site-wide Basic Auth
- Requests carrying the Sanity Presentation preview cookie (an authenticated Studio session), except on the section preview, which is always gated

## Sitemap

URLs with **Password protect** (HTTP Basic Auth) on **page** / **article** entries are **omitted** from the generated sitemap (alongside `noIndex`) via the GROQ filter in `src/pages/sitemap.xml.ts` (`passwordProtected != true`). Site-wide Basic Auth does not by itself remove URLs from the sitemap; use `noIndex` or per-entry flags as needed for SEO.

## Implementation reference

| Concern                | Location                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Middleware             | [`src/middleware.ts`](../../src/middleware.ts): the request pipeline only, in order: path exclusions, the always-on gate, draft-mode bypass (preview cookie), the agent Markdown rewrite, then the CMS gate |
| Gates                  | [`src/features/auth/gates.ts`](../../src/features/auth/gates.ts): the always-on gate and the CMS gate, `IS_DEV` bypass (dev server only), early exit on a valid `Authorization` header, calls `getSanityBasicAuthState()` |
| Path exclusions        | [`src/features/auth/excluded-paths.ts`](../../src/features/auth/excluded-paths.ts): Studio, `/api/*`, `/_astro/*`, dotted paths, and the one dotted path that stays gated |
| Sanity toggles + cache | [`src/features/auth/sanity-basic-auth-proxy.ts`](../../src/features/auth/sanity-basic-auth-proxy.ts): direct GROQ HTTP request to the live Sanity API (`api.sanity.io`, `perspective=published`), uses `SANITY_API_VIEW_TOKEN`, 5-minute stale-while-revalidate hot cache + in-flight dedupe |
| Credential helpers     | [`src/features/auth/basic-auth.ts`](../../src/features/auth/basic-auth.ts): header decode, constant-time compare, the 401 challenge, and the expected `Authorization` header the route cache provider matches against                                                                            |
| Environment            | [`src/lib/env.ts`](../../src/lib/env.ts): `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`                                                                                                                                                                                                       |
| CMS fields             | **Site** → `basicAuth.siteWideEnabled`; **Page** / **Article** → `passwordProtected` + `uri`                                                                                                                                                                                                 |

### GROQ query used by the middleware

Published documents only (the request pins `perspective=published`, so drafts are not visible):

```groq
{
  "basicAuth": *[_type == "siteSettings"][0].basicAuth{
    siteWideEnabled
  },
  "protectedPaths": *[passwordProtected == true && defined(uri.current)].uri.current
}
```

(`_type == "siteSettings"` matches `SANITY_SINGLETON_SITE_SETTINGS_ID` in code.)

## Where this is documented in the repo

- **[`docs/README.md`](../README.md)**: Security and access, common tasks, feature docs
- **[`src/features/auth/sanity-basic-auth-proxy.ts`](../../src/features/auth/sanity-basic-auth-proxy.ts)**: GROQ fetch (live Sanity API, published perspective), 5-minute SWR hot cache, in-flight dedupe
- **[`docs/sanity/schema-and-content-model.md`](../sanity/schema-and-content-model.md)**: `siteSettings.basicAuth`, `passwordProtected` on routable documents
- **[`docs/sanity/project-setup.md`](../sanity/project-setup.md)**: the wizard does not set `BASIC_AUTH_*` (add manually if needed)
