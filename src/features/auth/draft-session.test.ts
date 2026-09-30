import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDraftSession,
  DRAFT_SESSION_MAX_AGE_SECONDS,
  readCookie,
  safeRedirectPath,
  verifyDraftSession,
} from "./draft-session";

const SECRET = "server-only-secret";
const NOW = Date.UTC(2026, 0, 1);

test("a session this server signed verifies until it expires", async () => {
  const value = await createDraftSession(SECRET, NOW);

  assert.equal(await verifyDraftSession(SECRET, value, NOW), true);
  assert.equal(await verifyDraftSession(SECRET, value, NOW + (DRAFT_SESSION_MAX_AGE_SECONDS - 1) * 1000), true);
  assert.equal(await verifyDraftSession(SECRET, value, NOW + (DRAFT_SESSION_MAX_AGE_SECONDS + 1) * 1000), false);
});

test("anything a client could type is rejected", async () => {
  const value = await createDraftSession(SECRET, NOW);
  const [expiresAt, signature] = value.split(".");

  for (const forged of [
    "",
    "drafts",
    "1",
    "anything",
    `${expiresAt}`,
    `${expiresAt}.`,
    `${Number(expiresAt) + 3600}.${signature}`,
    `${expiresAt}.${signature}x`,
    `${expiresAt}.${signature}.extra`,
    `${expiresAt}.${"A".repeat(signature?.length ?? 43)}`,
  ]) {
    assert.equal(await verifyDraftSession(SECRET, forged, NOW), false, forged);
  }

  assert.equal(await verifyDraftSession(SECRET, null, NOW), false);
  assert.equal(await verifyDraftSession(SECRET, undefined, NOW), false);
});

test("a session signed with another secret is rejected, and an empty secret never verifies", async () => {
  const value = await createDraftSession("some-other-secret", NOW);
  assert.equal(await verifyDraftSession(SECRET, value, NOW), false);
  assert.equal(await verifyDraftSession("", await createDraftSession("", NOW), NOW), false);
});

test("readCookie finds one cookie in a raw header", () => {
  assert.equal(readCookie("a=1; __draft_session=123.abc; b=2", "__draft_session"), "123.abc");
  assert.equal(readCookie("a=1", "__draft_session"), null);
  assert.equal(readCookie(null, "__draft_session"), null);
});

test("safeRedirectPath keeps same-origin paths and refuses escapes", () => {
  assert.equal(safeRedirectPath("/blog/post?x=1"), "/blog/post?x=1");
  assert.equal(safeRedirectPath("//evil.com"), "/");
  assert.equal(safeRedirectPath("/\\evil.com"), "/");
  assert.equal(safeRedirectPath("https://evil.com"), "/");
  assert.equal(safeRedirectPath(null), "/");
});
