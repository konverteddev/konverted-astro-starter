/**
 * Prose that still describes a removed feature. The trim prunes links to a deleted doc, but a skill or
 * doc that explains the feature in passing is a sentence to rewrite, so it is listed rather than edited.
 */

import type { Feature } from "./features";

export type Mention = { file: string; line: number; term: string };

/** A basename distinctive enough to search prose for: compound, never a word like `Form` or `blog`. */
function isDistinctive(name: string): boolean {
  return /[-.]/.test(name) || /[a-z][A-Z]/.test(name);
}

export function mentionTerms(feature: Feature): string[] {
  const basenames = feature.paths
    .map((path) => (path.split("/").pop() ?? "").replace(/\.(ts|tsx|astro|mjs|jpg)$/, ""))
    .filter(isDistinctive);
  const types = [...(feature.documentTypes ?? []), ...(feature.sectionTypes ?? [])].map((type) => `\`${type}\``);

  return [...new Set([...basenames, ...types, ...(feature.env ?? []), ...(feature.mentions ?? [])])];
}

/** Every line naming a term, first term per line, case-insensitive for the prose names. */
export function findMentions(files: { path: string; text: string }[], terms: readonly string[]): Mention[] {
  const found: Mention[] = [];

  for (const { path, text } of files) {
    text.split("\n").forEach((line, index) => {
      const lower = line.toLowerCase();
      const term = terms.find((candidate) => lower.includes(candidate.toLowerCase()));

      if (term) {
        found.push({ file: path, line: index + 1, term });
      }
    });
  }

  return found;
}

/** One line per file: the file, then the line numbers, so a long list stays scannable. */
export function formatMentions(mentions: readonly Mention[]): string[] {
  const byFile = new Map<string, number[]>();

  for (const { file, line } of mentions) {
    byFile.set(file, [...(byFile.get(file) ?? []), line]);
  }

  return [...byFile].map(([file, lines]) => `${file}:${lines.join(",")}`);
}
