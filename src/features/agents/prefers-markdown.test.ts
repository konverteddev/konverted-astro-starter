import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prefersMarkdown } from "./prefers-markdown";

describe("prefersMarkdown", () => {
  it("never fires for a browser", () => {
    assert.equal(prefersMarkdown(null), false);
    assert.equal(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"), false);
  });

  it("fires for an agent that asks for Markdown", () => {
    assert.equal(prefersMarkdown("text/markdown"), true);
    assert.equal(prefersMarkdown("text/x-markdown"), true);
    assert.equal(prefersMarkdown("Text/Markdown, text/html"), true);
  });

  it("weighs Markdown against HTML by q-value, a tie going to Markdown", () => {
    assert.equal(prefersMarkdown("text/markdown;q=0.5, text/html"), false);
    assert.equal(prefersMarkdown("text/markdown, text/html;q=0.5"), true);
    assert.equal(prefersMarkdown("text/markdown;q=0.8, text/html;q=0.8"), true);
  });

  it("treats q=0 as a refusal", () => {
    assert.equal(prefersMarkdown("text/markdown;q=0"), false);
  });
});
