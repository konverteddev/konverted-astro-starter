import assert from "node:assert/strict";
import { test } from "node:test";
import { renderNotFoundMarkdown } from "./not-found-markdown";

test("renders a 404 heading with recovery links on the given origin", () => {
  const markdown = renderNotFoundMarkdown("https://example.com");

  assert.match(markdown, /^# 404 Not Found/);
  assert.match(markdown, /\(https:\/\/example\.com\/llms\.txt\)/);
  assert.match(markdown, /\(https:\/\/example\.com\/sitemap\.xml\)/);
  assert.match(markdown, /\(https:\/\/example\.com\/openapi\.json\)/);
  assert.match(markdown, /Accept: text\/markdown/);
});

test("a trailing slash on the base URL does not double up in links", () => {
  const markdown = renderNotFoundMarkdown("https://example.com/");

  assert.doesNotMatch(markdown, /example\.com\/\/(?:llms|sitemap|blog)/);
  assert.match(markdown, /\(https:\/\/example\.com\/\)/);
});

test("the link list is caller-provided", () => {
  const markdown = renderNotFoundMarkdown("https://example.com", [{ label: "Docs", path: "/docs", note: "the manual" }]);

  assert.match(markdown, /- \[Docs\]\(https:\/\/example\.com\/docs\): the manual/);
  assert.doesNotMatch(markdown, /sitemap\.xml/);
});
