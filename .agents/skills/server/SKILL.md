---
name: server
description: Server-side conventions for Astro API endpoints, which live in `src/pages/api/` (file-based routing, served at `/api/*`). Endpoints export `prerender = false` and a typed `APIRoute`, return `{ ok }` JSON via a local `json()` helper, validate parsed bodies, and gate Studio-triggered callers with `authorizeStudioRequest` (public forms use validation plus a honeypot instead). Env comes from `src/lib/env.ts` (secrets server-only); email via Resend is best-effort; cached GET endpoints declare tags via `context.cache`. Use when adding or editing an endpoint or email logic.
---

# Server endpoints

The backend is a handful of Astro endpoints plus framework-free helpers in `src/lib/` and `src/features/`. Everything runs on the always-on Node server.

## Core Rules

- Endpoints live in `src/pages/api/` and are routed by Astro's file-based routing (`src/pages/api/contact-form.ts` serves `/api/contact-form`; rest params like `agent-markdown/[...uri].ts` work as usual).
- Export `const prerender = false` and a typed `APIRoute` (`GET`/`POST`).
- Return JSON shaped `{ ok: true, ... }` or `{ ok: false, error }` through a local `json()` helper. Parse the body in a try/catch and return 400 on bad input.
- Status codes: 200 success, 400 validation, 401 unauthorized, 404 not found, 500 missing config, 502 upstream failure.
- Gate Studio-triggered endpoints (AI generation, screenshots, redeploy) with `const denied = await authorizeStudioRequest(request); if (denied) return denied;` from `~/features/api/auth`, and call them from the Studio with `useStudioFetch()` (`sanity/lib/studio-fetch.ts`). Never gate on `Origin` or `Referer` (see `docs/features/studio-api-auth.md`). Public endpoints (the contact form) are not origin-gated; they rely on Zod validation plus the honeypot and timing checks (`~/features/spam-prevention`).
- Read env from `src/lib/env.ts` (re-exports `astro:env`); secrets are server-only and must never reach the client. Check required env at use and return 500 if missing.
- Build absolute URLs (sitemap `<loc>`, `robots.txt`, agent Markdown links) with `absoluteUrl(path)` from `~/lib/env`, never by concatenating `PUBLIC_SITE_URL`. See `astro`.
- Cacheable GET endpoints declare TTL and tags via `context.cache.set` using `CACHE_TTL`/tags from `src/lib/cache.ts`; write endpoints never call it. The `/api/revalidate` webhook invalidates tags (see docs/sanity/revalidation-and-caching.md).
- Side effects like email are best-effort: complete the primary task first, then attempt the side effect, and report partial success rather than failing the whole request.

## Trigger Conditions

Apply when adding or editing an endpoint in `src/pages/api/`, the auth/env helpers, or Resend email.

## Execution Checklist

1. Create the endpoint file under `src/pages/api/`; export `prerender = false` and a typed `APIRoute`.
2. Add a local `json()` helper; parse and validate the body, returning 400 on failure.
3. Gate Studio-triggered endpoints with `authorizeStudioRequest`; for public ones, validate and honour the spam checks.
4. Read env from `src/lib/env.ts`; check required values and return 500 if absent.
5. If the response is cacheable, set `context.cache` TTL and tags from `src/lib/cache.ts`.
6. Log failures server-side; keep user-facing errors short and free of internals.

## Scope Guidance

- This skill owns endpoint shape, validation, auth, env, email, and endpoint caching.
- Page routes, layouts, and page-level fetching: `astro`.
- Reading Sanity inside an endpoint (settings, recipients): `sanity`.
- The browser side that fetches an endpoint: `custom-elements`.

## Non-Goals

- Exposing a server secret to the client.
- Failing the main task when a best-effort side effect (email) fails.
- Trusting request-body values for recipients or permissions (read them from Sanity).

## Done Criteria

- Endpoint is in `src/pages/api/`, exports `prerender = false` and a typed `APIRoute`, and returns `{ ok }` JSON with correct status codes.
- Input is validated; Studio-triggered endpoints are origin-gated, public ones use the spam checks.
- Env is read from `src/lib/env.ts` with use-time checks; no secret leaks.

## Reference Files

- `src/pages/api/contact-form.ts`: public endpoint, Zod validation, honeypot + timing, Sanity write, best-effort Resend email.
- `src/pages/api/agents/llms-txt.ts`, `agents/page-markdown.ts`: origin-gated Studio AI generation.
- `src/pages/api/agent-markdown/[...uri].ts`: cached GET with uri tags, serves stored Markdown.
- `src/pages/api/revalidate.ts`: signed Sanity webhook, tag invalidation.
- `src/pages/api/cache-purge.ts`: empties the whole route cache; bearer-authenticated with `SANITY_REVALIDATE_SECRET`.
- `src/pages/api/draft-mode/enable.ts`, `disable.ts`: preview cookie handshake (redirects).
- `src/pages/api/agents/image-alt-text.ts`, `src/pages/api/seo-screenshot.ts`: the other Studio-triggered endpoints.
- `src/features/api/auth.ts`: `authorizeStudioRequest`, the Studio gate (verified Sanity session plus publish access, read from the documented Access API; core in `studio-auth.ts`).
