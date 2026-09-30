# Revalidation and Caching

This stack caches rendered routes with **tag-based invalidation**, built on Astro's route caching API (`Astro.cache` / `context.cache`, configured in `astro.config.mjs`). A signed Sanity webhook at `/api/revalidate` invalidates the right tags on publish, so cached pages refresh the moment content changes while normal traffic is served from the cache. The app answers every cache lookup itself (`src/lib/route-cache/`); no CDN in front of it ever holds a copy. Where entries are *stored* is the one host-specific part: on Vercel it is the Runtime Cache, shared by every instance, and anywhere else it is an in-process store. A deploy empties either one.

## The tag model

Tags follow one convention, shared by the pages that set them (`src/lib/cache.ts`) and the webhook that busts them:

| Tag | Example | Set on |
| --- | --- | --- |
| Document `_type` | `page`, `article`, `site`, `siteSettings` | Every response rendered from that type |
| `doc:<publishedId>` | `doc:homepage` | The document's own routes |
| The routed `uri` | `/about` | The document's page and its agent Markdown |

Two structural rules make the model work:

- **Every page also carries both site-wide singletons.** The header, footer, and SEO fallbacks come from the Site singleton, and the favicon comes from Settings; all of them render on every page, so each page response is tagged with both `_type`s (`SITE_WIDE_CACHE_TAGS` in `src/lib/cache.ts`). Publishing either singleton therefore invalidates the whole site through one tag.
- **List-like routes carry every contributing type.** `sitemap.xml` is tagged `page`, `legalPage`, `article`, and both site-wide types, so any routed document's publish refreshes it. The blog index adds `article` and `articleCategory` on top of its own document tags, so publishing any post or category refreshes the listing. `llms.txt` carries the site-wide types too (its content lives on `siteSettings`).

Where tags are set: `src/pages/[...uri].astro`, `src/pages/blog/[slug].astro`, and `src/pages/blog/index.astro` (`Astro.cache.set` with `CACHE_TTL` and `docCacheTags(page)` + `SITE_WIDE_CACHE_TAGS`), `src/pages/llms.txt.ts`, `src/pages/sitemap.xml.ts`, `src/pages/favicon.ico.ts`, and `src/pages/api/agent-markdown/[...uri].ts`.

## The provider

`astro.config.mjs` points Astro's cache API at `src/lib/route-cache/provider.ts`. Every lookup is **answered by the app**: rendered responses go into a `RouteCacheStore`, the app reads them back itself, and no response ever carries a header that would let a CDN or any other shared cache downstream hold a copy. That is deliberate. Invalidation is the webhook expiring tags in the store, and a copy sitting in a cache the webhook cannot reach would outlive every publish. The policy is identical on every host; only the store behind it changes.

| Module | Role |
| --- | --- |
| `provider.ts` | The configured entrypoint: wires runtime env (Basic Auth credentials) into the policy |
| `create-provider.ts` | The policy: what may be cached, what is bypassed, gated vs public keying, tag invalidation. It does no background work, so a long-lived server and serverless behave identically; the provider tests are the contract for both |
| `rules.ts` | The bypass predicates and the Basic Auth credential match |
| `entry.ts` | Key normalization, lifetime rule, and (de)serialization for stored entries |
| `store.ts` | The `RouteCacheStore` type (`get` / `set` with ttl+tags / `expireTag`) and the in-memory LRU + tag-index default |
| `vercel-store.ts` | The same three methods against Vercel's Runtime Cache, plus the build marker the partition keeps there |
| `build-partition.ts` | Store decorators that key and tag entries by build, and sweep the previous build's entries once the new one serves |

Requests the middleware (`src/middleware.ts`) must handle specially skip the cache entirely:

- **Draft mode** (a signed `__draft_session` plus the `sanity-preview-perspective` cookie; any request carrying the perspective cookie skips the cache, a harmless false positive when it is forged): editors always see fresh draft renders, and draft responses are additionally excluded from being stored (`cache.set(false)` in the middleware).
- **Agent Markdown negotiation** (`Accept` mentions markdown): the middleware's rewrite must run; a cached HTML hit would answer first.
- **Unmatched `Authorization` headers** (wrong password, unrelated Bearer token): the middleware decides, and nothing is stored.

