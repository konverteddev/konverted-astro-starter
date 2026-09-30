#!/usr/bin/env node

/**
 * Imports a local `.tar.gz` export into a Sanity dataset. Interactive unless every flag is passed.
 * Usage: npm run sanity:dataset-import [-- --file <path> --dataset <name> --replace --yes]
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  askConfirm,
  askSelect,
  confirmOrCancel,
  fail,
  finishDryRun,
  printDone,
  printDryRunNotice,
  printHeader,
  printStep,
  printSummary,
} from "../lib/cli";
import { askDataset, loadDatasets } from "./dataset-picker";
import { type ArchiveEntry, buildImportArgs, getSanityEnv, orderImportChoices, runSanityCommand } from "./lib";

/** Collects importable archives (the seed and `./backups`) with fs metadata for the picker. */
function collectArchiveChoices(cwd: string): { title: string; value: string }[] {
  const seedExists = existsSync(join(cwd, "seed", "seed-dataset.tar.gz"));
  const backupsDir = join(cwd, "backups");
  const backups: ArchiveEntry[] = existsSync(backupsDir)
    ? readdirSync(backupsDir)
        .filter((name) => name.endsWith(".tar.gz"))
        .map((name) => ({ name, mtimeMs: statSync(join(backupsDir, name)).mtimeMs }))
    : [];

  return orderImportChoices(seedExists, backups);
}

const program = new Command();

program
  .name("dataset-import")
  .description("Import a local .tar.gz export into a Sanity dataset (restore or seed)")
  .option("--dataset <dataset>", "Target dataset to import into (defaults to the .env dataset)")
  .option("--file <path>", "Archive to import (defaults to an interactive picker)")
  .option("--replace", "Replace existing documents with the same IDs")
  .option("--dry-run", "Show the plan and exit without importing", false)
  .option("-y, --yes", "Skip all prompts (requires --file)", false)
  .version("1.1.0");

program.parse();

const options = program.opts<{ dataset?: string; file?: string; replace?: boolean; dryRun: boolean; yes: boolean }>();
const interactive = !options.yes && !options.dryRun;

async function main() {
  printHeader("📥", "Sanity dataset import", ["Restores a local .tar.gz archive (a backup or the bundled seed) into a dataset."]);

  if (options.dryRun) {
    printDryRunNotice();
  }

  let env: { SANITY_PROJECT_ID: string; SANITY_DATASET: string };
  try {
    env = getSanityEnv(process.env);
  } catch (error) {
    fail(
      "Failed to load Sanity environment variables.",
      "Set SANITY_PROJECT_ID and SANITY_DATASET, or the app's public Sanity pair, in `.env`.",
      error instanceof Error ? error.message : String(error)
    );
  }

  const { SANITY_PROJECT_ID } = env;

  let filePath = options.file ?? "";
  if (!filePath) {
    if (!interactive) {
      fail("--file is required with --yes or --dry-run (there is no interactive picker).");
    }

    const choices = collectArchiveChoices(process.cwd());
    if (choices.length === 0) {
      fail("No archives found.", "Pass --file <path>, or create a backup with `npm run sanity:dataset-export`.");
    }

    filePath = await askSelect("Which archive do you want to import?", choices);
  }

  if (!existsSync(filePath)) {
    fail(`Archive not found at ${filePath}`);
  }

  let dataset = options.dataset ?? "";
  if (!dataset) {
    if (!interactive) {
      dataset = env.SANITY_DATASET;
    } else {
      dataset = await askDataset("Which dataset do you want to import into?", {
        datasets: loadDatasets(),
        current: env.SANITY_DATASET,
        typeNameLabel: "Other (type a name)",
        typeNameMessage: "Target dataset to import into",
      });
    }
  }

  let replace = options.replace ?? false;
  if (options.replace === undefined && interactive) {
    replace = await askConfirm("Replace documents that already exist (same IDs)?");
  }

  printSummary([
    { label: "Archive", value: filePath },
    { label: "Dataset", value: dataset },
    { label: "Project ID", value: SANITY_PROJECT_ID },
    { label: "Mode", value: replace ? "REPLACE (overwrite same-ID docs)" : "STANDARD (fails on same-ID docs)" },
  ]);

  if (options.dryRun) {
    finishDryRun();
  }

  if (interactive) {
    await confirmOrCancel(`Import "${filePath}" into the "${dataset}" dataset? This modifies "${dataset}".`);
  }

  printStep("📥", `Importing into "${dataset}"…`);

  try {
    runSanityCommand(buildImportArgs(filePath, dataset, { replace }), "Import");
  } catch (error) {
    fail("Import failed.", error instanceof Error ? error.message : String(error));
  }

  printDone("Import completed.", `${filePath} → ${dataset}`);
}

main().catch((error) => {
  fail("Unexpected error.", error instanceof Error ? (error.stack ?? error.message) : String(error));
});
