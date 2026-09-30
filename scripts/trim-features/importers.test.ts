import assert from "node:assert/strict";
import { test } from "node:test";
import { extractSpecifiers, findImporters, isWithin, parseAliases, resolveSpecifier } from "./importers";

const ALIASES = parseAliases(
  JSON.stringify({ compilerOptions: { paths: { "~/*": ["./src/*"], "~/sanity/*": ["./sanity/*"] } } })
);

test("parseAliases orders the longest prefix first, so ~/sanity/ is not read as src/sanity/", () => {
  assert.deepEqual(ALIASES, [
    { prefix: "~/sanity/", target: "sanity/" },
    { prefix: "~/", target: "src/" },
  ]);
  assert.deepEqual(parseAliases(JSON.stringify({ compilerOptions: { paths: { "~/*": ["./*"] } } })), [
    { prefix: "~/", target: "" },
  ]);
  assert.deepEqual(parseAliases("{ not json"), []);
});

test("extractSpecifiers finds static, side-effect, re-export and dynamic imports", () => {
  const source = `import a from "./a";
import "./side-effect";
export { b } from "~/b";
const c = await import("~/features/c");
type D = import("./d").D;`;

  assert.deepEqual(extractSpecifiers(source), ["./a", "./side-effect", "~/b", "~/features/c", "./d"]);
});

test("resolveSpecifier resolves relative and aliased paths, and leaves packages alone", () => {
  assert.equal(resolveSpecifier("sanity/schemas/index.ts", "./documents/article", ALIASES), "sanity/schemas/documents/article");
  assert.equal(resolveSpecifier("src/pages/x.astro", "~/features/blog/query", ALIASES), "src/features/blog/query");
  assert.equal(resolveSpecifier("src/pages/x.astro", "~/sanity/constants", ALIASES), "sanity/constants");
  assert.equal(resolveSpecifier("src/pages/x.astro", "astro:content", ALIASES), undefined);
});

test("isWithin matches a folder's contents and a file with or without its extension", () => {
  assert.equal(isWithin("src/features/blog/query", "src/features/blog"), true);
  assert.equal(isWithin("src/components/Spinner.astro", "src/components/Spinner.astro"), true);
  assert.equal(isWithin("src/pages/feed.xml", "src/pages/feed.xml.ts"), true);
  assert.equal(isWithin("src/features/blog-extras/x", "src/features/blog"), false);
});

test("findImporters skips ignored files and reports the first target each file reaches", () => {
  const index = [
    { file: "src/features/blog/Article.astro", imports: ["src/features/blog/query"] },
    { file: "src/pages/index.astro", imports: ["src/features/blog/query", "src/lib/env"] },
    { file: "src/pages/about.astro", imports: ["src/lib/env"] },
  ];

  assert.deepEqual(findImporters(index, ["src/features/blog"], ["src/features/blog"]), [
    { file: "src/pages/index.astro", target: "src/features/blog" },
  ]);
});
