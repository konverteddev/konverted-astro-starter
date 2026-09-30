import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createProxySanityState, type ProxySanityEnv } from "./proxy-state";

const TTL_MS = 5 * 60 * 1000;
const GRACE_MS = 60 * 1000;

const realFetch = globalThis.fetch;
const realDateNow = Date.now;

let now = 1_000_000;
let fetchCalls: string[] = [];
let nextPayload: unknown = { ok: true };
let failNextFetch = false;

const env: ProxySanityEnv = {
  projectId: "test-project",
  dataset: "test-dataset",
  apiVersion: "2024-01-01",
  token: "test-token",
};

type Payload = { value?: string | null };
type State = { value: string };

function toState(payload: Payload): State {
  return { value: payload.value ?? "missing" };
}

beforeEach(() => {
  now = 1_000_000;
  fetchCalls = [];
  nextPayload = { value: "first" };
  failNextFetch = false;

  Date.now = () => now;
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input));

    if (failNextFetch) {
      failNextFetch = false;
      throw new Error("network down");
    }

    return new Response(JSON.stringify({ result: nextPayload }), { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realDateNow;
});

/** Lets the background refresh promise settle. */
function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("cold call fetches once and transforms the payload", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  const state = await getState();

  assert.deepEqual(state, { value: "first" });
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0] ?? "", /test-project\.api\.sanity\.io/);
  assert.match(fetchCalls[0] ?? "", /perspective=published/);
});

test("fresh cache serves repeat calls without fetching", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  await getState();
  now += TTL_MS - 1000;
  const state = await getState();

  assert.deepEqual(state, { value: "first" });
  assert.equal(fetchCalls.length, 1);
});

test("concurrent cold calls dedupe into one fetch", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  const [a, b, c] = await Promise.all([getState(), getState(), getState()]);

  assert.deepEqual(a, { value: "first" });
  assert.deepEqual(b, { value: "first" });
  assert.deepEqual(c, { value: "first" });
  assert.equal(fetchCalls.length, 1);
});

test("within the grace window, serves stale state and refreshes in the background", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  await getState();
  nextPayload = { value: "second" };
  now += TTL_MS + 1000;

  const stale = await getState();
  assert.deepEqual(stale, { value: "first" });

  await tick();
  const fresh = await getState();
  assert.deepEqual(fresh, { value: "second" });
  assert.equal(fetchCalls.length, 2);
});

test("past TTL + grace, blocks on a fresh fetch like a cold start", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  await getState();
  nextPayload = { value: "second" };
  now += TTL_MS + GRACE_MS + 1000;

  const state = await getState();

  assert.deepEqual(state, { value: "second" });
  assert.equal(fetchCalls.length, 2);
});

test("a failed background refresh degrades to last-known state instead of throwing", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  await getState();
  failNextFetch = true;
  now += TTL_MS + 1000;

  const stale = await getState();
  assert.deepEqual(stale, { value: "first" });

  // The rejected refresh must not surface later as an unhandled rejection.
  await tick();

  // Recovery: the next call in the grace window starts a new refresh that succeeds.
  nextPayload = { value: "recovered" };
  await getState();
  await tick();
  assert.deepEqual(await getState(), { value: "recovered" });
});

test("non-ok response rejects on a cold start", async () => {
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  const getState = createProxySanityState<Payload, State>("*[]", toState, env);

  await assert.rejects(getState, /Sanity middleware fetch failed: 500/);
});

test("missing Sanity env rejects with a named error", async () => {
  const getState = createProxySanityState<Payload, State>("*[]", toState, { ...env, token: undefined });

  await assert.rejects(getState, /Missing Sanity environment for middleware/);
});
