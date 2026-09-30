/**
 * Photographs every page builder section from `/section-preview/<slug>` into the thumbnails the
 * Studio's insert menu shows. See docs/features/section-previews.md
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { toSectionSlug } from "../../src/features/page-builder/section-slug";
import { sectionSourceHash } from "../../src/features/page-builder/section-source-hash";
import { printHeader, printStep, printSummary } from "../lib/cli";

const SECTIONS_DIR = path.resolve("src/features/page-builder/sections");
const OUTPUT_DIR = path.resolve("public/page-builder-section-thumbs");
const MANIFEST = path.join(OUTPUT_DIR, "manifest.json");

const CAPTURE_WIDTH = 1440;
const CAPTURE_HEIGHT = 960;
const OUTPUT_WIDTH = 960;
const JPEG_QUALITY = 80;
const READY_TIMEOUT = 20_000;

type Outcome = "captured" | "unchanged" | "skipped" | "failed";

type Result = { slug: string; outcome: Outcome; detail?: string };

function parseArgs(argv: string[]) {
  const only = argv.filter((arg) => !arg.startsWith("--"));
  const urlArg = argv.find((arg) => arg.startsWith("--url="));

  return {
    only,
    baseUrl: (urlArg?.slice("--url=".length) ?? "http://localhost:4321").replace(/\/$/, ""),
  };
}

/** Every section folder holding a `preview.ts`; the route decides which of them has a specimen. */
async function findSections() {
  const folders = await readdir(SECTIONS_DIR, { withFileTypes: true });

  return folders
    .filter((entry) => entry.isDirectory() && existsSync(path.join(SECTIONS_DIR, entry.name, "preview.ts")))
    .map((entry) => ({ folder: entry.name, slug: toSectionSlug(entry.name) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The capture is byte-deterministic, so an identical render rewrites nothing and git stays quiet. */
async function isUnchanged(next: Buffer, file: string) {
  if (!existsSync(file)) {
    return false;
  }

  try {
    return next.equals(await readFile(file));
  } catch {
    return false;
  }
}

async function main() {
  const { only, baseUrl } = parseArgs(process.argv.slice(2));

  printHeader("📸", "Section thumbnails", [
    `Source: ${baseUrl}/section-preview/<section>`,
    `Output: ${path.relative(process.cwd(), OUTPUT_DIR)}`,
  ]);

  const all = await findSections();
  const sections = only.length > 0 ? all.filter((section) => only.includes(section.slug)) : all;

  if (sections.length === 0) {
    console.error(only.length > 0 ? `No section matched: ${only.join(", ")}` : "No section has a preview.ts yet.");
    process.exitCode = 1;
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });

  const context = await browser.newContext({
    viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
    deviceScaleFactor: 2,
    // Every reveal primitive skips to its finished state under reduce, so the specimen is never mid-animation.
    reducedMotion: "reduce",
    ...(process.env.BASIC_AUTH_USERNAME && process.env.BASIC_AUTH_PASSWORD
      ? { httpCredentials: { username: process.env.BASIC_AUTH_USERNAME, password: process.env.BASIC_AUTH_PASSWORD } }
      : {}),
  });

  const results: Result[] = [];

  printStep("🎞", `Capturing ${sections.length} section(s)`);

  // Merged, never replaced: capturing one section must not drop the others' recorded source.
  const manifest: Record<string, string> = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};

  for (const { folder, slug } of sections) {
    const page = await context.newPage();

    // A module that 404s or 504s (a stale Vite dep cache) leaves its custom element undefined, and the
    // section photographs half-built. Refuse the shot rather than write a quietly wrong picture.
    const broken: string[] = [];

    page.on("pageerror", (error) => broken.push(error.message.split("\n")[0]));
    page.on("requestfailed", (request) => broken.push(`${request.url().split("/").pop()} ${request.failure()?.errorText ?? ""}`));
    page.on("response", (response) => {
      if (response.status() >= 400 && /\.(?:js|mjs|css)(?:\?|$)/.test(response.url())) {
        broken.push(`${response.url().split("/").pop()} HTTP ${response.status()}`);
      }
    });

    try {
      const response = await page.goto(`${baseUrl}/section-preview/${slug}`, { waitUntil: "load" });
      const status = response?.status() ?? 0;

      if (status === 404) {
        delete manifest[slug];
        results.push({ slug, outcome: "skipped", detail: "no specimen" });
        continue;
      }

      if (status !== 200) {
        results.push({ slug, outcome: "failed", detail: `HTTP ${status}` });
        continue;
      }

      // A scrollbar would take page width and land inside the crop.
      await page.addStyleTag({ content: "html{scrollbar-width:none}html::-webkit-scrollbar{display:none}" });
      await page.waitForSelector("html[data-ready]", { timeout: READY_TIMEOUT });
      await page.waitForLoadState("networkidle").catch(() => undefined);

      // The specimen frames and centres itself, so the crop is the frame it declares and nothing more.
      const declared = await page.$eval("[data-section-specimen]", (element) =>
        Number((element as HTMLElement).dataset.captureHeight)
      );

      const height = Number.isFinite(declared) && declared > 0 ? declared : CAPTURE_HEIGHT;

      if (broken.length > 0) {
        results.push({ slug, outcome: "failed", detail: broken[0] });
        continue;
      }

      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: CAPTURE_WIDTH, height } });

      const next = await sharp(shot)
        .resize({ width: OUTPUT_WIDTH })
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toBuffer();
      const file = path.join(OUTPUT_DIR, `${slug}.jpg`);

      // Recorded even when the picture did not move: the source may have changed without the look changing.
      manifest[slug] = sectionSourceHash(SECTIONS_DIR, folder);

      if (await isUnchanged(next, file)) {
        results.push({ slug, outcome: "unchanged" });
        continue;
      }

      await writeFile(file, next);
      results.push({ slug, outcome: "captured", detail: `${Math.round(next.byteLength / 1024)}KB` });
    } catch (error) {
      results.push({ slug, outcome: "failed", detail: error instanceof Error ? error.message.split("\n")[0] : "unknown" });
    } finally {
      await page.close();
    }
  }

  await context.close();
  await browser.close();

  await writeFile(MANIFEST, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2)}\n`);

  const icons: Record<Outcome, string> = { captured: "✅", unchanged: "➖", skipped: "⏭️", failed: "❌" };

  printSummary(
    results.map((result) => ({
      label: result.slug,
      value: `${icons[result.outcome]} ${result.outcome}${result.detail ? ` (${result.detail})` : ""}`,
    }))
  );

  const failed = results.filter((result) => result.outcome === "failed");

  if (failed.length > 0) {
    console.error(`\n${failed.length} section(s) failed to capture.\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
