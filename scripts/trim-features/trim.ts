#!/usr/bin/env node

/**
 * Removes a feature from this starter, in the code and in the dataset.
 *
 * The starter ships as a superset: every project that starts from it inherits a blog, legal pages, a
 * contact form and four page-builder sections whether or not it wants them. Taking one out by hand
 * means finding thirty-odd files across routes, schemas, registries, GROQ strings, sitemap tags and
 * docs, and it never includes the live content. This does all of it deterministically, or refuses to
 * start.
 *
 * It only removes. Nothing is added back, and nothing is rewired: a feature whose removal would mean
 * rewriting a route rather than unwiring a registry pulls in the feature it is welded to instead
 * (see `implies` in `features.ts`).
 *
 * Undo is `git checkout .`, which is why a dirty tree stops the run.
 *
 * Usage:
 *   npm run trim
 *   npm run trim -- --dry-run
 *   npm run trim -- --feature blog --feature section:media
 *   npm run trim -- --feature blog --dataset
 *   npm run trim -- --feature blog --dataset trim-test --yes
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Command } from "commander";
import {
  askConfirm,
  askMultiSelect,
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
  SKIPPED,
  type SummaryRow,
} from "../lib/cli";
import { createEditClient } from "../lib/sanity-client";
import { askDataset, loadDatasets } from "../sanity-dataset/dataset-picker";
import { buildExportArgs, formatExportTimestamp, getSanityEnv, runSanityCommand } from "../sanity-dataset/lib";
import { formatPurgePlan, formatUsageReport, purge, readStranded, readUsage } from "./dataset";
import { applyEdits, describeEdit, type Edit, type FileEdits, type Resolution, resolveEdits, type Unresolved } from "./edits";
import { FEATURES, type Feature, findMissingLandmarks, findSelectionConflicts, onDisk, resolveSelection } from "./features";
import { buildImportIndex } from "./importers";
import { diffKnipReports, formatKnipReport, isEmptyReport, type KnipReport, runKnip } from "./knip";
import { findMentions, formatMentions, mentionTerms } from "./mentions";
import {
  detectRole,
  type FeatureStatus,
  findOutsideImporters,
  isOfferable,
  isTrimBehind,
  listSections,
  originRepository,
  PROJECT_FILE,
  type ProjectRecord,
  readProjectRecord,
  recordTrimmed,
  starterSources,
  today,
  writeProjectRecord,
} from "./project";
import { formatOrphanReport, parseRegisteredTypes } from "./schema";
import {
  describeUsage,
  formatSurvey,
  hasStranded,
  needsRecording,
  orderDatasets,
  runReconcile,
  runStatus,
  type Survey,
  survey,
} from "./status";

const root = process.cwd();

/** The extracted schema: the one artifact that states the content model outright. */
const SCHEMA_FILE = "sanity-schema.json";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const program = new Command();

program
  .name("trim")
  .description("Interactively remove a feature from this starter, in the code and in the dataset")
  .option("--feature <id...>", "Feature ids to remove (repeatable); skips the picker")
  .option("--dataset [name]", "Also purge the dataset. Optionally names the dataset to read and purge")
  .option("--dataset-only", "Purge the dataset only: delete content whose type the schema no longer declares", false)
  .option("--type <name...>", "With --dataset-only, the stranded types to delete (defaults to a picker)")
  .option("--no-dataset-check", "Skip the dataset usage report and choose without it")
  .option("--no-knip", "Skip the knip sweep for what the manifest did not know about")
  .option("--allow-dirty", "Run against an uncommitted working tree (undo stops being `git checkout .`)", false)
  .option("--partial", "Apply the edits that still resolve and report the rest as manual follow-up", false)
  .option("--status", "Print what this repository has of the starter, and what it uses, then exit", false)
  .option("--reconcile", `Record what the tree cannot say (cut date, adopted features, own sections) in project.json`, false)
  .option("--cut-from <date>", "With --reconcile, the day this project was cut from the starter (YYYY-MM-DD)")
  .option("--adopt <id...>", "With --reconcile, starter features this project took over and changed")
  .option("--from <source>", "With --reconcile, the starter to find the fork point against (defaults to project.json's)")
  .option("--dry-run", "Print the plan and exit without writing anything", false)
  .option("-y, --yes", "Skip all prompts (requires --feature)", false)
  .version("1.0.0");

program.parse();

const options = program.opts<{
  feature?: string[];
  dataset?: string | boolean;
  datasetOnly: boolean;
  type?: string[];
  datasetCheck: boolean;
  knip: boolean;
  allowDirty: boolean;
  partial: boolean;
  status: boolean;
  reconcile: boolean;
  cutFrom?: string;
  adopt?: string[];
  from?: string;
  dryRun: boolean;
  yes: boolean;
}>();

const interactive = !options.yes && !options.dryRun;
// `--dataset-only` is a purge, so it implies `--dataset` rather than having to be paired with it.
const purgeRequested = options.dataset !== undefined || options.datasetOnly;
const datasetOverride = typeof options.dataset === "string" ? options.dataset : undefined;

/** Runs a command with its output inherited; returns the exit code rather than throwing. */
function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: root });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function read(file: string): string {
  return readFileSync(join(root, file), "utf8");
}

function exists(path: string): boolean {
  return existsSync(join(root, path));
}

function write(file: string, contents: string): void {
  writeFileSync(join(root, file), contents, "utf8");
}

/** Every Markdown file that could carry an index link, so a deleted doc leaves no dead link behind. */
function markdownFiles(): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") {
        continue;
      }

      const path = join(dir, entry);

      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }

      if (entry.endsWith(".md")) {
        found.push(relative(root, path));
      }
    }
  };

  walk(root);

  return found;
}

/** The trim's own docs name every feature, so they are never reported as describing one. */
const OWN_PROSE = ["docs/features/trimming-features.md", ".agents/skills/trim-features/", "scripts/"];

