---
name: umami-analytics
description: Use when implementing or updating analytics instrumentation, especially Umami tracking events, session identification, and SSR-safe usage in Astro runtime code.
---

# Umami analytics

## Core Rules

- Use `track` and `identify` from `~/features/umami/tracking` for app instrumentation.
- Keep usage SSR-safe: the helpers already no-op when `window.umami` is unavailable.
- Use `track()` for page views, `track("event-name")` or `track("event-name", data)` for events.
- Use `identify(uniqueId, data?)` only when session/user identification is intentional and privacy-safe.
- Keep payloads small and within Umami limits (string length, object size, numeric precision).

## Trigger Conditions

Apply this skill when adding or changing **analytics instrumentation**: Umami events, identification, or SSR-safe tracking from Astro runtime code.

## Execution Checklist

1. Confirm the task is analytics/tracking instrumentation.
2. Read `references/umami.md` (see Reference Files).
3. Reuse existing tracker helpers in `src/features/umami/` instead of inline window access.
4. Add only the minimum required events/identification calls.
5. Validate types and call signatures with `npm run check`.

## Scope Guidance

- If the task includes UI behavior plus analytics, this skill can pair with astro.
- If tracking depends on Sanity content contracts, hand off query/schema concerns to sanity.

## Non-Goals

- Defining Sanity schema/GROQ/Studio configuration (use sanity).
- Scaffolding routes/sections/blocks with plop (use scaffolding-plop).
- General animation/scroll behavior unrelated to analytics (use astro / gsap skills).

## Done Criteria

- No direct `window.umami` access outside `src/features/umami/*`
- Tracking calls use typed helper overloads
- Added events are purposeful and named consistently
- Instrumentation is safe when script is absent

## Reference Files

- Read `references/umami.md` for helper API and payload constraints.
- Do not load unrelated reference files.
