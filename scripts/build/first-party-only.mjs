import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Every import statement's specifier, skipping type-only imports, which vanish at build.
const IMPORT_SPECIFIER = /^\s*import\s+(?!type\b)(?:[^"']*?from\s*)?["']([^"']+)["']/gm;

// A virtual module (`astro:transitions/client`, `sanity:client`) is the framework's, not a package.
const VIRTUAL = /^[a-z][a-z0-9-]*:/;

const EXTENSIONS = ["", ".ts", ".mts", ".js", ".mjs", "/index.ts", "/index.js"];

function resolveFile(base) {
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;

    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

/**
 * Whether a module, and everything it imports that is ours, imports no package. A bare specifier
 * anywhere beneath it means the module wraps a dependency, and bundling the wrapper into a chunk
 * every page loads would put that dependency on every page too.
 *
 * `aliases` maps an import prefix to the directory it stands for (`{ "~/": "src/" }`), longest
 * prefix first. A specifier that is neither relative, aliased, nor virtual is a package. A
 * relative or aliased import that resolves to no file is treated as a package as well, so an
 * unknown shape fails closed rather than sneaking something onto every page.
 */
export function isFirstPartyOnly(file, { root, aliases }, seen = new Set()) {
  if (seen.has(file)) {
    return true;
  }

  seen.add(file);

  const source = readFileSync(file, "utf8");
  const prefixes = Object.keys(aliases).sort((a, b) => b.length - a.length);

  for (const [, specifier] of source.matchAll(IMPORT_SPECIFIER)) {
    const clean = specifier.split("?")[0];

    if (VIRTUAL.test(clean)) {
      continue;
    }

    let base = null;

    if (clean.startsWith("./") || clean.startsWith("../")) {
      base = resolve(dirname(file), clean);
    } else {
      const prefix = prefixes.find((candidate) => clean.startsWith(candidate));

      if (prefix) {
        base = resolve(root, aliases[prefix], clean.slice(prefix.length));
      }
    }

    const target = base ? resolveFile(base) : null;

    if (!target || !isFirstPartyOnly(target, { root, aliases }, seen)) {
      return false;
    }
  }

  return true;
}
