import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countWords, formatReadingTime, readingTimeMinutes } from "./reading-time";

function block(...texts: string[]) {
  return { _type: "block", children: texts.map((text) => ({ text })) };
}

describe("countWords", () => {
  it("returns 0 for empty input", () => {
    assert.equal(countWords(), 0);
    assert.equal(countWords(null), 0);
    assert.equal(countWords([]), 0);
  });

  it("counts words across spans and blocks", () => {
    assert.equal(countWords([block("one two three"), block("four", " five")]), 5);
  });

  it("ignores non-block nodes such as media", () => {
    assert.equal(countWords([block("one two"), { _type: "mediaBlock" }]), 2);
  });

  it("collapses irregular whitespace instead of counting empty strings", () => {
    assert.equal(countWords([block("  one   two  ")]), 2);
  });
});

describe("readingTimeMinutes", () => {
  it("returns 0 for an empty body", () => {
    assert.equal(readingTimeMinutes([]), 0);
  });

  it("rounds up to a whole minute", () => {
    assert.equal(readingTimeMinutes([block("word ".repeat(201).trim())]), 2);
  });

  it("never returns less than a minute for non-empty content", () => {
    assert.equal(readingTimeMinutes([block("just a few words")]), 1);
  });
});

describe("formatReadingTime", () => {
  it("is empty when there is nothing to read", () => {
    assert.equal(formatReadingTime([]), "");
  });

  it("labels the minutes", () => {
    assert.equal(formatReadingTime([block("a short body")]), "1 min read");
  });
});
