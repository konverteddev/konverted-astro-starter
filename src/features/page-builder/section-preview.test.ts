// Reads the section folders off disk rather than importing the registry next door, which reaches
// for `import.meta.glob` and so only resolves inside Vite.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PREVIEW_ASSET_NAMES, PREVIEW_ASSETS } from "./section-preview-assets";
import { toSectionSlug } from "./section-slug";
import { sectionSourceHash } from "./section-source-hash";

const SECTIONS_DIR = path.resolve("src/features/page-builder/sections");
const THUMBS_DIR = path.resolve("public/page-builder-section-thumbs");
const MANIFEST = path.join(THUMBS_DIR, "manifest.json");

type Section = { folder: string; slug: string; half: string; hasPreview: boolean; skips: boolean };

function readSections(): Section[] {
  return readdirSync(SECTIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const previewFile = path.join(SECTIONS_DIR, entry.name, "preview.ts");
      const hasPreview = existsSync(previewFile);

      return {
        folder: entry.name,
        slug: toSectionSlug(entry.name),
        half: `${entry.name.replace(/Section$/, "")}.astro`,
        hasPreview,
        skips: hasPreview && /\bskip:/.test(readFileSync(previewFile, "utf8")),
      };
    });
}

describe("toSectionSlug", () => {
  it("kebab-cases a section folder", () => {
    assert.equal(toSectionSlug("ContactFormSection"), "contact-form-section");
    assert.equal(toSectionSlug("MediaSection"), "media-section");
    assert.equal(toSectionSlug("CtaSection"), "cta-section");
  });
});

describe("section previews", () => {
  const sections = readSections();

  it("finds the section folders", () => {
    assert.ok(sections.length > 0, "no section folders found");
  });

  // A section is split precisely because something other than the page renders it, and the insert
  // menu is now one of those consumers.
  it("gives every section with a presentational half a preview.ts", () => {
    const missing = sections
      .filter((section) => existsSync(path.join(SECTIONS_DIR, section.folder, section.half)) && !section.hasPreview)
      .map((section) => `${section.folder}/preview.ts`);

    assert.deepEqual(missing, [], `missing section fixtures:\n  ${missing.join("\n  ")}`);
  });

  it("has a captured thumbnail for every section that does not skip", () => {
    const missing = sections
      .filter((section) => section.hasPreview && !section.skips)
      .filter((section) => !existsSync(path.join(THUMBS_DIR, `${section.slug}.jpg`)))
      .map((section) => `${section.slug}.jpg`);

    assert.deepEqual(missing, [], `run \`npm run sections:thumbs\` for:\n  ${missing.join("\n  ")}`);
  });

  // The thumbnail is a photograph, so editing the section's markup or its fixture dates it.
  it("has a thumbnail taken from the section as it stands now", () => {
    const recorded: Record<string, string> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

    const stale = sections
      .filter((section) => section.hasPreview && !section.skips)
      .filter((section) => recorded[section.slug] !== sectionSourceHash(SECTIONS_DIR, section.folder))
      .map((section) => section.slug);

    assert.deepEqual(
      stale,
      [],
      `the section changed since its thumbnail was taken. Run:\n  npm run sections:thumbs ${stale.join(" ")}`
    );
  });

  it("keeps no thumbnail for a section that no longer exists", () => {
    const slugs = new Set(sections.map((section) => section.slug));

    const orphans = readdirSync(THUMBS_DIR)
      .filter((file) => file.endsWith(".jpg"))
      .filter((file) => !slugs.has(file.replace(/\.jpg$/, "")));

    assert.deepEqual(orphans, [], `orphaned thumbnails:\n  ${orphans.join("\n  ")}`);
  });
});

describe("preview placeholders", () => {
  // Every fixture leans on these, so a missing or reshaped file silently changes every thumbnail.
  it("ships every placeholder the fixtures ask for", () => {
    const missing = PREVIEW_ASSET_NAMES.filter((name) => !existsSync(path.join("public", PREVIEW_ASSETS[name].url)));

    assert.deepEqual(missing, [], `missing placeholder files:\n  ${missing.join("\n  ")}`);
  });
});
