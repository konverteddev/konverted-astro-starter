// Rides on every published query as an unused GROQ parameter. Sanity's CDN keys on the full URL, so a
// value it has never seen is a guaranteed miss: freshness is this value, never the CDN's own invalidation.

export const CONTENT_VERSION_PARAM = "contentVersion";

/** What a fresh store answers before the first publish has ever bumped it. */
export const INITIAL_CONTENT_VERSION = "0";

export type ContentVersionStore = {
  get(): Promise<string | null>;
  set(version: string): Promise<void>;
};

export type ContentVersion = {
  read(): Promise<string>;
  bump(): Promise<string>;
};

/** Per process, like the in-memory route cache: a bump only reaches the instance that received it. */
export function createMemoryVersionStore(): ContentVersionStore {
  let version: string | null = null;

  return {
    get: async () => version,
    set: async (next) => {
      version = next;
    },
  };
}

/** Sortable by time so a value is legible in logs; the suffix separates publishes within one tick. */
export function nextContentVersion(now = Date.now()): string {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Deduped while in flight, never memoized, so a request arriving after a bump cannot be answered with the version before it. */
export function createContentVersion(store: ContentVersionStore): ContentVersion {
  let pending: Promise<string> | null = null;

  async function readOnce(): Promise<string> {
    try {
      return (await store.get()) ?? INITIAL_CONTENT_VERSION;
    } finally {
      pending = null;
    }
  }

  return {
    read() {
      if (!pending) {
        pending = readOnce();
      }

      return pending;
    },
    async bump() {
      const version = nextContentVersion();

      await store.set(version);

      return version;
    },
  };
}
