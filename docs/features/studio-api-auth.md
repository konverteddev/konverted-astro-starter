# Studio API auth

Every API route that backs a Studio feature (Agent Actions, alt text, the SEO screenshot, redeploy and the
like) is callable only by a person signed in to this project's Studio with a write role. The route asks
Sanity who the caller is; it never infers it from the request.

## How it works

1. `sanity.config.ts` sets `auth: { loginMethod: "token" }`. The Studio keeps the session token in
   `localStorage` instead of an httpOnly cookie on `api.sanity.io`, so Studio code can read it. Editors
   sign in again once after this ships.
2. Studio code calls these routes with `useStudioFetch()` or `studioFetch(client, url, init)`
   (`sanity/lib/studio-fetch.ts`), which adds `Authorization: Bearer <token>`.
3. The route's first step is `authorizeStudioRequest(request)` (`src/features/api/auth.ts`, which binds
   `src/features/api/studio-auth.ts` to this project). With that token it asks Sanity two things, in
   parallel:
   - **Can this caller publish content here?** The documented Access API permission list,
     `GET https://api.sanity.io/v2025-07-11/access/project/<projectId>/user-permissions/me`
     ([reference](https://www.sanity.io/docs/http-reference/access-api)). Allowed when it holds
     `sanity.document.filter.mode` in `publish` mode (the built-in administrator, editor and developer
     roles) or `sanity.document.filter` `update` (custom roles). The Access API has its own version:
     it does not exist at older content API versions, so it is pinned there rather than read from env.
   - **Is it a person?** `https://<projectId>.api.sanity.io/v<*_SANITY_API_VERSION>/users/me`. Robot tokens
     report `provider: "sanity-token"`, which is not in Sanity's reference docs, so it is used only to
     refuse robots, never to allow anyone.

| Caller | Result |
| --- | --- |
| No token, whatever `Origin`, `Referer` or `Host` say | `401` |
| Token Sanity does not recognise | `401` |
| Valid Sanity login with no permissions on this project | `403` |
| Project `viewer` (read only) or `contributor` (drafts only) | `403` |
| API (robot) token, even with publish access | `403` |
| Signed-in person with publish access (administrator, editor, developer, or a custom role) | allowed |
| Sanity unreachable | `503`, fails closed |

Verdicts are cached in memory per token for 60 seconds, so a Studio session costs one Sanity round trip
a minute. A removed editor keeps access for at most that long.

## Why the obvious checks fail

- **Origin and Referer prove nothing.** They are request headers. Browsers set them, but curl, scripts and
  servers send any value or none. The previous gate trusted them, and let any request without an `Origin`
  through: every Studio route was open to anyone with curl.
- **"The token is valid" is not enough.** Anyone can create a free Sanity account, and `/users/me` answers
  `200` for that token on any project. What the caller may do on this project is the check, and the
  documented Access API permission list is how to read it.
- **Cookie auth hides the token.** Under the default `dual` login method the session usually lives in a
  cookie on `api.sanity.io`, which this app's server never receives.

## Preview sessions

The Sanity preview cookies (`sanity-preview-perspective`, and on Next.js `__prerender_bypass`) are plain
cookies: a client can set them by hand. Their mere presence used to skip Basic Auth, and on Astro it also switched rendering to drafts.
Now the draft-mode enable route, after Sanity's signed preview secret validates, also sets
`__draft_session`: an httpOnly expiry signed with HMAC-SHA256 (keyed from `SANITY_API_VIEW_TOKEN`, valid 12
hours). Only a valid signature counts as a Studio session (`src/features/auth/draft-session.ts`,
checked in `src/middleware.ts`). The disable route clears it and only redirects to same-origin paths.

## Adding a route

```ts
const denied = await authorizeStudioRequest(request);

if (denied) {
  return denied;
}
```

From the Studio: `const studioFetch = useStudioFetch();` then `await studioFetch("/api/my-route", { ... })`.
Outside React, pass the client from `useClient` to `studioFetch(client, url, init)`.

## Scripting

Send your own Sanity login as a bearer token (`npx sanity login`, then `npx sanity debug --secrets`
prints it). API tokens are refused on purpose.

## Keep the origin free of untrusted script

The session token sits in `localStorage` on the site's origin, so any script running on that origin could
read it. Never render editor or visitor HTML unescaped on the same origin as the Studio.

## Tests

`src/features/api/studio-auth.test.ts` and `src/features/auth/draft-session.test.ts` cover every row above
with a mocked Sanity; run them with `npm test`.