Everyone else gets the cached fast path: `X-Astro-Cache: HIT|MISS` on every cacheable response. Only a plain `200` with no `Set-Cookie` and a body under 1&nbsp;MB is stored; bodies travel base64-encoded (`entry.ts`) because `/favicon.ico` is bytes.

### Basic Auth traffic is cached too

Shared caches refuse any request carrying an `Authorization` header (RFC 9111; every CDN applies it), which is one of the reasons the store lives in the app, past that rule. Gated traffic is cached with two safeguards:

- **Separate keyspaces.** Gated entries are stored under a `gated:` key prefix and public entries under `public:`, so a stored gated render can never be read by a request that has not matched the credentials. An unauthenticated request for a protected URL misses the `public:` keyspace, reaches the middleware, and gets its 401, which is never stored.
- **Exact credential match.** A request only counts as gated when its `Authorization` header matches `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` exactly, compared in constant time (`rules.ts`, on the helpers in `src/features/auth/basic-auth.ts`). A browser replays that identical header on every request after the 401, so an entry is only ever handed back to a visitor already through the gate. Note that the key carries no trace of the credentials themselves: rotating `BASIC_AUTH_PASSWORD` does not orphan entries written under the old one, it just means only holders of the new password can reach them. Either way the redeploy that applies the new env var leaves them behind, since a new build reads a fresh keyspace.

A hit answers before the middleware runs, so a protection change relies on the same publish-driven invalidation everything else does: turning **Password protect** on publishes that document and busts its tags, and **Protect entire site** lives on Settings, whose tag every page carries.

### Where entries are stored

`provider.ts` picks the store at startup from one flag, `ROUTE_CACHE_VERCEL_RUNTIME` (a boolean, so only `true` or `false`; defaults to `false`):

