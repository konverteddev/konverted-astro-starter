// Entries are keyed and tagged by the build that rendered them, which is what keeps a deploy from serving
// the previous release's HTML; the sweep of the retired build is storage hygiene.

import type { RouteCacheStore } from "./store";

/** Records the build serving now and the one it replaced. Stored without tags, so no sweep can take it. */
export const BUILD_MARKER_KEY = "route-cache:build";

export type BuildMarker = { current: string; previous?: string };

export function buildTag(buildId: string): string {
  return `route-cache:build:${buildId}`;
}

export function isBuildMarker(value: unknown): value is BuildMarker {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { current, previous } = value as Partial<BuildMarker>;

  return typeof current === "string" && (previous === undefined || typeof previous === "string");
}

export function withBuildKeys(store: RouteCacheStore, buildId: string): RouteCacheStore {
  const prefix = `${buildId}:`;
  const tag = buildTag(buildId);

  return {
    name: store.name,
    get: (key) => store.get(prefix + key),
    set: (key, entry, options) => store.set(prefix + key, entry, { ...options, tags: [...options.tags, tag] }),
    expireTag: (tags) => store.expireTag(tags),
  };
}

export type BuildSweepDeps = {
  buildId: string;
  readMarker: () => Promise<BuildMarker | null>;
  writeMarker: (marker: BuildMarker) => Promise<void>;
};

/** Every instance sweeps, not just the first: the replaced deployment keeps writing until the alias moves. */
export function withBuildSweep(store: RouteCacheStore, { buildId, readMarker, writeMarker }: BuildSweepDeps): RouteCacheStore {
  let pending: Promise<void> | null = null;

  async function sweep(): Promise<void> {
    const marker = await readMarker();
    let previous = marker?.previous;

    if (marker?.current !== buildId) {
      previous = marker?.current;
      await writeMarker(previous ? { current: buildId, previous } : { current: buildId });
    }

    if (previous) {
      await store.expireTag([buildTag(previous)]);
    }
  }

  function ensureSwept(): Promise<void> {
    if (!pending) {
      pending = sweep().catch((error: unknown) => {
        console.error("route-cache: build sweep failed", error);
        pending = null;
      });
    }

    return pending;
  }

  return {
    name: store.name,
    async get(key) {
      await ensureSwept();

      return store.get(key);
    },
    async set(key, entry, options) {
      await ensureSwept();

      return store.set(key, entry, options);
    },
    expireTag: (tags) => store.expireTag(tags),
  };
}
