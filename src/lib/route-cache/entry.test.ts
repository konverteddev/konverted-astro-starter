import assert from "node:assert/strict";
import { test } from "node:test";
import { ENTRY_MAX_BYTES, entryKey, entryTtl, toEntry, toResponse } from "./entry";

test("entryKey ignores query parameter order", () => {
  assert.equal(entryKey(new URL("https://example.com/blog?b=2&a=1")), entryKey(new URL("https://example.com/blog?a=1&b=2")));
});

test("entryKey ignores tracking parameters but keeps content ones", () => {
  const bare = entryKey(new URL("https://example.com/blog"));

  assert.equal(entryKey(new URL("https://example.com/blog?utm_source=x&utm_campaign=y&fbclid=abc&ref=news")), bare);
  assert.notEqual(entryKey(new URL("https://example.com/blog?category=engineering")), bare);
  assert.equal(
    entryKey(new URL("https://example.com/blog?category=engineering&gclid=123")),
    entryKey(new URL("https://example.com/blog?category=engineering"))
  );
});

test("entryKey separates paths, origins and query values", () => {
  const base = entryKey(new URL("https://example.com/blog"));

  assert.notEqual(base, entryKey(new URL("https://example.com/blog/post")));
  assert.notEqual(base, entryKey(new URL("https://other.com/blog")));
  assert.notEqual(base, entryKey(new URL("https://example.com/blog?page=2")));
});

test("entryTtl only stores a plain 200 the route asked to cache", () => {
  const ok = new Response("hi", { status: 200 });

  assert.equal(entryTtl(ok, { maxAge: 60 }), 60);
  assert.equal(entryTtl(ok, { maxAge: 0 }), null);
  assert.equal(entryTtl(ok, undefined), null);
  assert.equal(entryTtl(new Response("nope", { status: 404 }), { maxAge: 60 }), null);
  assert.equal(entryTtl(new Response("hi", { status: 200, headers: { "set-cookie": "a=1" } }), { maxAge: 60 }), null);
});

test("an entry round-trips status, headers and bytes", async () => {
  const bytes = new Uint8Array([0, 159, 146, 150, 255]);
  const entry = await toEntry(
    new Response(bytes, { status: 200, headers: { "content-type": "image/x-icon", "x-astro-test": "1" } })
  );

  assert.ok(entry);

  const response = toResponse(entry);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-astro-test"), "1");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("toEntry drops Set-Cookie and oversized bodies", async () => {
  const entry = await toEntry(new Response("hi", { status: 200, headers: { "set-cookie": "a=1" } }));

  assert.ok(entry);
  assert.equal(new Headers(entry.headers).has("set-cookie"), false);

  assert.equal(await toEntry(new Response("x".repeat(ENTRY_MAX_BYTES + 1))), null);
});
