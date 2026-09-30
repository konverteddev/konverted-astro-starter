#!/usr/bin/env node

/**
 * Exports one Sanity dataset and imports it into another. Interactive unless every flag is passed.
 * Usage: npm run sanity:dataset-migrate [-- --from <a> --to <b> --replace|--clean --yes]
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  askConfirm,
  askSelect,
  cancel,
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
import {
  buildCreateArgs,
  buildDeleteArgs,
  buildExportArgs,
  buildImportArgs,
  formatExportTimestamp,
  getImportConfirmationMessage,
  getMigrationMode,
  getSanityEnv,
  runSanityCommand,
  validateMigrationOptions,
} from "./lib";

const MODE_SUMMARY = {
  clean: "CLEAN (deletes and recreates the target as private)",
  replace: "REPLACE (overwrites existing documents with the same IDs)",
  standard: "STANDARD (fails if documents with the same IDs exist)",
} as const;

const program = new Command();

program
  .name("dataset-migrate")
  .description("Export data from one Sanity dataset and import it into another")
  .option("--from <dataset>", "Source dataset to export from (defaults to an interactive picker)")
  .option("--to <dataset>", "Target dataset to import into (defaults to an interactive picker)")
  .option("--skip-cleanup", "Keep the exported file after import completes", false)
  .option("--replace", "Replace existing documents with the same IDs (cannot be used with --clean)")
  .option("--clean", "Delete and recreate target dataset as private before import for a clean slate")
  .option("--dry-run", "Show the plan and exit without exporting or importing", false)
  .option("-y, --yes", "Skip all prompts (requires --from and --to)", false)
  .version("2.0.0");

program.parse();

const options = program.opts<{
  from?: string;
  to?: string;
  skipCleanup: boolean;
  replace?: boolean;
  clean?: boolean;
  dryRun: boolean;
  yes: boolean;
}>();
const interactive = !options.yes && !options.dryRun;

async function main() {
  printHeader("🔄", "Sanity dataset migration", ["Exports one dataset and imports it into another, via ./backups."]);

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

  if (!interactive && (!options.from || !options.to)) {
    fail("--from and --to are required with --yes or --dry-run (there is no interactive picker).");
  }

  // One dataset lookup serves both pickers; skipped entirely when both datasets come from flags.
  const datasets = interactive && (!options.from || !options.to) ? loadDatasets() : [];

  let from = options.from ?? "";
  if (!from) {
    from = await askDataset("Which dataset do you want to copy FROM?", { datasets, current: env.SANITY_DATASET });
  }

  let to = options.to ?? "";
  if (!to) {
    to = await askDataset("Which dataset do you want to copy INTO?", {
      // The source cannot also be the target, so keep it out of the list rather than failing later.
      datasets: datasets.filter((name) => name !== from),
      typeNameLabel: "Other (type a name, it may not exist yet)",
      typeNameMessage: "Target dataset name",
    });
  }

  let mode = getMigrationMode(options);
  if (options.replace === undefined && options.clean === undefined && interactive) {
    mode = await askSelect("How should the import handle the target?", [
      { title: "Standard (fail if documents with the same IDs exist)", value: "standard" as const },
      { title: "Replace (overwrite documents with the same IDs)", value: "replace" as const },
      { title: "Clean (delete the target, recreate it as private, then import)", value: "clean" as const },
    ]);
  }

  const isClean = mode === "clean";
  const isReplace = mode === "replace";

  // Raw flags, so `--replace --clean` is still rejected as a conflict rather than resolved by mode precedence.
  const validationResult = validateMigrationOptions({
    from,
    to,
    replace: options.replace ?? isReplace,
    clean: options.clean ?? isClean,
  });

  if (!validationResult.success) {
    fail(validationResult.error ?? "Invalid migration options.");
  }

  const backupsDir = join(process.cwd(), "backups");
  const timestamp = formatExportTimestamp(new Date());
  const exportPath = join(backupsDir, `${from}-${timestamp}.tar.gz`);

  printSummary([
    { label: "Source", value: from },
    { label: "Target", value: to },
    { label: "Project ID", value: SANITY_PROJECT_ID },
    { label: "Mode", value: MODE_SUMMARY[mode] },
    { label: "Export file", value: options.skipCleanup ? `kept at ${exportPath}` : `${exportPath} (removed after import)` },
  ]);

  if (options.dryRun) {
    finishDryRun();
  }

  if (interactive) {
    await confirmOrCancel(getImportConfirmationMessage(to, from, isClean));
  }

  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  printStep("📦", `Exporting "${from}"…`);

  try {
    runSanityCommand(buildExportArgs(from, exportPath), "Export");
  } catch (error) {
    fail("Export failed.", error instanceof Error ? error.message : String(error));
  }

  if (!existsSync(exportPath)) {
    fail("Export file not found.", exportPath);
  }

  if (isClean) {
    // Clean mode destroys the target and the source export does not protect it, so snapshot first or confirm.
    const targetBackupPath = join(backupsDir, `${to}-pre-clean-${timestamp}.tar.gz`);
    printStep("💾", `Backing up "${to}" before clean… (${targetBackupPath})`);

    try {
      runSanityCommand(buildExportArgs(to, targetBackupPath), "Target backup");
      console.log(`✅ Target backup saved: ${targetBackupPath}`);
    } catch (error) {
      console.warn(`\n⚠️  Could not back up "${to}" (it may not exist yet, or the export failed).`);
      console.warn(`   ${error instanceof Error ? error.message : String(error)}`);

      const proceed = options.yes || (await askConfirm(`Proceed to DELETE "${to}" WITHOUT a fresh backup of it?`));

      if (!proceed) {
        cancel(`No target backup, so nothing was deleted. Source export saved at: ${exportPath}`);
      }
    }

    printStep("🗑️", `Deleting "${to}"…`);
    try {
      runSanityCommand(buildDeleteArgs(to), "Dataset delete");
      console.log(`✅ Dataset "${to}" deleted.`);
    } catch (error) {
      fail(
        "Failed to delete target dataset.",
        error instanceof Error ? error.message : String(error),
        `Export file preserved at: ${exportPath}`
      );
    }

    printStep("🏗️", `Creating "${to}" as PRIVATE…`);
    try {
      runSanityCommand(buildCreateArgs(to), "Dataset create");
      console.log(`✅ Dataset "${to}" created as private.`);
    } catch (error) {
      fail(
        "Failed to create target dataset.",
        error instanceof Error ? error.message : String(error),
        `Export file preserved at: ${exportPath}`
      );
    }
  }

  printStep("📥", `Importing into "${to}"…`);

  try {
    runSanityCommand(buildImportArgs(exportPath, to, { replace: isReplace }), "Import");
  } catch (error) {
    fail("Import failed.", error instanceof Error ? error.message : String(error), `Export file preserved at: ${exportPath}`);
  }

  if (options.skipCleanup) {
    console.log(`\n📁 Export file preserved at: ${exportPath}`);
  } else {
    try {
      rmSync(exportPath);
      console.log("\n🧹 Cleaned up temporary export file.");
    } catch (_error) {
      console.warn(`\n⚠️  Warning: Failed to clean up export file: ${exportPath}`);
    }
  }

  printDone("Migration completed.", `${from} → ${to}`);
}

main().catch((error) => {
  fail("Unexpected error.", error instanceof Error ? (error.stack ?? error.message) : String(error));
});
