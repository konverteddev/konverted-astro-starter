import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCreateArgs,
  buildDatasetChoices,
  buildDeleteArgs,
  buildExportArgs,
  buildImportArgs,
  formatExportTimestamp,
  getImportConfirmationMessage,
  getMigrationMode,
  getSanityEnv,
  orderImportChoices,
  parseDatasetList,
  TYPE_DATASET_NAME,
  validateMigrationOptions,
} from "./lib";

test("getSanityEnv prefers explicit SANITY_* over the app's public pair", () => {
  const env = getSanityEnv({
    SANITY_PROJECT_ID: "explicit",
    SANITY_DATASET: "explicit-ds",
    PUBLIC_SANITY_PROJECT_ID: "public",
    PUBLIC_SANITY_DATASET: "public-ds",
  });

  assert.equal(env.SANITY_PROJECT_ID, "explicit");
  assert.equal(env.SANITY_DATASET, "explicit-ds");
});

test("getSanityEnv falls back to the app's public pair when SANITY_* are absent", () => {
  const env = getSanityEnv({
    PUBLIC_SANITY_PROJECT_ID: "pub",
    PUBLIC_SANITY_DATASET: "pub-ds",
  });

  assert.equal(env.SANITY_PROJECT_ID, "pub");
  assert.equal(env.SANITY_DATASET, "pub-ds");
});

test("getSanityEnv throws when no project id is available", () => {
  assert.throws(() => getSanityEnv({ PUBLIC_SANITY_DATASET: "ds" }));
});

test("validateMigrationOptions rejects --replace combined with --clean", () => {
  const result = validateMigrationOptions({ from: "a", to: "b", replace: true, clean: true });

  assert.equal(result.success, false);
  assert.match(result.error ?? "", /cannot be used together/);
});

test("validateMigrationOptions rejects identical source and target", () => {
  const result = validateMigrationOptions({ from: "same", to: "same" });

  assert.equal(result.success, false);
  assert.match(result.error ?? "", /cannot be the same/);
});

test("validateMigrationOptions accepts a valid migration", () => {
  assert.deepEqual(validateMigrationOptions({ from: "a", to: "b" }), { success: true });
});

test("getMigrationMode resolves clean > replace > standard precedence", () => {
  assert.equal(getMigrationMode({ clean: true, replace: true }), "clean");
  assert.equal(getMigrationMode({ replace: true }), "replace");
  assert.equal(getMigrationMode({}), "standard");
});

test("buildImportArgs targets the dataset via flag and appends --replace only when requested", () => {
  assert.deepEqual(buildImportArgs("/tmp/x.tar.gz", "prod", {}), ["dataset", "import", "/tmp/x.tar.gz", "--dataset", "prod"]);
  assert.deepEqual(buildImportArgs("/tmp/x.tar.gz", "prod", { replace: true }), [
    "dataset",
    "import",
    "/tmp/x.tar.gz",
    "--dataset",
    "prod",
    "--replace",
  ]);
});

test("buildDeleteArgs and buildCreateArgs target the right dataset", () => {
  assert.deepEqual(buildDeleteArgs("staging"), ["dataset", "delete", "staging", "--force"]);
  assert.deepEqual(buildCreateArgs("staging"), ["dataset", "create", "staging", "--visibility", "private"]);
  assert.deepEqual(buildCreateArgs("staging", "public"), ["dataset", "create", "staging", "--visibility", "public"]);
});

test("buildExportArgs orders source dataset then output path", () => {
  assert.deepEqual(buildExportArgs("prod", "/tmp/prod.tar.gz"), ["dataset", "export", "prod", "/tmp/prod.tar.gz"]);
});

test("formatExportTimestamp includes date and time so same-day runs do not collide", () => {
  assert.equal(formatExportTimestamp(new Date("2026-06-13T14:30:52.123Z")), "2026-06-13-143052");
});

