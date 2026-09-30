import assert from "node:assert/strict";
import { test } from "node:test";
import { findFeature } from "./features";
import { findMentions, formatMentions, mentionTerms } from "./mentions";

test("mentionTerms keeps distinctive names and drops words that would match any prose", () => {
  const forms = findFeature("forms");

  assert.ok(forms);

  const terms = mentionTerms(forms);

  assert.ok(terms.includes("spam-prevention"));
  assert.ok(terms.includes("SubmitButton"));
  assert.ok(terms.includes("form layer"));
  assert.ok(!terms.includes("Form"));
  assert.ok(!terms.includes("forms"));
});

test("mentionTerms quotes document types, so `article` matches and the word article does not", () => {
  const blog = findFeature("blog");

  assert.ok(blog);
  assert.ok(mentionTerms(blog).includes("`article`"));
});

test("findMentions reports each matching line once, and formatMentions groups them by file", () => {
  const files = [
    { path: "docs/a.md", text: "intro\nThe contact form posts here.\nThe Contact Form, again, and RESEND_API_KEY" },
    { path: "docs/b.md", text: "nothing to see" },
  ];
  const mentions = findMentions(files, ["contact form", "RESEND_API_KEY"]);

  assert.deepEqual(
    mentions.map((mention) => mention.line),
    [2, 3]
  );
  assert.deepEqual(formatMentions(mentions), ["docs/a.md:2,3"]);
});
