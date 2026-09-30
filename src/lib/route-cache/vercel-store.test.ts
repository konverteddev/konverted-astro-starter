// The store is a thin adapter over Vercel's RuntimeCache, so these cover the mapping: what a
// runtime cache call receives, and what a value coming back out of it is allowed to become.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { getCache } from "@vercel/functions";
import type { RouteCacheEntry } from "./entry";
import { createVercelRuntimeStore } from "./vercel-store";

type RuntimeCache = ReturnType<typeof getCache>;
type SetCall = { key: string; value: unknown; options: Parameters<RuntimeCache["set"]>[2] };

function fakeCache(stored: unknown = null) {
  const sets: SetCall[] = [];
  const gets: string[] = [];
  const expired: (string | string[])[] = [];

  const cache: RuntimeCache = {
    async get(key) {
      gets.push(key);

      return stored;
    },
    async set(key, value, options) {
      sets.push({ key, value, options });
    },
    async delete() {},
    async expireTag(tag) {
      expired.push(tag);
    },
  };

  return { cache, sets, gets, expired };
}

const ENTRY: RouteCacheEntry = { status: 200, headers: [["content-type", "text/html"]], body: "aGk=" };

test("passes the route key through untouched, so two routes cannot collide", async () => {
  const { cache, gets, sets } = fakeCache();
  const store = createVercelRuntimeStore(cache);
  const key = "public:astro-route:https://example.com/blog/post?page=2";

  await store.get(key);
  await store.set(key, ENTRY, { ttl: 60, tags: [] });

  assert.deepEqual(gets, [key]);
  assert.equal(sets[0]?.key, key);
});

test("forwards the entry with its ttl and tags", async () => {
  const { cache, sets } = fakeCache();
  const store = createVercelRuntimeStore(cache);

  await store.set("a", ENTRY, { ttl: 31536000, tags: ["site", "doc:abc"] });

  assert.deepEqual(sets, [{ key: "a", value: ENTRY, options: { ttl: 31536000, tags: ["site", "doc:abc"] } }]);
});

test("returns a stored entry unchanged", async () => {
  const { cache } = fakeCache(ENTRY);

  assert.deepEqual(await createVercelRuntimeStore(cache).get("a"), ENTRY);
});

test("treats a missing or unrecognized value as a miss", async () => {
  for (const value of [null, "html", { status: 200 }, { status: "200", headers: [], body: "" }]) {
    assert.equal(await createVercelRuntimeStore(fakeCache(value).cache).get("a"), null, `for ${JSON.stringify(value)}`);
  }
});

test("expires every tag in one call, and skips the call when there are none", async () => {
  const { cache, expired } = fakeCache();
  const store = createVercelRuntimeStore(cache);

  await store.expireTag([]);
  assert.deepEqual(expired, []);

  await store.expireTag(["doc:abc", "route-cache:all"]);
  assert.deepEqual(expired, [["doc:abc", "route-cache:all"]]);
});
