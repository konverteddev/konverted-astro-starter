import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { joinSiteUrl, normalizeSiteUrl } from "./site-url";

test("normalizeSiteUrl strips a trailing slash", () => {
  assert.equal(normalizeSiteUrl("https://example.com/"), "https://example.com");
  assert.equal(normalizeSiteUrl("https://example.com///"), "https://example.com");
  assert.equal(normalizeSiteUrl("  https://example.com/  "), "https://example.com");
  assert.equal(normalizeSiteUrl("https://example.com"), "https://example.com");
});

test("joinSiteUrl never doubles a slash, whatever the base and path carry", () => {
  assert.equal(joinSiteUrl("https://example.com", "/blog"), "https://example.com/blog");
  assert.equal(joinSiteUrl("https://example.com/", "/blog"), "https://example.com/blog");
  assert.equal(joinSiteUrl("https://example.com/", "//blog"), "https://example.com/blog");
  assert.equal(joinSiteUrl("https://example.com", "blog"), "https://example.com/blog");
  assert.equal(joinSiteUrl("https://example.com", "/blog/a-post"), "https://example.com/blog/a-post");
});

test("the site root keeps its single trailing slash", () => {
  assert.equal(joinSiteUrl("https://example.com", "/"), "https://example.com/");
  assert.equal(joinSiteUrl("https://example.com/", "/"), "https://example.com/");
  assert.equal(joinSiteUrl("https://example.com", ""), "https://example.com/");
  assert.equal(joinSiteUrl("https://example.com"), "https://example.com/");
  assert.equal(joinSiteUrl("https://example.com", null), "https://example.com/");
});

test("a path deeper than one segment survives untouched", () => {
  assert.equal(joinSiteUrl("https://example.com", "/sitemap.xml"), "https://example.com/sitemap.xml");
  assert.equal(joinSiteUrl("https://example.com", "/blog/a-post"), "https://example.com/blog/a-post");
});

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCANNED_DIRS = ["src", "templates"];
const SCANNED_EXTENSIONS = [".ts", ".tsx", ".astro", ".hbs"];

// `env.ts` owns the constant; this file names the banned patterns, so both would match themselves.
const ALLOWED = [join("src", "lib", "env.ts"), join("src", "lib", "site-url.test.ts")];

const BANNED = [
  { pattern: /\$\{\s*PUBLIC_SITE_URL\s*\}/, hint: "interpolates the origin; call `absoluteUrl(path)` from `~/lib/env` instead" },
  { pattern: /PUBLIC_SITE_URL\s*\+/, hint: "concatenates the origin; call `absoluteUrl(path)` from `~/lib/env` instead" },
  { pattern: /PUBLIC_SITE_URL\s*\.\s*replace/, hint: "re-cleans the origin; `~/lib/env` already normalized it" },
];

function scannedFiles(): string[] {
  return SCANNED_DIRS.flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .map((file) => join(dir, file))
      .filter((file) => SCANNED_EXTENSIONS.some((extension) => file.endsWith(extension)))
      .filter((file) => !ALLOWED.includes(file))
  );
}

test("no module builds a site URL by hand", () => {
  const offences = scannedFiles().flatMap((file) =>
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .flatMap((line, index) => {
        const banned = BANNED.find(({ pattern }) => pattern.test(line));

        return banned ? [`${file}:${index + 1} ${banned.hint}`] : [];
      })
  );

  assert.deepEqual(offences, []);
});
