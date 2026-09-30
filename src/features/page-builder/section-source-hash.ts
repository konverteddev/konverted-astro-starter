// What a section's thumbnail was taken from. The capture records it and the test compares it, so a
// section that changes shape fails the build until it is re-shot. Node-only (no Vite), like its
// neighbour `section-slug.ts`, because the capture script and the test both read it.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** The files that decide how a section photographs: its own markup and its fixture. */
function sourceFiles(folder: string) {
  return readdirSync(folder)
    .filter((file) => file.endsWith(".astro") || file === "preview.ts")
    .sort();
}

/**
 * A digest of the section's own source. A change to a shared component it renders is invisible here,
 * so this catches the common case (the section itself was edited), not every possible staleness.
 */
export function sectionSourceHash(sectionsDir: string, folder: string) {
  const dir = path.join(sectionsDir, folder);
  const hash = createHash("sha1");

  for (const file of sourceFiles(dir)) {
    hash.update(file);
    hash.update(readFileSync(path.join(dir, file)));
  }

  return hash.digest("hex").slice(0, 12);
}
