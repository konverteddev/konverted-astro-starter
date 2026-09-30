import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Reports how deep the built client import chain runs and which shared chunks are tiny.
// After `npm run build` the depth should read 2 and the tiny list should hold nothing from `src/lib`.
const CANDIDATES = [".vercel/output/static/_astro", "dist/client/_astro", "dist/_astro"];
const dir = process.argv[2] ?? CANDIDATES.find((candidate) => existsSync(candidate));

if (!dir) {
  console.error(`No build output found; looked for ${CANDIDATES.join(", ")}.`);
  process.exit(1);
}

const files = readdirSync(dir).filter((file) => file.endsWith(".js"));
const source = Object.fromEntries(files.map((file) => [file, readFileSync(join(dir, file), "utf8")]));
const size = Object.fromEntries(files.map((file) => [file, statSync(join(dir, file)).size]));
const shortName = (file) =>
  file.replace(/\.astro_astro_type_script_index_0_lang\..*$/, "").replace(/\.[A-Za-z0-9_-]{8}\.js$/, "");

const staticImports = (file) =>
  [...source[file].matchAll(/(?:^|[;\s])import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)]
    .map((match) => match[1])
    .filter((name) => source[name]);

// The Studio's entries share nothing with the public pages and would only skew the numbers.
const entries = files.filter(
  (file) => /^[A-Za-z0-9-]+\.astro_astro_type_script_index_0_lang\./.test(file) && !/studio/i.test(file)
);

function depthOf(file, seen = new Set()) {
  if (seen.has(file)) {
    return 0;
  }

  seen.add(file);

  const children = staticImports(file);

  return children.length ? 1 + Math.max(...children.map((child) => depthOf(child, seen))) : 0;
}

const reachable = new Set();

function walk(file) {
  if (reachable.has(file)) {
    return;
  }

  reachable.add(file);
  staticImports(file).forEach(walk);
}

entries.forEach(walk);

const shared = [...reachable].filter((file) => !entries.includes(file));
const importers = {};

for (const file of reachable) {
  for (const child of staticImports(file)) {
    importers[child] = (importers[child] ?? 0) + 1;
  }
}

const tiny = shared.filter((file) => size[file] < 1500).sort((a, b) => (importers[b] ?? 0) - (importers[a] ?? 0));
const largest = [...shared].sort((a, b) => size[b] - size[a]).slice(0, 5);
const deepest = entries
  .map((entry) => [shortName(entry), depthOf(entry)])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4);

console.log(`${dir}`);
console.log(
  `  hoisted-script entries: ${entries.length}   shared chunks: ${shared.length}   under 1.5KB: ${tiny.length}   max chain depth: ${Math.max(0, ...entries.map((entry) => depthOf(entry)))}`
);
console.log(`  deepest entries: ${deepest.map(([name, depth]) => `${name}=${depth}`).join(", ")}`);
console.log(
  `  tiny shared chunks: ${tiny.map((file) => `${shortName(file)} (${size[file]}B, ${importers[file] ?? 0} importers)`).join(", ") || "none"}`
);
console.log(`  largest shared: ${largest.map((file) => `${shortName(file)}=${Math.round(size[file] / 1024)}KB`).join(", ")}`);
