// The partition is what keeps a deploy from serving the previous release's HTML, and the sweep is
// what keeps retired releases from piling up in a store that never forgets on its own.

import assert from "node:assert/strict";
import { test } from "node:test";
import { type BuildMarker, buildTag, withBuildKeys, withBuildSweep } from "./build-partition";
import type { RouteCacheEntry } from "./entry";
import { createMemoryStore } from "./store";

const ENTRY: RouteCacheEntry = { status: 200, headers: [], body: "aGk=" };

test("a build reads and writes under its own prefix and tags every entry with itself", async () => {
  const shared = createMemoryStore();
  const store = withBuildKeys(shared, "build_a");

  await store.set("a", ENTRY, { ttl: 60, tags: ["doc:abc"] });

  assert.deepEqual(await shared.get("build_a:a"), ENTRY);
  assert.equal(await shared.get("a"), null);

  await shared.expireTag([buildTag("build_a")]);
  assert.equal(await store.get("a"), null, "the build tag must reach the entry");
});

test("a new build never sees what the previous one rendered, while a publish still reaches both", async () => {
  const shared = createMemoryStore();
  const previous = withBuildKeys(shared, "build_old");
  const next = withBuildKeys(shared, "build_new");

  await previous.set("a", ENTRY, { ttl: 60, tags: ["doc:abc"] });

  assert.equal(await next.get("a"), null, "the old build's render must not leak into the new one");
  assert.deepEqual(await previous.get("a"), ENTRY);

  await next.expireTag(["doc:abc"]);
  assert.equal(await previous.get("a"), null, "tags are not partitioned, so the old copy is expired too");
});

function harness({
  marker,
  buildId = "build_new",
  fail = false,
}: {
  marker?: BuildMarker;
  buildId?: string;
  fail?: boolean;
} = {}) {
  const shared = createMemoryStore();
  let stored: BuildMarker | null = marker ?? null;
  const calls: string[] = [];

  const store = withBuildSweep(withBuildKeys(shared, buildId), {
    buildId,
    readMarker: async () => {
      calls.push("read");

      if (fail) {
        throw new Error("cache unavailable");
      }

      return stored;
    },
    writeMarker: async (next) => {
      calls.push("write");
      stored = next;
    },
  });

  const seed = (id: string) => withBuildKeys(shared, id).set("a", ENTRY, { ttl: 60, tags: [] });
  const has = (id: string) => withBuildKeys(shared, id).get("a");

  return { store, calls, seed, has, marker: () => stored };
}

test("a new build retires the previous one and records the handover", async () => {
  const { store, seed, has, marker } = harness({ marker: { current: "build_old", previous: "build_older" } });

  await seed("build_old");
  await store.get("a");

  assert.equal(await has("build_old"), null, "the previous build's entries should be gone");
  assert.deepEqual(marker(), { current: "build_new", previous: "build_old" });
});

test("every instance of the same build sweeps the previous one again", async () => {
  const { store, seed, has, calls } = harness({ marker: { current: "build_new", previous: "build_old" } });

  await seed("build_old");
  await seed("build_new");
  await store.get("a");

  assert.equal(await has("build_old"), null, "a straggler stored during the handover is caught later");
  assert.deepEqual(await has("build_new"), ENTRY, "the current build's entries are untouched");
  assert.deepEqual(calls, ["read"], "the marker is already current, so nothing is written");
});

test("the first build ever has nothing to sweep", async () => {
  const { store, marker } = harness();

  await store.get("a");

  assert.deepEqual(marker(), { current: "build_new" });
});

test("sweeps once per instance, however many requests race it", async () => {
  const { store, calls } = harness({ marker: { current: "build_old" } });

  await Promise.all([store.get("a"), store.get("b"), store.set("c", ENTRY, { ttl: 60, tags: [] })]);
  await store.get("d");

  assert.equal(calls.filter((call) => call === "read").length, 1);
});

test("a failed sweep is retried rather than remembered", async () => {
  const { store, calls } = harness({ marker: { current: "build_old" }, fail: true });

  await store.get("a");
  await store.get("a");

  assert.equal(calls.filter((call) => call === "read").length, 2);
});
