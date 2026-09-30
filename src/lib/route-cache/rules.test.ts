import assert from "node:assert/strict";
import { test } from "node:test";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import { basicAuthorizationHeader } from "~/features/auth/basic-auth";
import { isAuthenticatedRequest, shouldBypassCache } from "./rules";

const URL_UNDER_TEST = "https://example.com/about";

function request(headers: Record<string, string> = {}): Request {
  return new Request(URL_UNDER_TEST, { headers });
}

test("shouldBypassCache lets ordinary traffic through", () => {
  assert.equal(shouldBypassCache(request()), false);
  assert.equal(shouldBypassCache(request({ accept: "text/html,application/xhtml+xml" })), false);
  assert.equal(shouldBypassCache(request({ cookie: "other=1" })), false);
});

test("shouldBypassCache stops draft mode and Markdown negotiation", () => {
  assert.equal(shouldBypassCache(request({ cookie: `${perspectiveCookieName}=drafts` })), true);
  assert.equal(shouldBypassCache(request({ cookie: `other=1; ${perspectiveCookieName}=drafts` })), true);
  assert.equal(shouldBypassCache(request({ accept: "text/markdown" })), true);
  assert.equal(shouldBypassCache(request({ accept: "text/html;q=0.9,text/x-markdown" })), true);
});

test("isAuthenticatedRequest matches only the configured credentials", () => {
  const expected = basicAuthorizationHeader("editor", "s3cret");

  assert.equal(isAuthenticatedRequest(request({ authorization: expected ?? "" }), expected), true);
  assert.equal(isAuthenticatedRequest(request({ authorization: `Basic ${btoa("editor:wrong")}` }), expected), false);
  assert.equal(isAuthenticatedRequest(request({ authorization: "Bearer token" }), expected), false);
  assert.equal(isAuthenticatedRequest(request(), expected), false);
});

test("isAuthenticatedRequest never matches when Basic Auth is unconfigured", () => {
  assert.equal(isAuthenticatedRequest(request({ authorization: `Basic ${btoa("editor:s3cret")}` }), null), false);
  assert.equal(isAuthenticatedRequest(request(), null), false);
});