test("formatExportTimestamp produces distinct values for two times on the same day", () => {
  const a = formatExportTimestamp(new Date("2026-06-13T14:30:52.000Z"));
  const b = formatExportTimestamp(new Date("2026-06-13T14:30:53.000Z"));

  assert.notEqual(a, b);
});

test("getImportConfirmationMessage warns about destruction only in clean mode", () => {
  assert.match(getImportConfirmationMessage("staging", "prod", true), /PERMANENTLY DELETE/);
  assert.doesNotMatch(getImportConfirmationMessage("staging", "prod", false), /PERMANENTLY DELETE/);
});

test("orderImportChoices lists the seed first, then backups newest first", () => {
  const choices = orderImportChoices(true, [
    { name: "production-2026-06-10-000000.tar.gz", mtimeMs: 10 },
    { name: "production-2026-06-15-000000.tar.gz", mtimeMs: 50 },
  ]);

  assert.deepEqual(choices, [
    { title: "seed/seed-dataset.tar.gz (bundled starter content)", value: "seed/seed-dataset.tar.gz" },
    { title: "backups/production-2026-06-15-000000.tar.gz", value: "backups/production-2026-06-15-000000.tar.gz" },
    { title: "backups/production-2026-06-10-000000.tar.gz", value: "backups/production-2026-06-10-000000.tar.gz" },
  ]);
});

test("orderImportChoices omits the seed when it is absent", () => {
  assert.deepEqual(orderImportChoices(false, [{ name: "a.tar.gz", mtimeMs: 1 }]), [
    { title: "backups/a.tar.gz", value: "backups/a.tar.gz" },
  ]);
});

test("parseDatasetList keeps dataset names and drops CLI noise, banners and aliases", () => {
  const stdout = [
    "[dotenvx@2.19.2] injecting env (7) from .env",
    "production",
    "staging",
    "dev_2",
    "~live -> production",
    "No datasets found for this project.",
    "",
  ].join("\n");

  assert.deepEqual(parseDatasetList(stdout), ["production", "staging", "dev_2"]);
});

test("parseDatasetList strips ANSI colour codes and de-duplicates", () => {
  assert.deepEqual(parseDatasetList("\u001B[32mproduction\u001B[39m\nproduction\n"), ["production"]);
});

test("parseDatasetList returns nothing when the output has no dataset names", () => {
  assert.deepEqual(parseDatasetList("No datasets found for this project.\n"), []);
});

test("buildDatasetChoices lists the .env dataset first and always offers a typed name", () => {
  assert.deepEqual(buildDatasetChoices(["staging", "production"], { current: "production" }), [
    { title: "production (from .env)", value: "production" },
    { title: "staging", value: "staging" },
    { title: "Other (type a name)", value: TYPE_DATASET_NAME },
  ]);
});

test("buildDatasetChoices keeps the given order when the current dataset is not listed", () => {
  assert.deepEqual(buildDatasetChoices(["staging"], { current: "production", typeNameLabel: "Type a name" }), [
    { title: "staging", value: "staging" },
    { title: "Type a name", value: TYPE_DATASET_NAME },
  ]);
});

test("buildDatasetChoices offers the typed name even with no datasets", () => {
  assert.deepEqual(buildDatasetChoices([]), [{ title: "Other (type a name)", value: TYPE_DATASET_NAME }]);
});

// Matched on the suffix, so these scripts read the app's own values in any host, not just this project's prefix.
test("getSanityEnv reads the public pair under whatever prefix the host gives it", () => {
  for (const prefix of ["PUBLIC_", "NEXT_PUBLIC_", "VITE_PUBLIC_"]) {
    const env = { [`${prefix}SANITY_PROJECT_ID`]: "pid", [`${prefix}SANITY_DATASET`]: "ds" };

    assert.deepEqual(getSanityEnv(env), { SANITY_PROJECT_ID: "pid", SANITY_DATASET: "ds" });
  }
});
