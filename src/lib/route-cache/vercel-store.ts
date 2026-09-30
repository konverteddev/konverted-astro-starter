// Vercel's Runtime Cache behind the `RouteCacheStore` seam: the store that survives a deploy, where a
// CDN-backed one starts cold on every release because the cache key includes the deployment URL.

import { getCache } from "@vercel/functions";
import { BUILD_MARKER_KEY, isBuildMarker, withBuildKeys, withBuildSweep } from "./build-partition";
import type { ContentVersionStore } from "./content-version";
import type { RouteCacheEntry } from "./entry";
import type { RouteCacheStore } from "./store";

type RuntimeCache = ReturnType<typeof getCache>;

/** Percent-encoded rather than left to `getCache()`, which hashes to 32 bits: a collision would serve one page's HTML under another's URL. */
function toRuntimeCache(): RuntimeCache {
  return getCache({ keyHashFunction: encodeURIComponent });
}

/** Entries come back as parsed JSON, so a stored shape from an older release is not to be trusted. */
function isEntry(value: unknown): value is RouteCacheEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { status, headers, body } = value as Partial<RouteCacheEntry>;

  return typeof status === "number" && Array.isArray(headers) && typeof body === "string";
}

export function createVercelRuntimeStore(cache: RuntimeCache = toRuntimeCache()): RouteCacheStore {
  return {
    name: "vercel-runtime",
    async get(key) {
      const value = await cache.get(key);

      return isEntry(value) ? value : null;
    },
    async set(key, entry, { ttl, tags }) {
      await cache.set(key, entry, { ttl, tags });
    },
    async expireTag(tags) {
      if (tags.length === 0) {
        return;
      }

      await cache.expireTag(tags);
    },
  };
}

/** The marker and the content version outlive any single release, so they get an entry's nominal lifetime. */
const PERSISTENT_TTL = 31_536_000;

/** Outside every build's keyspace and untagged, so neither a deploy nor a sweep nor a purge resets it. */
const CONTENT_VERSION_KEY = "route-cache:content-version";

export function createVercelVersionStore(cache: RuntimeCache = toRuntimeCache()): ContentVersionStore {
  return {
    async get() {
      const value = await cache.get(CONTENT_VERSION_KEY);

      return typeof value === "string" ? value : null;
    },
    async set(version) {
      await cache.set(CONTENT_VERSION_KEY, version, { ttl: PERSISTENT_TTL });
    },
  };
}

/** Keyed per build: the replaced deployment keeps writing until the alias moves, so a purge cannot close that gap but partitioning has no window. */
export function createVercelRouteCache(buildId: string): RouteCacheStore {
  const cache = toRuntimeCache();

  return withBuildSweep(withBuildKeys(createVercelRuntimeStore(cache), buildId), {
    buildId,
    readMarker: async () => {
      const value = await cache.get(BUILD_MARKER_KEY);

      return isBuildMarker(value) ? value : null;
    },
    writeMarker: async (marker) => {
      await cache.set(BUILD_MARKER_KEY, marker, { ttl: PERSISTENT_TTL });
    },
  });
}
