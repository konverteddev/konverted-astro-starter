// The storage half of the route cache: key-value with tag expiry. In-memory by default; ./vercel-store.ts
// implements the same three methods, and any other shared backend plugs in the same way.

import type { RouteCacheEntry } from "./entry";

export type RouteCacheStore = {
  name: string;
  get(key: string): Promise<RouteCacheEntry | null>;
  set(key: string, entry: RouteCacheEntry, options: { ttl: number; tags: string[] }): Promise<void>;
  expireTag(tags: string[]): Promise<void>;
};

type StoredEntry = {
  entry: RouteCacheEntry;
  expiresAt: number;
  tags: string[];
};

/** Keeps the cache bounded on small servers: pathologically large pages evict early rather than filling `max` entries. */
export const MEMORY_STORE_MAX_BODY_CHARS = 64 * 1024 * 1024;

/** In-process LRU with a tag index. Per instance: an instance only sees its own writes and purges. */
export function createMemoryStore(max = 1000, maxBodyChars = MEMORY_STORE_MAX_BODY_CHARS): RouteCacheStore {
  const entries = new Map<string, StoredEntry>();
  const tagIndex = new Map<string, Set<string>>();
  let bodyChars = 0;

  function remove(key: string): void {
    const stored = entries.get(key);

    if (!stored) {
      return;
    }

    entries.delete(key);
    bodyChars -= stored.entry.body.length;

    for (const tag of stored.tags) {
      const keys = tagIndex.get(tag);
      keys?.delete(key);

      if (keys?.size === 0) {
        tagIndex.delete(tag);
      }
    }
  }

  return {
    name: "memory",
    async get(key) {
      const stored = entries.get(key);

      if (!stored) {
        return null;
      }

      if (Date.now() >= stored.expiresAt) {
        remove(key);

        return null;
      }

      // LRU touch: re-insertion moves the key to the back of the eviction order.
      entries.delete(key);
      entries.set(key, stored);

      return stored.entry;
    },
    async set(key, entry, { ttl, tags }) {
      remove(key);

      while (entries.size >= max || (entries.size > 0 && bodyChars + entry.body.length > maxBodyChars)) {
        const oldest = entries.keys().next().value;

        if (oldest === undefined) {
          break;
        }

        remove(oldest);
      }

      entries.set(key, { entry, expiresAt: Date.now() + ttl * 1000, tags });
      bodyChars += entry.body.length;

      for (const tag of tags) {
        let keys = tagIndex.get(tag);

        if (!keys) {
          keys = new Set();
          tagIndex.set(tag, keys);
        }

        keys.add(key);
      }
    },
    async expireTag(tags) {
      for (const tag of tags) {
        for (const key of [...(tagIndex.get(tag) ?? [])]) {
          remove(key);
        }
      }
    },
  };
}
