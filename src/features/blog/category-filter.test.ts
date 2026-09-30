import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectedCategories, toggleCategoryHref } from "./category-filter";

const KNOWN = ["engineering", "design"];

describe("selectedCategories", () => {
  it("is empty when nothing is selected", () => {
    assert.deepEqual(selectedCategories(new URLSearchParams(""), KNOWN), []);
  });

  it("reads every repeated category parameter", () => {
    const params = new URLSearchParams("category=engineering&category=design");

    assert.deepEqual(selectedCategories(params, KNOWN), ["engineering", "design"]);
  });

  it("drops a slug that is not a known category, so a stale URL cannot filter on it", () => {
    const params = new URLSearchParams("category=engineering&category=deleted-category");

    assert.deepEqual(selectedCategories(params, KNOWN), ["engineering"]);
  });

  it("deduplicates and ignores blank values", () => {
    const params = new URLSearchParams("category=engineering&category=engineering&category=%20");

    assert.deepEqual(selectedCategories(params, KNOWN), ["engineering"]);
  });
});

describe("toggleCategoryHref", () => {
  it("adds an unselected category", () => {
    assert.equal(toggleCategoryHref("/blog", [], "engineering"), "/blog?category=engineering");
  });

  it("appends to an existing selection", () => {
    assert.equal(toggleCategoryHref("/blog", ["engineering"], "design"), "/blog?category=engineering&category=design");
  });

  it("removes a category that is already selected", () => {
    assert.equal(toggleCategoryHref("/blog", ["engineering", "design"], "engineering"), "/blog?category=design");
  });

  it("drops the query string entirely when the last category is removed", () => {
    assert.equal(toggleCategoryHref("/blog", ["engineering"], "engineering"), "/blog");
  });
});
