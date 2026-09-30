// The version is what keeps the Sanity CDN honest after a publish, so these pin the two things a
// caller relies on: a bump is always a value the CDN has never seen, and a read never lags a bump.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ContentVersionStore,
  createContentVersion,
  createMemoryVersionStore,
  INITIAL_CONTENT_VERSION,
  nextContentVersion,
} from "./content-version";

function countingStore(): ContentVersionStore & { reads: number } {
  const inner = createMemoryVersionStore();

  const store = {
    reads: 0,
    async get() {
      store.reads += 1;

      return inner.get();
    },
    set: inner.set,
  };

  return store;
}

test("a fresh store answers the initial version", async () => {
  assert.equal(await createContentVersion(createMemoryVersionStore()).read(), INITIAL_CONTENT_VERSION);
});

test("a bump is a new value and the next read returns it", async () => {
  const version = createContentVersion(createMemoryVersionStore());

  const first = await version.bump();
  assert.equal(await version.read(), first);

  const second = await version.bump();
  assert.notEqual(second, first);
  assert.equal(await version.read(), second);
});

test("two bumps in the same millisecond still differ", () => {
  assert.notEqual(nextContentVersion(1), nextContentVersion(1));
});

test("concurrent reads share one store read, and nothing is kept once it settles", async () => {
  const store = countingStore();
  const version = createContentVersion(store);

  await Promise.all([version.read(), version.read(), version.read()]);
  assert.equal(store.reads, 1, "a render's fan-out should cost one read");

  await version.read();
  assert.equal(store.reads, 2, "a later request must read again, so it can never miss a bump");
});

test("a read after a bump never returns the value from before it", async () => {
  const store = countingStore();
  const version = createContentVersion(store);

  await version.read();
  const bumped = await version.bump();

  assert.equal(await version.read(), bumped);
});
