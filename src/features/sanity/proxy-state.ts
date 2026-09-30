/**
 * Cached Sanity reads for `src/middleware.ts`, which runs before the route cache and so caches its own.
 * Live API (CDN invalidation is unreliable for membership changes) and `published` pinned: drafts must not gate.
 */

import { run } from "~/features/utils/common";

/** Per-instance hot cache TTL; no cross-instance invalidation exists, so this caps how long a publish takes to reach every instance. */
const HOT_CACHE_TTL_MS = 5 * 60 * 1000;

/** How long past the TTL the last-known state may still be served while a single refresh round-trip runs. */
const STALE_GRACE_MS = 60 * 1000;

/** A hung fetch would wedge `inflight`, and with it every request past the TTL. */
const FETCH_TIMEOUT_MS = 5 * 1000;

/** Passed in by callers (from `~/lib/env`); `astro:env` cannot be imported here or the module stops being unit-testable. */
export type ProxySanityEnv = {
  projectId: string | undefined;
  dataset: string | undefined;
  apiVersion: string | undefined;
  token: string | undefined;
};

async function sanityFetchJson<T>(query: string, env: ProxySanityEnv): Promise<T> {
  const { projectId, dataset, apiVersion, token } = env;

  if (!projectId || !dataset || !apiVersion || !token) {
    throw new Error("Missing Sanity environment for middleware");
  }

  // The live API on purpose: apicdn invalidation is unreliable here, and the hot cache already caps request volume.
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  url.searchParams.set("returnQuery", "false");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Sanity middleware fetch failed: ${res.status}`);
  }

  const body = (await res.json()) as { result: T };
  return body.result;
}

/** A getter over a per-instance hot cache with bounded stale-while-revalidate and in-flight dedupe. */
export function createProxySanityState<TPayload, TState>(
  query: string,
  toState: (payload: TPayload) => TState,
  env: ProxySanityEnv
): () => Promise<TState> {
  let hot: { value: TState; freshUntil: number; staleUntil: number } | null = null;
  let inflight: Promise<TState> | null = null;

  return async function getState(): Promise<TState> {
    const now = Date.now();

    if (hot && now < hot.freshUntil) {
      return hot.value;
    }

    if (!inflight) {
      const refresh = run(async () => {
        try {
          const payload = await sanityFetchJson<TPayload>(query, env);
          const value = toState(payload);

          hot = { value, freshUntil: Date.now() + HOT_CACHE_TTL_MS, staleUntil: Date.now() + HOT_CACHE_TTL_MS + STALE_GRACE_MS };

          return value;
        } finally {
          inflight = null;
        }
      });

      // Stale-serving callers never await this, so without a handler a failed refresh is an unhandled rejection.
      refresh.catch(() => {});
      inflight = refresh;
    }

    // Within the grace window serve the last state and refresh behind it; past it, block like a cold start.
    if (hot && now < hot.staleUntil) {
      return hot.value;
    }

    return inflight;
  };
}
