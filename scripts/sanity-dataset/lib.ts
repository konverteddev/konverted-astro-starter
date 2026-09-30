/**
 * Pure dataset-migration helpers, except `runSanityCommand` / `captureSanityCommand`, which shell out
 * to the Sanity CLI and are never called by tests.
 */

import { spawnSync } from "node:child_process";
import { z } from "zod";

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

/** Runs a Sanity CLI command via `npm run sanity:cli`; spawnSync (no shell) prevents injection. */
export function runSanityCommand(args: string[], description: string): void {
  const result = spawnSync(npmBin, ["run", "sanity:cli", "--", ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${description} process exited with code ${result.status}`);
  }
}

/** Captures stdout for commands whose output is read rather than shown; `--silent` keeps npm's banner out of it. */
export function captureSanityCommand(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(npmBin, ["run", "--silent", "sanity:cli", "--", ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  });

  return {
    ok: !result.error && result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const sanityEnvSchema = z.object({
  SANITY_PROJECT_ID: z.string().min(1),
  SANITY_DATASET: z.string().min(1),
});

export type MigrationOptions = {
  from: string;
  to: string;
  skipCleanup?: boolean;
  replace?: boolean;
  clean?: boolean;
};

export type ValidationResult = {
  success: boolean;
  error?: string;
};

export type SanityEnv = {
  SANITY_PROJECT_ID: string;
  SANITY_DATASET: string;
};

/** Matched on the suffix rather than by name, so these scripts run unchanged whatever prefix a host uses. */
function readPublicValue(env: Record<string, string | undefined>, suffix: string): string | undefined {
  const key = Object.keys(env).find((name) => name.endsWith(`PUBLIC_${suffix}`) && env[name]);

  return key ? env[key] : undefined;
}

/** Accepts `SANITY_PROJECT_ID`/`SANITY_DATASET`, or the app's public pair under whatever prefix it carries. */
export function getSanityEnv(env: Record<string, string | undefined>): SanityEnv {
  const merged = {
    SANITY_PROJECT_ID: env.SANITY_PROJECT_ID ?? readPublicValue(env, "SANITY_PROJECT_ID"),
    SANITY_DATASET: env.SANITY_DATASET ?? readPublicValue(env, "SANITY_DATASET"),
  };
  return sanityEnvSchema.parse(merged);
}

export function validateMigrationOptions(options: MigrationOptions): ValidationResult {
  if (options.replace && options.clean) {
    return {
      success: false,
      error:
        "--replace and --clean cannot be used together. --clean already ensures a fresh dataset (making --replace redundant).",
    };
  }

  if (options.from === options.to) {
    return {
      success: false,
      error: "Source and target datasets cannot be the same.",
    };
  }

  return { success: true };
}

export function getMigrationMode(options: Pick<MigrationOptions, "clean" | "replace">): "clean" | "replace" | "standard" {
  if (options.clean) {
    return "clean";
  }

  if (options.replace) {
    return "replace";
  }
  return "standard";
}

export function buildImportArgs(exportPath: string, targetDataset: string, options: Pick<MigrationOptions, "replace">): string[] {
  // Use the `--dataset` flag rather than the deprecated positional target argument.
  const args = ["dataset", "import", exportPath, "--dataset", targetDataset];

  if (options.replace) {
    args.push("--replace");
  }

  return args;
}

export type ArchiveEntry = { name: string; mtimeMs: number };

/** Bundled seed first, then `./backups` newest first. Pure: the caller passes the filesystem metadata in. */
export function orderImportChoices(seedExists: boolean, backups: ArchiveEntry[]): { title: string; value: string }[] {
  const choices: { title: string; value: string }[] = [];

  if (seedExists) {
    choices.push({ title: "seed/seed-dataset.tar.gz (bundled starter content)", value: "seed/seed-dataset.tar.gz" });
  }

  for (const entry of [...backups].sort((a, b) => b.mtimeMs - a.mtimeMs)) {
    choices.push({ title: `backups/${entry.name}`, value: `backups/${entry.name}` });
  }

  return choices;
}

/** Sanity dataset names: lowercase letters, numbers, underscores and dashes, up to 64 characters. */
const DATASET_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** Sentinel choice value meaning "none of these, let me type a name". */
export const TYPE_DATASET_NAME = Symbol("type-dataset-name");

/** Arguments for `sanity dataset list`, used to populate the interactive dataset pickers. */
export function buildListArgs(): string[] {
  return ["dataset", "list"];
}

/** Anything that is not a bare dataset name is dropped, so banners and `~alias -> target` lines never reach the picker. */
export function parseDatasetList(stdout: string): string[] {
  const names = stdout
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI colour codes from CLI output.
    .replace(/\u001B\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => DATASET_NAME.test(line));

  return [...new Set(names)];
}

/** The known datasets, `current` first, plus a "type a name" escape hatch so an unlisted one is always reachable. */
export function buildDatasetChoices(
  datasets: string[],
  options: { current?: string; typeNameLabel?: string } = {}
): { title: string; value: string | typeof TYPE_DATASET_NAME }[] {
  const { current, typeNameLabel = "Other (type a name)" } = options;
  const ordered = current && datasets.includes(current) ? [current, ...datasets.filter((name) => name !== current)] : datasets;

  const choices: { title: string; value: string | typeof TYPE_DATASET_NAME }[] = ordered.map((name) => ({
    title: name === current ? `${name} (from .env)` : name,
    value: name,
  }));

  choices.push({ title: typeNameLabel, value: TYPE_DATASET_NAME });

  return choices;
}

export function buildDeleteArgs(dataset: string): string[] {
  return ["dataset", "delete", dataset, "--force"];
}

export function buildCreateArgs(dataset: string, visibility: "public" | "private" = "private"): string[] {
  return ["dataset", "create", dataset, "--visibility", visibility];
}

export function buildExportArgs(sourceDataset: string, exportPath: string): string[] {
  return ["dataset", "export", sourceDataset, exportPath];
}

/** `YYYY-MM-DD-HHMMSS` (UTC): the time stops two runs on one day from overwriting each other's backup. */
export function formatExportTimestamp(date: Date): string {
  const [datePart = "", timePart = ""] = date.toISOString().split("T");
  const hms = timePart.slice(0, 8).replace(/:/g, "");

  if (!datePart) {
    return "";
  }

  return hms ? `${datePart}-${hms}` : datePart;
}

export function getImportConfirmationMessage(to: string, from: string, isCleanMode: boolean): string {
  if (isCleanMode) {
    return `⚠️  DESTRUCTIVE WARNING: Do you want to DELETE and RECREATE the "${to}" dataset as PRIVATE,\n   then import data from "${from}"? This will PERMANENTLY DELETE all existing data in "${to}".`;
  }
  return `⚠️  WARNING: Do you want to import this data into the "${to}" dataset?\n   This will overwrite existing data in "${to}".`;
}
