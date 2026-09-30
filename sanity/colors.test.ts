import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { BRAND_COLORS } from "./colors";

// The Studio's palette must be the site's, so this reads the real tokens.
// The stylesheet is found rather than named, because this file travels with `sanity/`.
const CANDIDATE_STYLESHEETS = ["src/styles/colors.css", "features/style/colors.css", "styles/colors.css", "app/colors.css"];

function findColorsStylesheet(): string {
  const root = path.join(import.meta.dirname, "..");
  const found = CANDIDATE_STYLESHEETS.map((relative) => path.join(root, relative)).find((file) => existsSync(file));

  if (!found) {
    throw new Error(`No colors stylesheet found. Looked for: ${CANDIDATE_STYLESHEETS.join(", ")}`);
  }

  return found;
}

const COLORS_CSS = findColorsStylesheet();

/** The `--color-brand-*` declarations from the stylesheet, in source order. */
function readBrandTokens() {
  const css = readFileSync(COLORS_CSS, "utf8");

  // Defaults, not assertions: an absent group would mean the regex changed, and the empty string fails below.
  return [...css.matchAll(/--color-(brand-[a-z0-9-]+):\s*([^;]+);/g)].map(([, name = "", swatch = ""]) => ({
    name,
    swatch: swatch.trim(),
  }));
}

describe("BRAND_COLORS", () => {
  it("lists every brand token in the stylesheet, and nothing else", () => {
    assert.deepEqual(
      BRAND_COLORS.map(({ name, swatch }) => ({ name, swatch })),
      readBrandTokens()
    );
  });

  it("offers no semantic token, which would change meaning with the design system", () => {
    assert.ok(BRAND_COLORS.every(({ name }) => name.startsWith("brand-")));
  });
});
