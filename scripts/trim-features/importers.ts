/**
 * Which files import a feature, resolved the way the bundler would, aliases included. Project code
 * importing a feature is the code-side answer to "is it used?", and the files a trim would break.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

export type Alias = { prefix: string; target: string };

export type ImportIndex = { file: string; imports: string[] }[];

export type Importer = { file: string; target: string };

const SOURCE = /\.(ts|tsx|mts|mjs|js|jsx|astro)$/;
const EXTENSION = /\.(d\.ts|ts|tsx|mts|mjs|js|jsx|astro|json)$/;
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;
const SKIPPED_DIRS = new Set(["node_modules", ".git", ".astro", ".next", ".vercel", "dist", "backups", "public"]);

/** `compilerOptions.paths` wildcard entries, longest prefix first so `~/sanity/` wins over `~/`. */
export function parseAliases(tsconfig: string): Alias[] {
  let paths: Record<string, string[]> = {};

  try {
    paths = (JSON.parse(tsconfig) as { compilerOptions?: { paths?: Record<string, string[]> } }).compilerOptions?.paths ?? {};
  } catch {
    return [];
  }

  return Object.entries(paths)
    .filter(([key, targets]) => key.endsWith("*") && targets[0]?.endsWith("*"))
    .map(([key, targets]) => ({
      prefix: key.slice(0, -1),
      target: posix
        .normalize((targets[0] ?? "").slice(0, -1))
        .replace(/^\.\//, "")
        .replace(/^\.$/, ""),
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

export function extractSpecifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((match) => match[1] ?? "").filter(Boolean);
}

/** A specifier as a repository path, or `undefined` for a package. */
export function resolveSpecifier(from: string, specifier: string, aliases: readonly Alias[]): string | undefined {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return posix.normalize(posix.join(posix.dirname(from), specifier));
  }

  const alias = aliases.find((entry) => specifier.startsWith(entry.prefix));

  return alias ? posix.normalize(posix.join(alias.target, specifier.slice(alias.prefix.length))) : undefined;
}

/** Whether a resolved import lands on `target`, a file or a folder, with or without an extension. */
export function isWithin(resolved: string, target: string): boolean {
  const stem = target.replace(EXTENSION, "");

  return resolved.replace(EXTENSION, "") === stem || resolved.startsWith(`${stem}/`);
}

export function buildImportIndex(root: string): ImportIndex {
  let aliases: Alias[] = [];

  try {
    aliases = parseAliases(readFileSync(join(root, "tsconfig.json"), "utf8"));
  } catch {
    // No tsconfig: relative imports still resolve.
  }

  const index: ImportIndex = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (SKIPPED_DIRS.has(entry.name)) {
        continue;
      }

      const path = dir ? `${dir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(path);
        continue;
      }

      if (!SOURCE.test(entry.name)) {
        continue;
      }

      const imports = extractSpecifiers(readFileSync(join(root, path), "utf8"))
        .map((specifier) => resolveSpecifier(path, specifier, aliases))
        .filter((resolved): resolved is string => Boolean(resolved));

      if (imports.length > 0) {
        index.push({ file: path, imports });
      }
    }
  };

  walk("");

  return index;
}

/** Files outside `ignore` that import anything under `targets`. */
export function findImporters(index: ImportIndex, targets: readonly string[], ignore: readonly string[]): Importer[] {
  const found: Importer[] = [];

  for (const { file, imports } of index) {
    if (ignore.some((path) => isWithin(file, path))) {
      continue;
    }

    const target = targets.find((candidate) => imports.some((resolved) => isWithin(resolved, candidate)));

    if (target) {
      found.push({ file, target });
    }
  }

  return found;
}
