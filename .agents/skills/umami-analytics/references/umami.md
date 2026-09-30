# Umami Tracking Helpers

- **Location**: `src/features/umami/tracking.ts` and `src/features/umami/types.ts`.
- **SSR safety**: Helpers are safe in SSR and no-op when `window.umami` is missing.

## APIs

- `track()` - track current page view.
- `track(payload)` - send custom payload object.
- `track((props) => nextPayload)` - merge defaults via callback.
- `track(eventName)` - track named event.
- `track(eventName, data)` - track named event with typed event data.
- `identify(uniqueId)` / `identify(uniqueId, data)` / `identify(data)` - session identification.

## Data Constraints

- Event/session data values are `string | number | boolean`.
- Keep strings short and objects small.
- Follow Umami constraints documented in `src/features/umami/types.ts` comments.

## Guardrails

- Prefer stable event names (`kebab-case` or `snake_case`) and keep naming consistent.
- Do not access `window.umami` directly in feature code; use helpers.
- Track only meaningful product events (avoid noisy, low-value events).
