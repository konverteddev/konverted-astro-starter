#!/usr/bin/env node

/**
 * Exports a Sanity dataset to a local .tar.gz backup. Interactive unless every flag is passed.
 * Usage: npm run sanity:dataset-export [-- --dataset <name> --no-assets --yes]
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  askConfirm,
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
import { buildExportArgs, formatExportTimestamp, getSanityEnv, runSanityCommand } from "./lib";

const program = new Command();

program
  .name("dataset-export")
  .description("Export a Sanity dataset to a local backup file")
  .option("--dataset <dataset>", "Dataset to export (defaults to an interactive picker)")
  .option("--no-assets", "Skip exporting assets (documents only, faster and smaller)")
  .option("--dry-run", "Show the plan and exit without exporting", false)
  .option("-y, --yes", "Skip all prompts (defaults the dataset to the .env one)", false)
  .version("1.1.0");

program.parse();

const options = program.opts<{ dataset?: string; assets: boolean; dryRun: boolean; yes: boolean }>();
/** `--no-assets` always leaves `assets` set, so ask commander whether the user actually passed it. */
const assetsAnswered = program.getOptionValueSource("assets") === "cli";
const interactive = !options.yes && !options.dryRun;

async function main() {
  printHeader("📦", "Sanity dataset export", ["Backs up one dataset to ./backups as a timestamped .tar.gz archive."]);

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

  let dataset = options.dataset ?? "";
  if (!dataset) {
    if (!interactive) {
      dataset = env.SANITY_DATASET;
    } else {
      dataset = await askDataset("Which dataset do you want to export?", {
        datasets: loadDatasets(),
        current: env.SANITY_DATASET,
      });
    }
  }

  let assets = options.assets;
  if (!assetsAnswered && interactive) {
    assets = await askConfirm("Include assets (images and files)?", true);
  }

  const timestamp = formatExportTimestamp(new Date());
  const backupsDir = join(process.cwd(), "backups");
  const exportPath = join(backupsDir, `${dataset}-${timestamp}.tar.gz`);

  printSummary([
    { label: "Dataset", value: dataset },
    { label: "Project ID", value: SANITY_PROJECT_ID },
    { label: "Assets", value: assets ? "included" : "skipped" },
    { label: "Output", value: exportPath },
  ]);

  if (options.dryRun) {
    finishDryRun();
  }

  if (interactive) {
    await confirmOrCancel(`Export the "${dataset}" dataset?`);
  }

  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  printStep("📦", `Exporting "${dataset}"…`);

  try {
    const args = buildExportArgs(dataset, exportPath);

    if (!assets) {
      args.push("--no-assets");
    }
    runSanityCommand(args, "Export");
  } catch (error) {
    fail("Export failed.", error instanceof Error ? error.message : String(error));
  }

  if (!existsSync(exportPath)) {
    fail("Export file not found after export.", exportPath);
  }

  printDone("Export completed.", `Backup saved at: ${exportPath}`);
}

main().catch((error) => {
  fail("Unexpected error.", error instanceof Error ? (error.stack ?? error.message) : String(error));
});