/** Where prose describing a feature lives: docs, skills and the two top-level guides. */
function proseFiles(): string[] {
  return markdownFiles().filter(
    (path) =>
      (path.startsWith("docs/") || path.startsWith(".agents/skills/") || path === "AGENTS.md" || path === "README.md") &&
      !OWN_PROSE.some((own) => path.startsWith(own))
  );
}

/**
 * Index links to a doc that is about to be deleted, as concrete edits.
 *
 * Derived rather than declared: the manifest names the doc, and every bullet pointing at it in
 * `docs/README.md`, the root README and anywhere else is found here. A doc gains an index entry far
 * more often than it moves, so listing them by hand would rot immediately.
 */
function docLinkEdits(docs: string[]): FileEdits[] {
  if (docs.length === 0) {
    return [];
  }

  const targets = docs.map((doc) => doc.replace(/^docs\//, ""));
  const byFile = new Map<string, Edit[]>();

  for (const file of markdownFiles()) {
    if (docs.includes(file)) {
      continue;
    }

    const lines = read(file).split("\n");

    for (const target of targets) {
      const count = lines.filter((line) => line.includes(target)).length;

      if (count === 0) {
        continue;
      }

      byFile.set(file, [...(byFile.get(file) ?? []), { kind: "dropLines", contains: target, count }]);
    }
  }

  return [...byFile].map(([file, edits]) => ({ file, edits }));
}

/** Skill index lines and the lock entry that outlive a deleted `.agents/skills/<name>`. */
function skillEdits(skills: string[]): FileEdits[] {
  if (skills.length === 0) {
    return [];
  }

  const byFile = new Map<string, Edit[]>();

  for (const file of ["AGENTS.md", "docs/features/agent-skills.md"]) {
    if (!existsSync(join(root, file))) {
      continue;
    }

    const lines = read(file).split("\n");

    for (const skill of skills) {
      const marker = `.agents/skills/${skill}/`;
      const count = lines.filter((line) => line.includes(marker)).length;

      if (count > 0) {
        byFile.set(file, [...(byFile.get(file) ?? []), { kind: "dropLines", contains: marker, count }]);
      }
    }
  }

  return [...byFile].map(([file, edits]) => ({ file, edits }));
}

/** The lines a `dropLines` matcher would take, trimmed and capped so the plan stays readable. */
function matchingLines(file: string, contains: string): string[] {
  if (!existsSync(join(root, file))) {
    return [];
  }

  return read(file)
    .split("\n")
    .filter((line) => line.includes(contains))
    .map((line) => {
      const text = line.trim();

      return text.length > 108 ? `${text.slice(0, 105)}…` : text;
    });
}

/** Merges the per-feature edits into one list per file, so each file is parsed and written once. */
function groupEdits(fileEdits: FileEdits[]): FileEdits[] {
  const byFile = new Map<string, FileEdits>();

  for (const entry of fileEdits) {
    const existing = byFile.get(entry.file);

    if (existing) {
      existing.edits.push(...entry.edits);
      existing.optional = existing.optional && entry.optional;
      continue;
    }

    byFile.set(entry.file, { ...entry, edits: [...entry.edits] });
  }

  return [...byFile.values()];
}

type Plan = {
  features: Feature[];
  paths: string[];
  edits: FileEdits[];
  dependencies: string[];
  env: string[];
  documentTypes: string[];
  sectionTypes: string[];
  skills: string[];
  /** Paths left standing that nothing uses any more, reported rather than removed. */
  orphans: string[];
  notes: string[];
  /** Edits this project customized away, repeated in the closing report as manual follow-up. */
  unresolved: string[];
};

function buildPlan(features: Feature[]): Plan {
  const docs = features.flatMap((feature) => feature.docs ?? []);
  const skills = features.flatMap((feature) => feature.skills ?? []);

  return {
    features,
    paths: [...new Set([...features.flatMap((feature) => feature.paths), ...docs])],
    edits: groupEdits([...features.flatMap((feature) => feature.edits), ...docLinkEdits(docs), ...skillEdits(skills)]),
    dependencies: [...new Set(features.flatMap((feature) => feature.dependencies ?? []))],
    env: [...new Set(features.flatMap((feature) => feature.env ?? []))],
    documentTypes: [...new Set(features.flatMap((feature) => feature.documentTypes ?? []))],
    sectionTypes: [...new Set(features.flatMap((feature) => feature.sectionTypes ?? []))],
    skills,
    orphans: [...new Set(features.flatMap((feature) => feature.orphans ?? []))],
    notes: features.flatMap((feature) => feature.notes ?? []),
    unresolved: [],
  };
}

/**
 * Resolves the plan against the tree before anything is written.
 *
 * A project that has been worked in for a few months is the normal case here, not the exception: by
 * the time someone decides they never needed the blog, they have added fields to queries and edited
 * the routes around them. The useful answer is the edits that still apply, plus a precise list of the
 * ones that need a human. A path that is already gone is a step towards the goal, not a failure.
 */
function resolvePlan(plan: Plan): Resolution & { alreadyGone: string[] } {
  const resolution = resolveEdits(plan.edits, exists, read);

  return {
    ...resolution,
    alreadyGone: [...plan.paths.filter((path) => onDisk(path, exists).length === 0), ...resolution.missingFiles],
  };
}

/**
 * Half here is either a half-finished earlier run or a piece this project kept under a new meaning,
 * and `isFeaturePresent` cannot tell those apart. The files still standing are the ones about to be
 * deleted, so the split is printed rather than guessed at.
 */
async function confirmPartlyPresent(features: Feature[]): Promise<void> {
  const partial = features
    .map((feature) => ({
      feature,
      present: feature.paths.flatMap((path) => onDisk(path, exists)),
      missing: feature.paths.filter((path) => onDisk(path, exists).length === 0),
    }))
    .filter(({ present, missing }) => present.length > 0 && missing.length > 0);

  if (partial.length === 0) {
    return;
  }

  for (const { feature, present, missing } of partial) {
    console.log(`\n⚠️  ${feature.id} is only partly here: ${present.length} of ${feature.paths.length} files it owns are left.\n`);
    console.log(`   still here, and about to be deleted:\n${present.map((path) => `      ${path}`).join("\n")}`);
    console.log(`   already absent:\n${missing.map((path) => `      ${path}`).join("\n")}`);
  }

  console.log("\n   Either an earlier run removed part of this, or the project kept a piece of it for something else.");
  console.log("   Check the first list is still the feature you mean before continuing.\n");

  if (interactive) {
    await confirmOrCancel("Continue with that understood?", { cancelDetail: "Nothing was changed." });
  }
}

/** The block that turns unresolved anchors into something a person can finish by hand. */
function printUnresolved(unresolved: Unresolved[]): void {
  console.log(
    `\n⚠️  ${unresolved.length} edit${unresolved.length === 1 ? "" : "s"} cannot be applied: this project has changed those files.\n`
  );

  const byFile = new Map<string, Unresolved[]>();

  for (const entry of unresolved) {
    byFile.set(entry.file, [...(byFile.get(entry.file) ?? []), entry]);
  }

  for (const [file, entries] of byFile) {
    console.log(`   ${file}`);

    for (const { edit, matches } of entries) {
      console.log(`      · ${describeEdit(edit)}`);
      console.log(`        ${matches === 0 ? "not found" : `found ${matches} times, expected one`}`);
    }
  }

  console.log("");
}

function printPlan(plan: Plan): void {
  console.log("\n📝 Plan\n");
  console.log("   Features");

  for (const feature of plan.features) {
    console.log(`      - ${feature.title} (${feature.id})`);
  }

  console.log(`\n   Files to delete (${plan.paths.length})`);

  for (const path of plan.paths) {
    console.log(`      - ${path}`);
  }

  const editCount = plan.edits.reduce((sum, entry) => sum + entry.edits.length, 0);
  console.log(`\n   Edits (${editCount} across ${plan.edits.length} files)`);

  for (const { file, edits } of plan.edits) {
    console.log(`      ${file}`);

    for (const edit of edits) {
      console.log(`         - ${describeEdit(edit)}`);

      // Line removal is the one transform with no structural safety net: it deletes whatever it
      // matches, and a matcher that is too broad would take a neighbouring link with it. Print the
      // lines themselves so the plan is reviewable rather than taken on trust.
      for (const line of edit.kind === "dropLines" ? matchingLines(file, edit.contains) : []) {
        console.log(`             │ ${line}`);
      }
    }
  }

  if (plan.dependencies.length > 0) {
    console.log(`\n   Dependencies to drop\n      - ${plan.dependencies.join("\n      - ")}`);
  }

  if (plan.env.length > 0) {
    console.log(`\n   Env vars to drop\n      - ${plan.env.join("\n      - ")}`);
  }

  if (plan.skills.length > 0) {
    console.log(`\n   Skills to drop\n      - ${plan.skills.join("\n      - ")}`);
  }

  const orphans = plan.orphans.filter((path) => existsSync(join(root, path)));

  if (orphans.length > 0) {
    console.log(`\n   Left in place, but nothing else uses them\n      - ${orphans.join("\n      - ")}`);
  }

  console.log("");
}

/** Applies the plan to the working tree. Every edit has already been proven to resolve. */
function applyPlan(plan: Plan): void {
  printStep("🗂️", `Deleting ${plan.paths.length} paths…`);

  for (const path of plan.paths) {
    rmSync(join(root, path), { recursive: true, force: true });
  }

  printStep("✂️", `Applying edits to ${plan.edits.length} files…`);

  for (const { file, edits, optional } of plan.edits) {
    if (optional && !existsSync(join(root, file))) {
      continue;
    }

    write(file, applyEdits(read(file), edits, file));
  }

  for (const skill of plan.skills) {
    rmSync(join(root, ".agents", "skills", skill), { recursive: true, force: true });
  }

  if (plan.skills.length > 0 && existsSync(join(root, "skills-lock.json"))) {
    const lock = JSON.parse(read("skills-lock.json")) as { skills?: Record<string, unknown> };

    for (const skill of plan.skills) {
      delete lock.skills?.[skill];
    }

    write("skills-lock.json", `${JSON.stringify(lock, null, 2)}\n`);
  }

  if (plan.dependencies.length > 0) {
    printStep("📦", `Dropping ${plan.dependencies.join(", ")} from package.json…`);

    const manifest = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    for (const name of plan.dependencies) {
      delete manifest.dependencies?.[name];
      delete manifest.devDependencies?.[name];
    }

    write("package.json", `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

/**
 * The one dataset this run reads and purges.
 *
 * Asked once, up front, so the numbers on screen and the documents that get deleted always come from
 * the same place: asking again at the purge would let someone approve a plan built from one dataset
 * and apply it to another. `--dataset <name>` answers it without a prompt, and the picker only
 * appears when a purge is actually on the table.
 */
async function resolveDataset(envDataset: string): Promise<string> {
  if (datasetOverride) {
    return datasetOverride;
  }

  if (purgeRequested && interactive) {
    return askDataset("Which dataset should this run read and purge?", { datasets: loadDatasets(), current: envDataset });
  }

  return envDataset;
}

/** The dataset name and the Sanity env, or a failure that names what is missing. */
async function requireDataset(): Promise<string> {
  try {
    return await resolveDataset(getSanityEnv(process.env).SANITY_DATASET);
  } catch (error) {
    if (datasetOverride) {
      return datasetOverride;
    }

    return fail(
      "Failed to load Sanity environment variables.",
      "Set SANITY_PROJECT_ID and SANITY_DATASET, or the app's public Sanity pair, in `.env`.",
      "Or name the dataset directly with --dataset <name>.",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * The purge on its own, against whatever project this is.
 *
 * The code removal and the content removal are two decisions, usually days apart: the edit token, or
 * the `sanity login` the pre-purge export needs, is often not in place when the code goes. Without
 * this the purge would be a one-shot, because a second full run aborts (correctly) on a manifest
 * that no longer matches the tree its own earlier run trimmed.
 *
 * This half deliberately does not consult the manifest at all. "Is this content stranded?" has an
 * exact answer that needs no knowledge of where any file lives: a `_type` with documents but no
 * entry in the extracted schema cannot be rendered, queried by the app, or opened in the Studio. So
 * it diffs `sanity-schema.json` against the types the dataset actually stores, which works in a
 * project that renamed its types or moved its schema folder, and finds orphans of types nobody ever
 * wrote a manifest entry for.
 */
async function runDatasetOnly(forcedDataset?: string): Promise<void> {
  printHeader("🗑️", "Trim features · dataset only", [
    "Finds content the schema no longer declares, and offers to delete it.",
    "Touches no files, and reads no manifest: the extracted schema is the whole source of truth.",
  ]);

  if (options.dryRun) {
    printDryRunNotice();
  }

  if (!existsSync(join(root, SCHEMA_FILE))) {
    fail(
      `${SCHEMA_FILE} is not here, so there is nothing to compare the dataset against.`,
      "Run `npm run sanity:typegen` to extract it, then try again.",
      "Without it, a stored type cannot be told apart from one the schema still declares."
    );
  }

  const dataset = forcedDataset ?? (await requireDataset());
  const schema = read(SCHEMA_FILE);
  const registered = parseRegisteredTypes(schema);

  printStep("📊", `Comparing "${dataset}" against the ${registered.length} types the schema declares…`);

  const stranded = readStranded(dataset, schema);

  if (!stranded) {
    fail(
      `Could not read "${dataset}".`,
      "The type scan and the pre-purge export both go through the Sanity CLI, so it has to be logged in.",
      "Run `npx sanity login`, then try again. Nothing was changed."
    );
  }

  const { documents, sections } = stranded;

  console.log(`\n${formatOrphanReport(dataset, documents, registered.length, sections).join("\n")}`);

  if (documents.length === 0 && sections.length === 0) {
    printDone("Nothing to purge.", `Every stored type in "${dataset}" is one the schema declares.`);
    return;
  }

  const strandedTypes = [...documents.map((entry) => entry.type), ...sections.map((entry) => entry.type)];
  const named = options.type?.length ? options.type : undefined;
  const unknown = (named ?? []).filter((type) => !strandedTypes.includes(type));

  if (unknown.length > 0) {
    fail(
      `Not stranded in "${dataset}": ${unknown.join(", ")}`,
      "Only types the schema no longer declares can be purged here, and only when content still uses them.",
      `Stranded right now: ${strandedTypes.join(", ")}`
    );
  }

  // A dry run deletes nothing, so it never needs naming. `interactive` is false whenever stdout is
  // not a tty, which piping the output is enough to cause.
  if (!named && !interactive && !options.dryRun) {
    fail(
      "--type is required with --yes (there is no interactive picker).",
      "Run with --dry-run to see what is stranded without deleting anything.",
      `Stranded right now: ${strandedTypes.join(", ")}`
    );
  }

  let selected = named ?? strandedTypes;

  if (!named && interactive && !options.dryRun) {
    selected = await askMultiSelect("Which of these should be deleted?", [
      ...documents.map((entry) => ({
        title: `${entry.type} (${entry.published + entry.drafts} ${entry.published + entry.drafts === 1 ? "document" : "documents"})`,
        value: entry.type,
        selected: true,
      })),
      ...sections.map((entry) => ({
        title: `${entry.type} (${entry.uses} section ${entry.uses === 1 ? "use" : "uses"} in pages)`,
        value: entry.type,
        selected: true,
      })),
    ]);

    if (selected.length === 0) {
      cancel("Nothing selected.");
    }
  }

  const documentTypes = documents.map((entry) => entry.type).filter((type) => selected.includes(type));
  const sectionTypes = sections.map((entry) => entry.type).filter((type) => selected.includes(type));
  const usage = readUsage(dataset, documentTypes, sectionTypes);

  if (!usage) {
    fail(`Could not read "${dataset}" for the purge plan.`, "Nothing was changed.");
  }

  console.log(formatPurgePlan(usage, documentTypes).join("\n"));

  printSummary([
    { label: "Mode", value: "dataset only (no files are touched)" },
    { label: "Dataset", value: dataset },
    { label: "Types", value: selected.join(", ") },
    { value: "A dated export is written to ./backups/ before anything is deleted." },
  ]);

  if (options.dryRun) {
    finishDryRun();
  }

  await runPurge(dataset, documentTypes, sectionTypes);

  console.log("\n🙋 Left for a human\n");
  console.log("   • Generated `agentMarkdown.content` and `siteSettings.llms.content` may still describe the deleted content;");
  console.log("     regenerate them from the Agents tab.");
  console.log("   • Any weak reference listed above is now dangling; the plan named every holder.");

  printDone("Purge complete.", `${selected.join(", ")} in ${dataset}`);
}

/** The datasets the usage table counts: the one named, or every one the CLI can list. */
function datasetsToRead(envDataset: string): string[] {
  if (!options.datasetCheck) {
    return [];
  }

  if (datasetOverride) {
    return [datasetOverride];
  }

  const listed = loadDatasets();
  const datasets = listed.length > 0 ? listed : [envDataset].filter(Boolean);

  return orderDatasets(datasets);
}

function readEnvDataset(): string {
  try {
    return getSanityEnv(process.env).SANITY_DATASET;
  } catch {
    // No Sanity env: the code trim still works, only the dataset stages are unavailable.
    return "";
  }
}

/** Why a feature asked for by id is not the trim's to remove here. */
function describeUnavailable(feature: Feature, status: FeatureStatus, record: ProjectRecord): string {
  const entry = record.features[feature.id];

  switch (status) {
    case "trimmed":
      return `${feature.id} was trimmed${entry?.on ? ` on ${entry.on}` : ""}: nothing of it is left.`;
    case "removed":
      return `${feature.id} is gone, though not by a recorded trim: nothing of it is left.`;
    case "adopted":
      return `${feature.id} is this project's now${entry?.note ? ` (${entry.note})` : ""}. Delete its entry in ${PROJECT_FILE} to make it removable again.`;
    case "never-had":
      return `${feature.id} joined the starter on ${feature.since}, after this project was cut (${record.starter.cutFrom}). Files by its names are this project's own.`;
    default:
      return `${feature.id}: nothing of it is left. \`npm run trim -- --reconcile\` records that.`;
  }
}

/** The undo is `git checkout .`, so a removal needs a clean tree. The record is the trim's own file. */
function requireCleanTree(): void {
  if (options.allowDirty || options.dryRun) {
    return;
  }

  const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8", cwd: root });

  if (status.status !== 0) {
    fail("Could not read the git status.", "Run with --allow-dirty to trim outside a git repository.");
  }

  const dirty = (status.stdout ?? "")
    .split("\n")
    .filter(Boolean)
    .filter((line) => line.slice(3) !== PROJECT_FILE);

  if (dirty.length > 0) {
    fail(
      "The working tree has uncommitted changes.",
      "Commit or stash them first, so `git checkout .` can undo this run.",
      "Or pass --allow-dirty to proceed without that safety net."
    );
  }
}

/**
 * The guided run's one question: remove features, delete content an earlier trim left behind, or
 * stop at the overview. True means go on to the removal; the other answers finish here.
 */
async function chooseRemoval(known: Survey): Promise<boolean> {
  const removable = known.rows.some((row) => isOfferable(row.status));
  const stranded = known.stranded.filter((entry) => hasStranded([entry]));

  if (!removable && stranded.length === 0) {
    printDone("Nothing left to trim.", "Every starter feature is already removed, adopted, or one this project never had.");
    return false;
  }

  const choice = await askSelect("What do you want to do?", [
    ...(removable ? [{ title: "Remove features from this project", value: "remove" }] : []),
    ...stranded.map((entry) => ({
      title: `Delete content left behind in "${entry.dataset}"`,
      description: [
        ...entry.documents.map((document) => `${document.type} ${document.published + document.drafts}`),
        ...entry.sections.map((section) => `${section.type} ${section.uses} in pages`),
      ].join(", "),
      value: `purge:${entry.dataset}`,
    })),
    { title: "Nothing: the overview is what I wanted", value: "done" },
  ]);

  if (choice.startsWith("purge:")) {
    await runDatasetOnly(choice.slice("purge:".length));
    return false;
  }

  if (choice === "done") {
    printDone("Nothing changed.");
    return false;
  }

  return true;
}

/**
 * After a clean removal, the content question. Later is the default and usually right: the live
 * site runs the old code until this deploys. The next `npm run trim` finds the content either way.
 */
async function offerContentPurge(
  features: Feature[],
  known: Survey,
  documentTypes: string[],
  sectionTypes: string[]
): Promise<void> {
  const held = known.datasets
    .map((dataset) => ({
      dataset,
      count: known.rows
        .filter((row) => features.includes(row.feature))
        .reduce((sum, row) => sum + (row.content.find((entry) => entry.dataset === dataset)?.count ?? 0), 0),
    }))
    .filter((entry) => entry.count > 0);

  if (held.length === 0) {
    return;
  }

  console.log(`\n🗄️  Its content is still in Sanity: ${held.map((entry) => `${entry.count} in ${entry.dataset}`).join(", ")}.`);
  console.log("   Delete it once this code is deployed; until then the live site may still ask for it.");
  console.log("   Later is fine: `npm run trim` finds it by itself and offers to delete it.\n");

  const now = await askMultiSelect(
    "Delete it now from which datasets? Select none to do it later.",
    held.map((entry) => ({ title: `${entry.dataset} (${entry.count})`, value: entry.dataset })),
    { hint: "space to select, enter to confirm (none = later)" }
  );

  for (const dataset of now) {
    const usage = readUsage(dataset, documentTypes, sectionTypes);

    if (!usage) {
      console.warn(`⚠️  Could not read "${dataset}"; nothing was deleted there.`);
      continue;
    }

    console.log(`\n${formatPurgePlan(usage, documentTypes).join("\n")}`);
    await runPurge(dataset, documentTypes, sectionTypes);
  }
}

async function main() {
  if (options.datasetOnly) {
    await runDatasetOnly();
    return;
  }

  if (options.status) {
    runStatus(root, datasetsToRead(readEnvDataset()));
    return;
  }

  if (options.reconcile) {
    await runReconcile(root, {
      interactive,
      dryRun: options.dryRun,
      cutFrom: options.cutFrom,
      adopt: options.adopt ?? [],
      from: options.from,
    });
    return;
  }

  printHeader("✂️", "Trim features", [
    "Shows what this project has of the starter, and removes what you pick: code first, content when ready.",
    "It only removes. Nothing is added back, and nothing is rewired.",
    "Undo is `git checkout .`, so removing needs a clean working tree.",
  ]);

  if (options.dryRun) {
    printDryRunNotice();
  }

  // A plain `npm run trim` guides the whole job; flags are for scripts and for skipping ahead.
  const guided = interactive && !options.feature?.length;
  const record = readProjectRecord(root);

  // 0. A newer trim first: everything below is only as good as the manifest it reads.
  if (guided && detectRole(record, originRepository(root)) === "project") {
    printStep("🔎", "Checking the starter for a newer trim…");

    if (isTrimBehind(root, starterSources(record, options.from))) {
      if (await askConfirm("The starter has a newer trim than this project's copy. Update it first?", true)) {
        if (run(npmBin, ["run", "trim:update", ...(options.from ? ["--", "--from", options.from] : [])]) !== 0) {
          fail("The update did not complete.", "Nothing else was changed.");
        }

        printDone(
          "Trim updated.",
          "Review and commit it, then run `npm run trim` again: this run still has the old copy loaded."
        );
        return;
      }
    }
  }

  // 1. Registries no feature owns: missing means a different repository, not a trimmed one, and
  // every "already gone" below would be a file this failed to find.
  const missingLandmarks = findMissingLandmarks((path) => existsSync(join(root, path)));

  if (missingLandmarks.length > 0) {
    fail(
      "The manifest does not describe this repository, so nothing was changed.",
      `Shared registries are missing: ${missingLandmarks.join(", ")}`,
      "No feature owns those, so they were moved or renamed rather than trimmed.",
      "Read the `--dry-run` plan as a specification and apply it by hand instead.",
      "`--dataset-only` is unaffected: it reads the extracted schema, never the manifest."
    );
  }

  const envDataset = readEnvDataset();

  // 2. What is here, what it holds and who imports it, before the question.
  const index = buildImportIndex(root);
  const datasets = datasetsToRead(envDataset);
  let known = survey(root, { datasets, index });

  console.log(`\n${formatSurvey(known).join("\n")}`);

  if (!options.datasetCheck) {
    console.log("⏭️  Skipping the dataset counts (--no-dataset-check): the choice below is uninformed about content.\n");
  } else if (known.datasets.length === 0) {
    console.warn("⚠️  Could not read any dataset (is the Sanity CLI logged in?). The choice below is uninformed about content.\n");
  }

  // 2b. What only a person can settle, recorded before anything is offered on the strength of it.
  if (guided && needsRecording(known)) {
    console.log("ℹ️  Some of this is not recorded yet: when this project was cut, or what became of a starter feature,");
    console.log("   or sections and types this project wrote. Recording it only writes scripts/trim-features/project.json.\n");

    if (await askConfirm("Record it now?", true)) {
      await runReconcile(root, { interactive: true, dryRun: false, adopt: [], from: options.from });
      known = survey(root, { datasets, index });
    }
  }

  if (guided && !(await chooseRemoval(known))) {
    return;
  }

  requireCleanTree();

  const rows = new Map(known.rows.map((row) => [row.feature.id, row]));
  const offerable = known.rows.filter((row) => isOfferable(row.status));

  // 3. Which features: only what is still here to remove.
  let ids = options.feature ?? [];

  if (ids.length === 0) {
    if (!interactive) {
      fail("--feature is required with --yes or --dry-run (there is no interactive picker).");
    }

    if (offerable.length === 0) {
      printDone("Nothing left to trim.", "Every starter feature is already removed, adopted, or one this project never had.");
      return;
    }

    ids = await askMultiSelect(
      "Which features do you want to remove?",
      offerable.map((row) => ({
        title: `${row.feature.title} (${row.feature.id})`,
        description: [row.feature.summary, describeUsage(row)].filter(Boolean).join(" · "),
        value: row.feature.id,
      }))
    );
  }

  if (ids.length === 0) {
    cancel("Nothing selected.");
  }

  const selection = resolveSelection(ids);

  if (selection.unknown.length > 0) {
    fail(`Unknown feature id: ${selection.unknown.join(", ")}`, `Known ids: ${FEATURES.map((feature) => feature.id).join(", ")}`);
  }

  const statusOf = (feature: Feature) => rows.get(feature.id)?.status ?? "present";
  const unavailable = selection.features.filter((feature) => ids.includes(feature.id) && !isOfferable(statusOf(feature)));

  if (unavailable.length > 0) {
    fail(
      "Not something this run can remove, so nothing was changed.",
      ...unavailable.map((feature) => describeUnavailable(feature, statusOf(feature), known.record))
    );
  }

  // A coupled feature that is already gone has nothing left to take with it.
  const features = selection.features.filter((feature) => isOfferable(statusOf(feature)));
  const implied = selection.implied.filter((id) => features.some((feature) => feature.id === id));

  if (implied.length > 0) {
    console.log(`\nℹ️  Also removing ${implied.join(", ")}: they cannot survive the removal you asked for.`);

    for (const id of implied) {
      const feature = features.find((entry) => entry.id === id);

      if (feature) {
        console.log(`   ${feature.id}: ${feature.summary}`);
      }
    }
  }

  await confirmPartlyPresent(features);

  // 4. Plan, proven against the tree before anything is printed as fact.
  const conflicts = findSelectionConflicts(features, listSections(root));

  if (conflicts.length > 0) {
    fail("That selection would not leave a working starter, so nothing was changed.", ...conflicts);
  }

  const plan = buildPlan(features);
  const { applicable, unresolved, alreadyGone } = resolvePlan(plan);

  if (alreadyGone.length > 0) {
    console.log(`\nℹ️  Already gone, nothing to do: ${alreadyGone.join(", ")}`);
  }

  if (unresolved.length > 0) {
    printUnresolved(unresolved);

    // Strict when nobody is watching: a scripted run should not quietly do most of the job. A person
    // gets the choice, because "thirty-nine of forty-three, and here are the four" is the useful
    // answer to a project that has been worked in.
    if (!interactive && !options.partial && !options.dryRun) {
      fail(
        "Some edits do not apply to this project, so nothing was changed.",
        "Pass --partial to apply the rest and take the list above as manual follow-up,",
        "or run without --yes to decide interactively."
      );
    }

    if (interactive && !options.partial) {
      await confirmOrCancel(
        `Apply the other ${plan.edits.reduce((n, e) => n + e.edits.length, 0) - unresolved.length} edits and leave those to you?`,
        {
          cancelDetail: "Nothing was changed.",
        }
      );
    }
  }

  // Code outside the selection that imports it: the project still uses it, and the build would say so.
  const importers = findOutsideImporters(index, features);

  if (importers.length > 0) {
    console.log(
      `\n⚠️  ${importers.length === 1 ? "1 file outside the selection imports" : `${importers.length} files outside the selection import`} what it deletes:\n`
    );

    for (const { file, target } of importers) {
      console.log(`   ${file}  →  ${target}`);
    }

    console.log("\n   The project still uses it there. Removing it means rewriting those files by hand.\n");

    if (!interactive && !options.partial && !options.dryRun) {
      fail(
        "Project code still imports this, so nothing was changed.",
        "Pass --partial to remove it anyway and fix those files by hand."
      );
    }

    if (interactive && !options.partial) {
      await confirmOrCancel("Remove it anyway and rewrite those files yourself?", { cancelDetail: "Nothing was changed." });
    }
  }

  // Everything from here on is the subset that actually resolves.
  plan.edits = applicable;
  // Concrete shapes from here on, so a flat section is deleted where the manifest names a folder.
  plan.paths = plan.paths.flatMap((path) => onDisk(path, exists));
  plan.unresolved = [
    ...unresolved.map(({ file, edit }) => `${file}: ${describeEdit(edit)}`),
    ...importers.map(({ file, target }) => `${file}: stop importing ${target}`),
  ];

  printPlan(plan);

  const purgeTypes = plan.documentTypes;
  const purgeSections = plan.sectionTypes;

  // One dataset for the purge, settled before anything is read, so the plan and the delete agree.
  const dataset = purgeRequested ? await resolveDataset(envDataset) : envDataset;
  const usage = purgeRequested && dataset ? readUsage(dataset, purgeTypes, purgeSections) : undefined;

  if (usage) {
    console.log(`${formatUsageReport(usage).join("\n")}\n${formatPurgePlan(usage, purgeTypes).join("\n")}`);
  } else if (purgeRequested) {
    console.log("⚠️  --dataset was passed but the dataset could not be read; the purge will be skipped.\n");
  }

  const summary: SummaryRow[] = [
    { label: "Features", value: features.map((feature) => feature.id).join(", ") },
    { label: "Files deleted", value: String(plan.paths.length) },
    { label: "Files edited", value: String(plan.edits.length) },
    { label: "Dependencies", value: plan.dependencies.length > 0 ? plan.dependencies.join(", ") : "none" },
    {
      label: "Dataset purge",
      value: purgeRequested && usage ? `${dataset} (${purgeTypes.join(", ") || "sections only"})` : SKIPPED,
    },
    { label: "knip sweep", value: options.knip ? "after the trim" : SKIPPED },
    ...(plan.unresolved.length > 0 ? [{ label: "Left by hand", value: `${plan.unresolved.length} edits (listed above)` }] : []),
    { value: "Undo: `git checkout .`" },
  ];

  printSummary(summary);

  if (options.dryRun) {
    finishDryRun();
  }

  if (interactive) {
    await confirmOrCancel("Remove these features? This rewrites files in the working tree.");
  }

  // A baseline before anything changes, so the sweep at the end reports what this run orphaned
  // rather than the superset knip always sees on a clean tree.
  let knipBaseline: KnipReport | undefined;

  if (options.knip) {
    printStep("🧹", "Taking a knip baseline before the trim…");
    const baseline = runKnip();
    knipBaseline = baseline.error ? undefined : baseline.report;

    if (baseline.error) {
      console.warn(`   knip did not run: ${baseline.error}`);
    }
  }

  // 5. Apply.
  applyPlan(plan);

  if (plan.dependencies.length > 0) {
    printStep("📦", "Refreshing the lockfile (npm install)…");

    if (run(npmBin, ["install"]) !== 0) {
      fail("`npm install` failed.", "The code changes are in the working tree; undo with `git checkout .`.");
    }
  }

  printStep("🧬", "Regenerating the Sanity schema and types…");

  if (run(npmBin, ["run", "sanity:typegen"]) !== 0) {
    console.warn("\n⚠️  `npm run sanity:typegen` failed. `sanity/types.ts` is now stale; rerun it once the env is available.");
  }

  writeProjectRecord(
    root,
    recordTrimmed(
      readProjectRecord(root),
      features.map((feature) => feature.id),
      today()
    )
  );

  printStep("🎨", "Formatting…");
  run(npmBin, ["run", "format"]);

  const mentions = findMentions(
    proseFiles().map((path) => ({ path, text: read(path) })),
    [...new Set(features.flatMap(mentionTerms))]
  );

  // `astro check` reads the generated route and content types from `.astro/`. Deleting a route
  // leaves those describing files that are gone, so the gate would fail on stale build output rather
  // than on anything the trim did. Clearing them is cheaper than a rebuild.
  rmSync(join(root, ".astro", "types.d.ts"), { force: true });
  rmSync(join(root, ".astro", "collections"), { recursive: true, force: true });

  // 6. Dataset purge: its own confirmation, and an export first.
  if (purgeRequested && usage) {
    await runPurge(dataset, purgeTypes, purgeSections);
  }

  // 7. knip: what the manifest did not know about.
  if (options.knip) {
    printStep("🧹", "Sweeping for what the trim left orphaned (knip)…");

    const { report: after, error } = runKnip();
    const report = knipBaseline ? diffKnipReports(knipBaseline, after) : after;

    if (error) {
      console.warn(`\n⚠️  knip did not run: ${error}`);
      console.warn("   Install it with `npm i -D knip`, or pass --no-knip.");
    } else {
      if (!knipBaseline) {
        console.warn("\n⚠️  No baseline: the list below includes files that were already unused before the trim.");
      }

      console.log(`\n${formatKnipReport(report).join("\n")}`);

      if (!isEmptyReport(report) && interactive) {
        const remove = await askConfirm("Delete these files and drop these packages too?");

        if (remove) {
          for (const file of report.files) {
            rmSync(join(root, file), { recursive: true, force: true });
          }

          const packages = [...report.dependencies, ...report.devDependencies];

          if (packages.length > 0) {
            run(npmBin, ["uninstall", ...packages]);
          }

          run(npmBin, ["run", "format"]);
        }
      }
    }
  }

  // 8. Report.
  printStep("🔍", "Running the quality gates…");

  const checkStatus = run(npmBin, ["run", "check"]);
  const testStatus = run(npmBin, ["test"]);

  console.log("");
  console.log(`   npm run check: ${checkStatus === 0 ? "✅ passed" : "❌ failed"}`);
  console.log(`   npm test:      ${testStatus === 0 ? "✅ passed" : "❌ failed"}`);

  const leftovers = [
    ...plan.unresolved.map((entry) => `Not applied, this project had changed it: ${entry}`),
    ...plan.notes,
    ...(purgeRequested
      ? []
      : [
          "The dataset still holds this feature's documents, and the sitemap selects every document with a `uri.current` regardless of type. So `/sitemap.xml` still advertises the removed URLs even though the routes are gone and they now 404. Search engines read that sitemap.",
          "Once this is deployed, run `npm run trim` again: it finds the content this left behind and offers to delete it. It compares the extracted schema against each dataset, so it needs nothing from this run.",
        ]),
    "Section thumbnails under `public/page-builder-section-thumbs/` are only removed when a section declares one.",
    "Generated `agentMarkdown.content` and `siteSettings.llms.content` still describe the old content; regenerate them from the Agents tab.",
    "A `sectionTarget` anchor written inside a rich text annotation is not reachable by GROQ, so the anchor report is a floor, not a guarantee.",
  ];

  const orphans = plan.orphans.filter((path) => existsSync(join(root, path)));

  if (mentions.length > 0) {
    console.log("\n📝 Docs and skills that still describe it (rewrite or delete these passages)\n");

    for (const line of formatMentions(mentions)) {
      console.log(`   • ${line}`);
    }
  }

  if (orphans.length > 0) {
    console.log("\n🗑️  No longer used by anything this repo ships\n");

    for (const path of orphans) {
      console.log(`   • ${path}`);
    }

    console.log("\n   Left in place: whether a shared layer goes is a judgement about what you plan to build.");
  }

  console.log("\n🙋 Left for a human\n");

  for (const note of leftovers) {
    console.log(`   • ${note}`);
  }

  if (checkStatus !== 0 || testStatus !== 0) {
    if (plan.unresolved.length > 0) {
      // Expected, not a surprise: the edits this project had customized away were left for a human,
      // so the code still references what was removed. The type errors are the checklist.
      fail(
        `The gates fail because ${plan.unresolved.length} edit${plan.unresolved.length === 1 ? " was" : "s were"} left for you.`,
        "Work through the list above; the type errors point at each one.",
        "Or undo the whole run with `git checkout .`."
      );
    }

    fail(
      "The trim completed but the quality gates did not pass.",
      "Read the output above, or undo the whole run with `git checkout .`."
    );
  }

  if (interactive && !purgeRequested) {
    await offerContentPurge(features, known, plan.documentTypes, plan.sectionTypes);
  }

  printDone("Trim complete.", `Removed: ${features.map((feature) => feature.id).join(", ")}`);
}

/** The purge stage: a second confirmation, an export, then the deletes in strong-reference order. */
async function runPurge(dataset: string, documentTypes: string[], sectionTypes: string[]): Promise<void> {
  if (documentTypes.length === 0 && sectionTypes.length === 0) {
    return;
  }

  // The dataset was settled before anything was read, so the plan just approved and the documents
  // about to go are the same ones.
  const target = dataset;

  if (interactive) {
    const confirmed = await askConfirm(
      `⚠️  DESTRUCTIVE: permanently delete every ${documentTypes.join(", ") || "matching section"} document (drafts included) from "${target}"?`
    );

    if (!confirmed) {
      console.log("\n⏭️  Dataset left untouched. The code trim above still applies.");
      return;
    }
  }

  const backupsDir = join(root, "backups");

  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  const exportPath = join(backupsDir, `${target}-pre-trim-${formatExportTimestamp(new Date())}.tar.gz`);
  printStep("💾", `Exporting "${target}" first… (${exportPath})`);

  try {
    runSanityCommand(buildExportArgs(target, exportPath), "Pre-purge export");
    console.log(`✅ Backup saved: ${exportPath}`);
  } catch (error) {
    fail(
      "Could not export the dataset, so nothing was purged.",
      error instanceof Error ? error.message : String(error),
      "The code trim above still applies."
    );
  }

  printStep("🗑️", `Purging "${target}"…`);

  try {
    const client = createEditClient({ dataset: target });
    const result = await purge(client, { documentTypes, sectionTypes });

    console.log(`✅ Deleted ${result.deletedDocuments} documents and stripped ${result.strippedSections} section instances.`);
  } catch (error) {
    fail(
      "The purge failed partway.",
      error instanceof Error ? error.message : String(error),
      `Restore with: npm run sanity:dataset-import -- --file ${exportPath} --dataset ${target}`
    );
  }
}

main().catch((error) => {
  fail("Unexpected error.", error instanceof Error ? (error.stack ?? error.message) : String(error));
});
