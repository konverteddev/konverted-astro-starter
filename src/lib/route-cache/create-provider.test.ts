// Exercises the full provider flow the way Astro's pipeline drives it. The provider does no background
// work, so these tests are the contract for both a long-lived Node process and a serverless function.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import type { CacheOptions, CacheProvider } from "astro";
import { basicAuthorizationHeader } from "~/features/auth/basic-auth";
import { createRouteCacheProvider, ROUTE_CACHE_ALL_TAG } from "./create-provider";
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

const AUTH_HEADER = basicAuthorizationHeader("editor", "s3cret");

function makeProvider(): CacheProvider {
  return createRouteCacheProvider({
    store: createMemoryStore(),
    getExpectedAuthorization: () => AUTH_HEADER,
  });
}

type ServeInput = {
  provider: CacheProvider;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  options?: CacheOptions | false;
  renders?: { count: number };
};

/** Drives one request the way Astro's pipeline would, applying cache options against the same Request instance. */
async function serve({
  provider,
  url = "https://example.com/about",
  method = "GET",
  headers = {},
  body = "rendered",
  status = 200,
  responseHeaders = {},
  options = { maxAge: 60, tags: ["page", "doc:about"] },
  renders,
}: ServeInput): Promise<Response> {
  const request = new Request(url, { method, headers });

  const next = async () => {
    if (renders) {
      renders.count++;
    }

    if (options !== false) {
      provider.setHeaders?.(options, request);
    }

    return new Response(body, { status, headers: responseHeaders });
  };

  const onRequest = provider.onRequest;

  assert.ok(onRequest);

  // Astro hands middleware a runtime logger; the provider never logs, so a silent one satisfies the contract.
  const logger = { info() {}, warn() {}, error() {} };

  return onRequest({ request, url: new URL(url), logger }, next);
}

test("caches out of the box: first request MISS renders, second is a HIT with the same body", async () => {
  const provider = makeProvider();
  const renders = { count: 0 };

  const first = await serve({ provider, renders, body: "v1" });

  assert.equal(first.headers.get("X-Astro-Cache"), "MISS");
  assert.equal(await first.text(), "v1");

  const second = await serve({ provider, renders, body: "v2 (must not render)" });

  assert.equal(second.headers.get("X-Astro-Cache"), "HIT");
  assert.equal(await second.text(), "v1");
  assert.equal(renders.count, 1);
});

test("past the TTL the entry is gone and the next request renders fresh", async () => {
  const provider = makeProvider();
  const renders = { count: 0 };

  await serve({ provider, renders, body: "old" });

  now += 61_000; // past maxAge

  const response = await serve({ provider, renders, body: "new" });

  assert.equal(response.headers.get("X-Astro-Cache"), "MISS");
  assert.equal(await response.text(), "new");
  assert.equal(renders.count, 2);
});

test("the webhook path: invalidating a tag or a path expires the entry", async () => {
  const provider = makeProvider();

  await serve({ provider, body: "v1", url: "https://example.com/about" });
  await serve({ provider, body: "v1", url: "https://example.com/blog/post", options: { maxAge: 60, tags: ["article"] } });

  await provider.invalidate({ tags: ["doc:about"] });
  await provider.invalidate({ path: "/blog/post" });

  const about = await serve({ provider, body: "v2", url: "https://example.com/about" });
  const post = await serve({ provider, body: "v2", url: "https://example.com/blog/post" });

  assert.equal(about.headers.get("X-Astro-Cache"), "MISS");
  assert.equal(post.headers.get("X-Astro-Cache"), "MISS");
});

test("gated and public entries never mix", async () => {
  const provider = makeProvider();

  const gatedFirst = await serve({
    provider,
    body: "secret page",
    headers: { authorization: AUTH_HEADER ?? "" },
  });

  assert.equal(gatedFirst.headers.get("X-Astro-Cache"), "MISS");

  // Same URL without credentials must not receive the gated copy.
  const publicRequest = await serve({ provider, body: "public render" });

  assert.equal(publicRequest.headers.get("X-Astro-Cache"), "MISS");
  assert.equal(await publicRequest.text(), "public render");

  // The gated visitor gets their cached copy back.
  const gatedSecond = await serve({
    provider,
    body: "unused",
    headers: { authorization: AUTH_HEADER ?? "" },
  });

  assert.equal(gatedSecond.headers.get("X-Astro-Cache"), "HIT");
  assert.equal(await gatedSecond.text(), "secret page");
});

test("credentials that match nothing skip the cache entirely", async () => {
  const provider = makeProvider();
  const renders = { count: 0 };

  const headers = { authorization: `Basic ${btoa("editor:wrong")}` };

  await serve({ provider, renders, headers });
  const second = await serve({ provider, renders, headers });

  assert.equal(second.headers.get("X-Astro-Cache"), null);
  assert.equal(renders.count, 2);
});

test("draft mode, Markdown negotiation and non-GET requests bypass the cache", async () => {
  const provider = makeProvider();
  const renders = { count: 0 };

  await serve({ provider, renders, headers: { cookie: `${perspectiveCookieName}=drafts` } });
  await serve({ provider, renders, headers: { cookie: `${perspectiveCookieName}=drafts` } });
  await serve({ provider, renders, headers: { accept: "text/markdown" } });
  await serve({ provider, renders, method: "POST" });

  assert.equal(renders.count, 4);
});

test("responses that must not be stored are not stored", async () => {
  const provider = makeProvider();
  const renders = { count: 0 };

  // Non-200, Set-Cookie, and no cache options each render again on the next request.
  await serve({ provider, renders, status: 404, url: "https://example.com/missing" });
  await serve({ provider, renders, status: 404, url: "https://example.com/missing" });

  await serve({ provider, renders, responseHeaders: { "set-cookie": "session=1" }, url: "https://example.com/personal" });
  await serve({ provider, renders, responseHeaders: { "set-cookie": "session=1" }, url: "https://example.com/personal" });

  await serve({ provider, renders, options: false, url: "https://example.com/uncached" });
  await serve({ provider, renders, options: false, url: "https://example.com/uncached" });

  assert.equal(renders.count, 6);
});

test("purging the all-entries tag empties the cache, public and gated alike", async () => {
  const provider = makeProvider();

  await serve({ provider, url: "https://example.com/about", body: "about" });
  await serve({ provider, url: "https://example.com/contact", body: "contact" });
  await serve({ provider, headers: { authorization: AUTH_HEADER ?? "" }, body: "gated" });

  // All three are warm.
  assert.equal((await serve({ provider, url: "https://example.com/about" })).headers.get("X-Astro-Cache"), "HIT");

  await provider.invalidate({ tags: [ROUTE_CACHE_ALL_TAG] });

  for (const url of ["https://example.com/about", "https://example.com/contact"]) {
    assert.equal((await serve({ provider, url })).headers.get("X-Astro-Cache"), "MISS");
  }

  const gated = await serve({ provider, headers: { authorization: AUTH_HEADER ?? "" } });

  assert.equal(gated.headers.get("X-Astro-Cache"), "MISS");
});
