import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  ensureEnvFromExample,
  formatEnvValue,
  parseJsonFromCliOutput,
  parseTokenSecret,
  readLocalSiteOrigin,
  readPublicEnvPrefix,
  upsertEnvFile,
} from "./lib";

test("formatEnvValue quotes values with whitespace or special characters", () => {
  assert.equal(formatEnvValue("plainvalue"), "plainvalue");
  assert.equal(formatEnvValue("has space"), '"has space"');
  assert.equal(formatEnvValue('has"quote'), '"has\\"quote"');
});

test("parseJsonFromCliOutput ignores spinner noise before the object", () => {
  const parsed = parseJsonFromCliOutput('⠋ working...\n{"projectId":"abc"}');

  assert.equal(parsed.projectId, "abc");
});

test("parseJsonFromCliOutput ignores trailing notices after the object", () => {
  const parsed = parseJsonFromCliOutput('{"token":"sk-123"}\n\nA new version of sanity is available.');

  assert.equal(parsed.token, "sk-123");
});

test("parseJsonFromCliOutput handles nested objects and braces inside strings", () => {
  const parsed = parseJsonFromCliOutput('prefix {"a":{"b":1},"label":"a } b"} trailing');

  assert.deepEqual(parsed, { a: { b: 1 }, label: "a } b" });
});

test("parseJsonFromCliOutput throws when no object is present", () => {
  assert.throws(() => parseJsonFromCliOutput("no json here"));
});

test("parseTokenSecret reads the secret from the robot record's token field", () => {
  const secret = parseTokenSecret({ id: "g-abc", label: "Frontend - View", memberships: [], token: "sk-new" });

  assert.equal(secret, "sk-new");
});

test("parseTokenSecret falls back to the legacy key field", () => {
  assert.equal(parseTokenSecret({ key: "sk-legacy" }), "sk-legacy");
});

test("parseTokenSecret rejects a record without a secret and never echoes the values", () => {
  assert.throws(
    () => parseTokenSecret({ id: "g-abc", label: "secret-looking-label" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /no token or key field/);
      assert.match(error.message, /id, label/);
      assert.doesNotMatch(error.message, /secret-looking-label/);
      return true;
    }
  );
});

test("upsertEnvFile updates existing keys and appends new ones, preserving other lines", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-test-"));
  const file = join(dir, ".env");

  try {
    writeFileSync(file, "# comment\nKEEP_ME=untouched\nPUBLIC_SANITY_PROJECT_ID=old\n", "utf8");
    upsertEnvFile(file, { PUBLIC_SANITY_PROJECT_ID: "new", SANITY_API_VIEW_TOKEN: "token123" });

    const out = readFileSync(file, "utf8");

    assert.match(out, /# comment/);
    assert.match(out, /KEEP_ME=untouched/);
    assert.match(out, /PUBLIC_SANITY_PROJECT_ID=new/);
    assert.doesNotMatch(out, /PUBLIC_SANITY_PROJECT_ID=old/);
    assert.match(out, /SANITY_API_VIEW_TOKEN=token123/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("upsertEnvFile replaces an exported key in place rather than duplicating it", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-test-"));
  const file = join(dir, ".env");

  try {
    writeFileSync(file, "export FOO=old\n", "utf8");
    upsertEnvFile(file, { FOO: "new" });

    const out = readFileSync(file, "utf8");

    assert.match(out, /FOO=new/);
    assert.equal(out.match(/FOO=/g)?.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ensureEnvFromExample copies the example only when the target is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-test-"));
  const example = join(dir, ".env.example");
  const target = join(dir, ".env");

  try {
    writeFileSync(example, "PUBLIC_SITE_URL=http://localhost:4321\n", "utf8");

    assert.equal(ensureEnvFromExample(target, example), true);
    assert.match(readFileSync(target, "utf8"), /PUBLIC_SITE_URL/);
    assert.equal(ensureEnvFromExample(target, example), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The two host facts read from `.env.example`, so the wizard writes keys the host reads and a CORS default that matches.
test("readPublicEnvPrefix takes the prefix the example gives the Sanity project id", () => {
  assert.equal(readPublicEnvPrefix("PUBLIC_SANITY_PROJECT_ID=abc\n"), "PUBLIC_");
  assert.equal(readPublicEnvPrefix("NEXT_PUBLIC_SANITY_PROJECT_ID=abc\n"), "NEXT_PUBLIC_");
  assert.equal(readPublicEnvPrefix("VITE_PUBLIC_SANITY_PROJECT_ID = abc\n"), "VITE_PUBLIC_");
});

test("readPublicEnvPrefix ignores a commented line and falls back when the key is absent", () => {
  assert.equal(readPublicEnvPrefix("# NEXT_PUBLIC_SANITY_PROJECT_ID=abc\nPUBLIC_SANITY_PROJECT_ID=abc\n"), "PUBLIC_");
  assert.equal(readPublicEnvPrefix("SANITY_API_EDIT_TOKEN=\n"), "PUBLIC_");
  assert.equal(readPublicEnvPrefix(""), "PUBLIC_");
});

test("readLocalSiteOrigin takes the dev origin the example points at, whatever the key is called", () => {
  assert.equal(readLocalSiteOrigin("PUBLIC_SITE_URL=http://localhost:4321\n", "http://localhost:3000"), "http://localhost:4321");
  assert.equal(readLocalSiteOrigin("NEXT_PUBLIC_URL=http://localhost:3000\n", "http://localhost:4321"), "http://localhost:3000");
});

test("readLocalSiteOrigin falls back when the example carries no local origin", () => {
  assert.equal(readLocalSiteOrigin("PUBLIC_SITE_URL=https://example.com\n", "http://localhost:4321"), "http://localhost:4321");
  assert.equal(readLocalSiteOrigin("", "http://localhost:4321"), "http://localhost:4321");
});
