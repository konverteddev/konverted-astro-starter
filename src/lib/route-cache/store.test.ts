import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { RouteCacheEntry } from "./entry";
import { createMemoryStore } from "./store";

const realDateNow = Date.now;

let now = 1_000_000;

beforeEach(() => {
  now = 1_000_000;
  Date.now = () => now;
});

afterEach(() => {
  Date.now = realDateNow;
});

function entry(marker: string): RouteCacheEntry {
  return { status: 200, headers: [], body: marker };
}

test("stores and returns an entry until its TTL passes", async () => {
  const store = createMemoryStore();

  await store.set("a", entry("a"), { ttl: 60, tags: [] });
  assert.deepEqual(await store.get("a"), entry("a"));

  now += 59_000;
  assert.deepEqual(await store.get("a"), entry("a"));

  now += 2_000;
  assert.equal(await store.get("a"), null);
});

test("expireTag removes every key under the tag and nothing else", async () => {
  const store = createMemoryStore();

  await store.set("/", entry("home"), { ttl: 60, tags: ["site", "doc:homepage"] });
  await store.set("/about", entry("about"), { ttl: 60, tags: ["site", "doc:about"] });
  await store.set("/blog/post", entry("post"), { ttl: 60, tags: ["article", "doc:post"] });

  await store.expireTag(["doc:about"]);

  assert.deepEqual(await store.get("/"), entry("home"));
  assert.equal(await store.get("/about"), null);
  assert.deepEqual(await store.get("/blog/post"), entry("post"));

  await store.expireTag(["site"]);

  assert.equal(await store.get("/"), null);
  assert.deepEqual(await store.get("/blog/post"), entry("post"));
});

test("overwriting a key replaces its tags", async () => {
  const store = createMemoryStore();

  await store.set("a", entry("v1"), { ttl: 60, tags: ["old"] });
  await store.set("a", entry("v2"), { ttl: 60, tags: ["new"] });

  await store.expireTag(["old"]);
  assert.deepEqual(await store.get("a"), entry("v2"));

  await store.expireTag(["new"]);
  assert.equal(await store.get("a"), null);
});

test("evicts the least recently used entry at capacity", async () => {
  const store = createMemoryStore(2);

  await store.set("a", entry("a"), { ttl: 60, tags: ["t"] });
  await store.set("b", entry("b"), { ttl: 60, tags: ["t"] });

  // Touch "a" so "b" is the eviction candidate.
  await store.get("a");
  await store.set("c", entry("c"), { ttl: 60, tags: ["t"] });

  assert.deepEqual(await store.get("a"), entry("a"));
  assert.equal(await store.get("b"), null);
  assert.deepEqual(await store.get("c"), entry("c"));

  // Expiring the tag then re-adding under none proves no stale index entry resurrects or double-deletes.
  await store.expireTag(["t"]);
  assert.equal(await store.get("a"), null);
  assert.equal(await store.get("c"), null);
});

test("expiring an unknown tag is a no-op", async () => {
  const store = createMemoryStore();

  await store.set("a", entry("a"), { ttl: 60, tags: [] });
  await store.expireTag(["missing"]);

  assert.deepEqual(await store.get("a"), entry("a"));
});

test("evicts oldest entries when the body budget is exceeded", async () => {
  // Budget of 100 chars: two 40-char bodies fit, the third evicts the oldest.
  const store = createMemoryStore(1000, 100);
  const big = (marker: string) => entry(marker.repeat(40).slice(0, 40));

  await store.set("a", big("a"), { ttl: 60, tags: [] });
  await store.set("b", big("b"), { ttl: 60, tags: [] });
  await store.set("c", big("c"), { ttl: 60, tags: [] });

  assert.equal(await store.get("a"), null);
  assert.deepEqual(await store.get("b"), big("b"));
  assert.deepEqual(await store.get("c"), big("c"));

  // The budget follows evictions: writing "a" back pushes the oldest survivor out in its place.
  await store.set("a", big("a"), { ttl: 60, tags: [] });

  assert.equal(await store.get("b"), null);
  assert.deepEqual(await store.get("a"), big("a"));
  assert.deepEqual(await store.get("c"), big("c"));
});
