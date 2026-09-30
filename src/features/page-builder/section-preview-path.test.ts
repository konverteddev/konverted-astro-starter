import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSectionPreviewPath } from "./section-preview-path";

describe("isSectionPreviewPath", () => {
  it("matches the specimen route and every section under it", () => {
    assert.equal(isSectionPreviewPath("/section-preview"), true);
    assert.equal(isSectionPreviewPath("/section-preview/cta-section"), true);
  });

  // The sitemap reads `uri.current`, which an editor may have typed without the leading slash.
  it("matches a CMS uri stored without its leading slash", () => {
    assert.equal(isSectionPreviewPath("section-preview/cta-section"), true);
  });

  it("leaves alone a path that only starts alike", () => {
    assert.equal(isSectionPreviewPath("/section-previews"), false);
    assert.equal(isSectionPreviewPath("/blog/section-preview"), false);
    assert.equal(isSectionPreviewPath("/"), false);
  });
});
