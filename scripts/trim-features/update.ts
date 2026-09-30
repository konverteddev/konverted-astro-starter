#!/usr/bin/env node

/**
 * Brings this project's copy of the trim up to the starter's, and never touches `project.json`.
 * Usage: npm run trim:update [-- --from <repository url or path>] [--ref <branch or tag>]
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { fail, printDone, printHeader, printStep } from "../lib/cli";
import {
  emptyRecord,
  fetchStarter,
  PROJECT_FILE,
  parseProjectRecord,
  readProjectRecord,
  starterSources,
  UPSTREAM_PATHS,
  writeProjectRecord,
} from "./project";

const SCRIPTS = ["trim", "trim:verify", "trim:update"];

const root = process.cwd();

const program = new Command()
  .name("trim:update")
  .description("Replace this project's copy of the trim with the starter's, keeping project.json")
  .option("--from <source>", "The starter repository: a git URL or a local path (defaults to the one project.json names)")
  .option("--ref <ref>", "Branch or tag to take it from", "main")
  .option("--allow-dirty", "Run against an uncommitted working tree", false)
  .parse();

const options = program.opts<{ from?: string; ref: string; allowDirty: boolean }>();

function git(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });

  return { ok: result.status === 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function lines(output: string): string[] {
  return output.split("\n").filter(Boolean);
}

function main(): void {
  printHeader("⬇️", "Trim update", [
    "Replaces the trim's files with the starter's. What your project.json records is kept as it is.",
    "It starts from a clean working tree, so the diff it leaves is exactly the update.",
  ]);

  if (!options.allowDirty && git(["status", "--porcelain"]).stdout.trim()) {
    fail("The working tree has uncommitted changes.", "Commit or stash them first, so the diff this leaves is only the update.");
  }

  const sources = starterSources(readProjectRecord(root), options.from);

  if (sources.length === 0) {
    fail(`${PROJECT_FILE} names no starter repository.`, "Pass --from <git URL or path to a clone of the starter>.");
  }

  printStep("📡", `Fetching ${options.ref} from ${sources.join(" or ")}…`);

  const fetched = fetchStarter(root, sources, options.ref);

  if (!fetched.ok) {
    fail("Could not fetch the starter.", fetched.error ?? "", "Pass --from <git URL or local clone> if it lives elsewhere.");
  }

  const upstream = new Set(lines(git(["ls-tree", "-r", "--name-only", "FETCH_HEAD", "--", ...UPSTREAM_PATHS]).stdout));

  if (upstream.size === 0) {
    fail(`FETCH_HEAD has none of ${UPSTREAM_PATHS.join(", ")}.`, "Is that the starter, at a ref that has the trim?");
  }

  // A ref from before the record would delete the code that reads it, this updater included.
  if (!upstream.has("scripts/trim-features/project.ts")) {
    fail(
      `That ref of the starter predates ${PROJECT_FILE}, so taking it would downgrade this project's trim.`,
      "Pick a ref that has scripts/trim-features/project.ts. Nothing was changed."
    );
  }

  const local = lines(git(["ls-files", "--", ...UPSTREAM_PATHS]).stdout);
  const dropped = local.filter((file) => !upstream.has(file) && file !== PROJECT_FILE);

  for (const file of dropped) {
    rmSync(join(root, file), { force: true });
  }

  const shipped = UPSTREAM_PATHS.filter((path) => [...upstream].some((file) => file === path || file.startsWith(`${path}/`)));
  // The worktree only, never the index, so `git checkout .` still undoes it.
  const checkout = git(["restore", "--source=FETCH_HEAD", "--worktree", "--", ...shipped, `:(exclude)${PROJECT_FILE}`]);

  if (!checkout.ok) {
    fail("Could not check the starter's files out.", checkout.stderr.trim());
  }

  // The starter's identity is the starter's to state; what the project decided is never touched.
  const theirs = git(["show", `FETCH_HEAD:${PROJECT_FILE}`]);
  const identity = theirs.ok ? parseProjectRecord(theirs.stdout).starter : undefined;
  const record = existsSync(join(root, PROJECT_FILE)) ? readProjectRecord(root) : emptyRecord();
  const starter = {
    ...record.starter,
    repository: record.starter.repository || identity?.repository || "",
    root: record.starter.root ?? identity?.root,
  };

  if (!existsSync(join(root, PROJECT_FILE)) || JSON.stringify(starter) !== JSON.stringify(record.starter)) {
    writeProjectRecord(root, { ...record, starter });
  }

  const added = addMissingScripts();

  printStep("🧾", "Changed files");
  spawnSync("git", ["status", "--short", "--", ...UPSTREAM_PATHS, "package.json"], { cwd: root, stdio: "inherit" });

  if (added.length > 0) {
    console.log(`\n   Added to package.json: ${added.join(", ")}`);
  }

  if (!readFileSync(join(root, "plopfile.mjs"), "utf8").includes("trim-features/own.ts")) {
    console.log("\n   plopfile.mjs does not record new sections for the trim yet: copy the `own.ts` actions from the starter.");
  }

  console.log(`\n   Undo: git checkout . && git clean -fd -- ${UPSTREAM_PATHS.join(" ")}`);
  printDone("Trim updated.", "Next: `npm run trim -- --reconcile`, then `npm test`. Review the diff first.");
}

/** Copies the starter's trim scripts into `package.json` when this project has none by that name. */
function addMissingScripts(): string[] {
  const theirs = git(["show", "FETCH_HEAD:package.json"]);

  if (!theirs.ok) {
    return [];
  }

  const upstream = (JSON.parse(theirs.stdout) as { scripts?: Record<string, string> }).scripts ?? {};
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const scripts = manifest.scripts ?? {};
  const added = SCRIPTS.filter((name) => upstream[name] && !scripts[name]);

  for (const name of added) {
    scripts[name] = upstream[name] ?? "";
  }

  if (added.length > 0) {
    manifest.scripts = scripts;
    writeFileSync(join(root, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  return added;
}

main();