- **`true`, on Vercel: the Runtime Cache** (`vercel-store.ts`, on `getCache()` from `@vercel/functions`). One cache for the whole project, shared by every function instance, so the webhook's `expireTag` reaches every copy at once. Vercel documents it as **persistent across deployments**, which is what makes it shared rather than what makes it stale: every key carries the build id that wrote it (see below), so what outlives a deploy is the shared store, never the HTML a previous release rendered. It is also split per environment, so preview/staging never reads production's entries, and per project on Pro and Enterprise plans (on Hobby, all of a team's projects share one cache and one storage budget).
- **`false`, the default: the in-process LRU** (`store.ts`). Per process, so a deployment running several instances has one store each and the webhook only expires tags on the instance that receives it; the others keep their copy until that instance is recycled. A deploy or restart starts empty. This is what dev, `astro preview`, and any non-Vercel host use.

It is an explicit flag rather than a sniff of Vercel's own `VERCEL` variable so that a build behaves the same wherever it runs, and so switching hosts is a config change rather than a code change. It is read at runtime (not inlined at build), which is what keeps `vercel deploy --prebuilt` from baking the local machine's value into the deployment.

Any other shared backend (Redis and friends) plugs into the same three-method `RouteCacheStore` type, and nothing else in the route cache changes.

Two Vercel details worth knowing. Route keys are passed to the Runtime Cache percent-encoded rather than through its default hash, which is only 32 bits wide and would eventually serve one page's HTML under another page's URL. And its limits (2&nbsp;MB per item, 128 tags per item, 256 bytes per tag) sit comfortably above what this app stores: bodies are capped at 1&nbsp;MB before encoding, and a page carries about seven short tags. Entries are evicted least-recently-used when the cache fills, and reads and writes are billed.

Freshness is publish-driven only. Publishing a document expires its tags through the webhook the moment it happens; nothing expires on a timer. `CACHE_TTL` in `src/lib/cache.ts` sets a nominal year-long `maxAge` because the cache API requires one, so in practice a cached page lives until a publish busts it.

### A deploy starts a fresh keyspace

Surviving a deploy is only wanted for the *store*, not for the entries. Rendered HTML is a function of code and content, so a release carrying new markup makes every cached page potentially wrong, and no tag is invalidated by a deploy. Common practice on every platform is that rendered-output caches do not cross a release (Vercel's own CDN cache key includes the deployment URL, and its ISR content is regenerated for a new deployment) while data caches do.

`build-partition.ts` restores that by keying. Every entry a build reads or writes is prefixed with that build's id, so a new release looks up its pages in a keyspace nothing has written to yet and misses until it has rendered them itself. Document tags are not prefixed, so a publish still expires every copy of a document, whichever build rendered it.

Keying was chosen over purging on purpose. A purge is a single moment, and a release handover is not: the previous deployment keeps serving, rendering, and storing until the alias moves, and on Vercel the new deployment can take its first request (which is when a once-per-build purge would fire) before that. Anything the old deployment wrote after the purge survived into the new release, and with a year-long `maxAge` only a publish would ever have refreshed it. A partitioned keyspace has no such window.

The build id is `__ROUTE_CACHE_BUILD_ID__`, a compile-time constant that `astro.config.mjs` bakes into the bundle through `vite.define`. Vercel's `VERCEL_DEPLOYMENT_ID` would have been the obvious source and is the wrong one: the whole system-variable set is gated behind the project's **Enable access to System Environment Variables** checkbox, so with it off the variable is simply absent and every release would silently share one keyspace. A baked-in constant cannot be switched off from a dashboard, behaves identically on every host, and tracks the thing that actually invalidates cached HTML, which is the code changing rather than a deployment happening. A rebuild of unchanged code gets a new id, and so does promoting or rolling back to an older deployment, which is the safe direction.

Retired entries are swept, not left to age out. Every entry also carries a `route-cache:build:<id>` tag, and a marker in the cache records the build serving now and the one it replaced. On its first read or write, each instance reads the marker: a build it has not seen advances it, and then it expires the previous build's tag. Every instance sweeps, not only the first of a release, because the deployment being replaced keeps storing until the alias moves; a later cold start of the new build catches whatever it wrote after the first sweep. The marker moves before the sweep runs, so a sweep that fails is retried under the same previous build on the next request. `/api/cache-purge` still empties everything, across builds, through the `route-cache:all` tag every entry carries.

What survives a deploy, then, is the *warm store shared across instances*, not stale HTML. The in-process store gives neither: it is per-instance, so the webhook only ever reaches the one that receives it and every new instance starts cold regardless.

## The webhook

`/api/revalidate` (`src/pages/api/revalidate.ts`) verifies the request signature with `@sanity/webhook` and `SANITY_REVALIDATE_SECRET`, then invalidates `[_type, doc:<id>, uri]` for the published document.

Create the webhook once per project at [sanity.io/manage](https://www.sanity.io/manage) (API, Webhooks):

- **URL**: `<your-site>/api/revalidate`
- **Trigger on**: create, update, delete
- **Projection**: `{_id, _type, "uri": uri.current}`
- **Secret**: the value of `SANITY_REVALIDATE_SECRET` in your deployment environment

`SANITY_REVALIDATE_SECRET` is optional: skip the webhook entirely and the build still passes. Leave it unset and `/api/revalidate` answers 500. Without it, a published change reaches a cached route only on the next deploy, since a new build reads a fresh keyspace. The same applies once the secret is set but the webhook is not yet registered in Sanity, so setting up the webhook is the step that makes publishing live without a redeploy.

Note: the webhook expires tags in the app's own store. On Vercel that is one shared cache and the call reaches every instance; on the in-process store it only reaches the instance that receives it. See **Where entries are stored** above.

## Clearing the whole cache

Publishing is the normal way to refresh content, and a deploy starts a fresh keyspace on its own. `/api/cache-purge` is the escape hatch for the case neither covers: the cache itself looks wrong and you want everything gone without shipping a release.

```bash
curl -X POST -H "Origin: https://<site>" -H "Authorization: Bearer $SANITY_REVALIDATE_SECRET" https://<site>/api/cache-purge
```

It reuses `SANITY_REVALIDATE_SECRET` rather than introducing a second one. Both endpoints do exactly one thing, bust cache, so sharing the secret grants no capability its holder does not already have: anyone with it can already forge a webhook signature and purge by tag. If you ever want them separated, the endpoint reads one env var and nothing else depends on that choice.

Mechanically it is not a special path through the store. Every stored entry carries `ROUTE_CACHE_ALL_TAG` (`route-cache:all`) alongside its document tags, so purging is the same `expireTag` call every publish makes, just with a tag that matches everything. Gated and public entries go together.

Its reach follows the store. On Vercel one call clears the whole environment. On the in-process store it clears **the instance that receives the request**, like the webhook does, so a scaled-out deployment needs one call per instance. Either way a redeploy also empties everything, which remains the guaranteed reset if the endpoint itself is the thing misbehaving.

## The Sanity CDN

Published reads go through Sanity's API CDN in every environment (`src/sanity/lib/client.ts`). A route-cache miss, which after a deploy is every page's first render, reads from the CDN's edge instead of the live API: faster, cheaper (cached CDN responses are not rate limited and sit in the cheap tier; only misses reach the API), and warm across deploys, since the CDN keys on the request rather than on the build.

The CDN is only safe because freshness never depends on it. Sanity invalidates its CDN when content changes, but with no guarantee of when, and the render that follows a publish would store whatever it read for a year. So every published read carries a **content version** as an extra GROQ parameter (`$contentVersion`, which no query uses). The API CDN keys on the full URL, parameters included, and on the POST body for long queries, so a value it has never seen is a miss by construction: that read goes to origin, and every later read under the same version reuses the CDN copy.

The version lives beside the route cache's build marker (`route-cache:content-version` in the Runtime Cache on Vercel, per process elsewhere), outside any build's keyspace and untagged, so a deploy, a sweep and a purge all leave it alone (`src/lib/content-version.ts`, policy in `src/lib/route-cache/content-version.ts`). It changes in exactly two places:

- `/api/revalidate` bumps it **before** expiring the document's tags. A render slotted between the two steps then reads the new version; the other order would let it store a CDN-stale page that nothing expires again.
- `/api/cache-purge` bumps it too, so a suspect cache re-renders from origin rather than from whatever the CDN holds.

Reads of the version are deduped while one is in flight, so a page render that fans out into a dozen queries costs one store read, but never memoized across requests: a request arriving after a bump cannot be answered with the version from before it.

What it costs: after a publish, each page that publish expires re-renders with every one of its queries missing the CDN once. Pages the publish did not touch stay in the route cache and never re-run their queries. After a deploy, every page renders once from the CDN under the unchanged version. Draft-mode reads pin `useCdn: false` and carry no version, so editors always read the live API.

## Where caching also exists

- **Middleware state reads.** The Basic Auth and agent-Markdown eligibility reads query the **live** Sanity API behind a 5-minute per-instance stale-while-revalidate hot cache with in-flight dedupe (`src/features/auth/sanity-basic-auth-proxy.ts`, `src/features/agents/markdown-proxy-state.ts`). Five minutes is the propagation ceiling for those toggles; see [Basic Auth](../features/basic-auth.md).
- **HTTP cache headers.** The `llms.txt` and `sitemap.xml` responses carry `s-maxage=3600, stale-while-revalidate=86400` for CDN caching; the agent-Markdown serve route sends `max-age=0, must-revalidate` plus `Vary: Accept` so shared caches never serve the wrong representation.
- **Sanity API CDN.** Published reads use it in every environment, kept fresh by the content version described above. Draft-mode reads and the preview-url handshake pin `useCdn: false`.

## Redirects Are Build-Time

Redirects are fetched in `astro.config.mjs` (`fetchRedirects()`) and baked into the build.

Implications:

- Updating redirects in Sanity does not hot-update a running server
- A rebuild/redeploy is required for redirect changes to apply. The Settings document's **Redirects** field renders a **Redeploy site** button (`sanity/inputs/redeploy-input.tsx`); it is a placeholder that logs a warning and shows a toast until you attach your project's rebuild trigger in `handleRedeploy` (a deploy hook, a GitHub `workflow_dispatch`, a box-local script). See [Deployment](../deployment.md).
