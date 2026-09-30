import assert from "node:assert/strict";
import { test } from "node:test";
import { FEED_PATH } from "~/features/feed/constants";
import { isExcludedPath } from "./excluded-paths";

test("isExcludedPath skips the Studio, with or without a trailing slash on its base path", () => {
  assert.equal(isExcludedPath("/studio", "/studio"), true);
  assert.equal(isExcludedPath("/studio/structure", "/studio/"), true);
  assert.equal(isExcludedPath("/studios", "/studio"), false);
});

test("isExcludedPath skips API routes, Astro internals and file-like paths", () => {
  assert.equal(isExcludedPath("/api/contact-form", "/studio"), true);
  assert.equal(isExcludedPath("/_astro/index.js", "/studio"), true);
  assert.equal(isExcludedPath("/favicon.ico", "/studio"), true);
  assert.equal(isExcludedPath("/robots.txt", "/studio"), true);
});

test("isExcludedPath gates every page", () => {
  assert.equal(isExcludedPath("/", "/studio"), false);
  assert.equal(isExcludedPath("/about", "/studio"), false);
});

test("isExcludedPath gates the feed despite its extension", () => {
  assert.equal(isExcludedPath(FEED_PATH, "/studio"), false);
});
