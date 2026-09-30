import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDescriptionSourceUrl, isDescribableAsset, MAX_ALT_TEXT_LENGTH, normalizeAltText } from "./alt-text";

describe("normalizeAltText", () => {
  it("keeps a clean description untouched", () => {
    assert.equal(
      normalizeAltText("Sanity Studio showing a nested structure list resolving into a second pane"),
      "Sanity Studio showing a nested structure list resolving into a second pane"
    );
  });

  it("keeps quoted text inside the description", () => {
    assert.equal(
      normalizeAltText("Certificate reading “Site of the Day. Aug 02, 2026”"),
      "Certificate reading “Site of the Day. Aug 02, 2026”"
    );
  });

  it("unwraps a fully quoted line", () => {
    assert.equal(normalizeAltText('"Portrait of a woman carrying a basket"'), "Portrait of a woman carrying a basket");
    assert.equal(normalizeAltText("“Portrait of a woman carrying a basket”"), "Portrait of a woman carrying a basket");
  });

  it("drops openers that only restate the medium", () => {
    assert.equal(normalizeAltText("Image of a red bicycle leaning on a wall"), "A red bicycle leaning on a wall");
    assert.equal(normalizeAltText("This image shows a red bicycle"), "A red bicycle");
  });

  it("keeps openers that carry information", () => {
    assert.equal(normalizeAltText("Film still of a man in a tweed jacket"), "Film still of a man in a tweed jacket");
    assert.equal(normalizeAltText("Screenshot of the awards page"), "Screenshot of the awards page");
  });

  it("takes the first non-empty line and drops the trailing period", () => {
    assert.equal(normalizeAltText("\n  A red bicycle.\n\nLet me know if you want another version."), "A red bicycle");
  });

  it("truncates at a word boundary without leaving punctuation dangling", () => {
    const result = normalizeAltText(`${"word ".repeat(60)}tail`);

    assert.ok(result.length <= MAX_ALT_TEXT_LENGTH);
    assert.ok(!result.endsWith(" "));
    assert.equal(result.slice(-1), "d");
  });

  it("returns an empty string when there is nothing usable", () => {
    assert.equal(normalizeAltText("   \n  "), "");
    assert.equal(normalizeAltText('""'), "");
  });
});

describe("buildDescriptionSourceUrl", () => {
  it("caps the source image so a full-size original never reaches the model", () => {
    const url = new URL(buildDescriptionSourceUrl("https://cdn.sanity.io/images/p/production/abc-3840x2160.png"));

    assert.equal(url.searchParams.get("w"), "1024");
    assert.equal(url.searchParams.get("fit"), "max");
    assert.equal(url.searchParams.get("fm"), "jpg");
  });
});

describe("isDescribableAsset", () => {
  it("accepts raster assets served over https", () => {
    assert.equal(isDescribableAsset({ url: "https://cdn.sanity.io/a.png", extension: "png" }), true);
  });

  it("rejects svgs and assets with no url", () => {
    assert.equal(isDescribableAsset({ url: "https://cdn.sanity.io/a.svg", extension: "svg" }), false);
    assert.equal(isDescribableAsset({ url: "https://cdn.sanity.io/a.svg", extension: "SVG" }), false);
    assert.equal(isDescribableAsset({ url: undefined, extension: "png" }), false);
  });
});
