import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isFirstPartyOnly } from "./first-party-only.mjs";

// A throwaway project: `src/lib` helpers of every shape the rule has to tell apart.
function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "first-party-"));

  for (const [path, source] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), source);
  }

  const options = { root, aliases: { "~/sanity/": "sanity/", "~/": "src/" } };

  return (file: string) => isFirstPartyOnly(join(root, file), options);
}

test("a helper that imports nothing, or only relative and aliased files that import nothing, is first-party", () => {
  const check = project({
    "src/lib/leaf.ts": "export const leaf = 1;",
    "src/lib/relative.ts": 'import { leaf } from "./leaf";\nexport const relative = leaf;',
    "src/lib/aliased.ts": 'import { SCREENS } from "~/styles/screens";\nexport const aliased = SCREENS;',
    "src/styles/screens.ts": "export const SCREENS = {};",
    "src/lib/studio.ts": 'import { SITE } from "~/sanity/constants";\nexport const studio = SITE;',
    "sanity/constants.ts": 'export const SITE = "site";',
  });

  assert.equal(check("src/lib/leaf.ts"), true);
  assert.equal(check("src/lib/relative.ts"), true);
  assert.equal(check("src/lib/aliased.ts"), true);
  assert.equal(check("src/lib/studio.ts"), true);
});

test("a bare specifier is a package, wherever it sits beneath the helper", () => {
  const check = project({
    "src/lib/wrapper.ts": 'import gsap from "gsap";\nexport const wrapper = gsap;',
    "src/lib/indirect.ts": 'import { wrapper } from "./wrapper";\nexport const indirect = wrapper;',
    "src/lib/deep.ts": 'import { LenisElement } from "~/components/Lenis/LenisElement";\nexport const deep = LenisElement;',
    "src/components/Lenis/LenisElement.ts": 'import Lenis from "lenis";\nexport const LenisElement = Lenis;',
    "src/lib/side-effect.ts": 'import "focus-trap";',
  });

  assert.equal(check("src/lib/wrapper.ts"), false);
  assert.equal(check("src/lib/indirect.ts"), false);
  assert.equal(check("src/lib/deep.ts"), false);
  assert.equal(check("src/lib/side-effect.ts"), false);
});

test("virtual modules and type-only imports do not count as packages", () => {
  const check = project({
    "src/lib/virtual.ts": 'import { navigate } from "astro:transitions/client";\nexport const virtual = navigate;',
    "src/lib/typed.ts": 'import type { Tween } from "gsap";\nexport const typed = (tween: Tween) => tween;',
    "src/lib/mixed.ts":
      'import type { Options } from "focus-trap";\nimport { leaf } from "./leaf";\nexport const mixed = (options: Options) => leaf;',
    "src/lib/leaf.ts": "export const leaf = 1;",
  });

  assert.equal(check("src/lib/virtual.ts"), true);
  assert.equal(check("src/lib/typed.ts"), true);
  assert.equal(check("src/lib/mixed.ts"), true);
});

test("an import that resolves to no file fails closed, and a cycle terminates", () => {
  const check = project({
    "src/lib/missing.ts": 'import { gone } from "./gone";\nexport const missing = gone;',
    "src/lib/a.ts": 'import { b } from "./b";\nexport const a = b;',
    "src/lib/b.ts": 'import { a } from "./a";\nexport const b = a;',
  });

  assert.equal(check("src/lib/missing.ts"), false);
  assert.equal(check("src/lib/a.ts"), true);
});
