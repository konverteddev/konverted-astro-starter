#!/usr/bin/env node
/**
 * Interactive Sanity project bootstrap: create or link a project, tokens, CORS, `.env`, and the bundled seed content.
 *
 * Prerequisites: `npm run sanity:cli -- login`. See `scripts/sanity-project-setup/README.md`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import ora from "ora";
import {
  askConfirm,
  askSelect,
  askText,
  confirmOrCancel,
  fail,
  finishDryRun,
  printDryRunNotice,
  printHeader,
  printStep,
  printSummary,
  SKIPPED,
  type SummaryRow,
} from "../lib/cli";
import { detectRole, originRepository, readProjectRecord, today, writeProjectRecord } from "../trim-features/project";
import {
  ensureEnvFromExample,
  parseJsonFromCliOutput,
  parseTokenSecret,
  readLocalSiteOrigin,
  readPublicEnvPrefix,
  runSanityCli,
  runSanityCliStreaming,
  upsertEnvFile,
} from "./lib";

const DEFAULT_DATASET = "production";
const DEFAULT_STUDIO_PATH = "/studio";
/** Only the fallback: the real default is the dev origin `.env.example` points at. CORS origin only. */
const FALLBACK_LOCAL_SITE_ORIGIN = "http://localhost:4321";
const DEFAULT_DATASET_VISIBILITY_INDEX = 0;
const DEFAULT_CREATE_TOKENS = true;
const DEFAULT_ADD_CORS = true;
/** Bundled starter content. Relative on purpose: it is also the path printed in the retry command. */
const SEED_ARCHIVE_PATH = "seed/seed-dataset.tar.gz";
/** First choice of the content question, so Enter seeds the dataset. */
const DEFAULT_SEED_CHOICE_INDEX = 0;

const program = new Command();

program
  .name("project-setup")
  .description("Bootstrap a Sanity project: tokens, CORS, .env, and the seed content")
  .option("--dry-run", "Walk through the questions, print the summary, then exit without writing", false)
  .version("1.2.0");

program.parse();

const options = program.opts<{ dryRun: boolean }>();
const isDryRun = options.dryRun;

function parseProjectId(obj: Record<string, unknown>): string {
  const fromProject = obj.projectId;
  const fromId = obj.id;
  let id = "";

  if (typeof fromProject === "string" && fromProject) {
    id = fromProject;
  } else if (typeof fromId === "string" && fromId) {
    id = fromId;
  }

  if (!id) {
    throw new Error(`Unexpected project JSON (missing projectId): ${JSON.stringify(obj)}`);
  }

  return id;
}

async function main() {
  // Both host facts come from `.env.example`, which is what lets this script run unchanged in any host.
  const examplePath = join(process.cwd(), ".env.example");
  const exampleContents = existsSync(examplePath) ? readFileSync(examplePath, "utf8") : "";
  const publicPrefix = readPublicEnvPrefix(exampleContents);
  const localSiteOrigin = readLocalSiteOrigin(exampleContents, FALLBACK_LOCAL_SITE_ORIGIN);

  printHeader("🛠️", "Sanity project setup", [
    "Tokens, CORS, `.env`, and the seed content, step by step.",
    "",
    `Quick defaults (Enter):  dataset ${DEFAULT_DATASET} · public · tokens · CORS ${localSiteOrigin} · seed content.`,
  ]);

  if (isDryRun) {
    printDryRunNotice();
  }

  const projectMode = await askSelect(
    "How do you want to start?",
    [
      { title: "Create a new Sanity project", value: "new" as const },
      { title: "Use an existing project ID", value: "existing" as const },
    ],
    { initial: 0 }
  );

  let organization = "";
  let projectName = "";
  let dataset = DEFAULT_DATASET;
  let datasetVisibility: "public" | "private" = "public";
  let projectId = "";

  if (projectMode === "new") {
    organization = await askText("Organization id or slug (from sanity.io/manage)", { required: true });
    projectName = await askText("Project display name", { required: true });
    dataset = (await askText("Initial dataset name", { initial: DEFAULT_DATASET })) || DEFAULT_DATASET;
    datasetVisibility = await askSelect(
      "Dataset visibility",
      [
        { title: "Public (Content API)", value: "public" as const },
        { title: "Private", value: "private" as const },
      ],
      { initial: DEFAULT_DATASET_VISIBILITY_INDEX }
    );
  } else {
    projectId = await askText("Existing project ID", { required: true });
    dataset = (await askText(`Dataset name for ${publicPrefix}SANITY_DATASET`, { initial: DEFAULT_DATASET })) || DEFAULT_DATASET;
  }

  const createTokens = await askConfirm("Create API tokens (Frontend - View + Frontend - Edit)?", DEFAULT_CREATE_TOKENS);
  const addCors = await askConfirm("Add CORS origins with credentials (Studio + browser token)?", DEFAULT_ADD_CORS);

  let corsOrigins: string[] = [localSiteOrigin];

  if (addCors) {
    const origins = await askText("Comma-separated origins (browser + Studio)", { initial: localSiteOrigin });

    corsOrigins = origins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (corsOrigins.length === 0) {
      corsOrigins = [localSiteOrigin];
    }
  }

  const seedAvailable = existsSync(join(process.cwd(), SEED_ARCHIVE_PATH));
  let importSeed = false;

  if (seedAvailable) {
    importSeed = await askSelect(
      "How should the dataset start?",
      [
        {
          title: "With the bundled example content",
          value: true,
          description: `Imports ${SEED_ARCHIVE_PATH}: example pages, the site singletons, the blog, and their assets`,
        },
        { title: "Completely empty", value: false, description: "Nothing is imported; the Studio starts blank" },
      ],
      { initial: DEFAULT_SEED_CHOICE_INDEX }
    );
  }

  const envPath =
    (await askText("Path to .env to update", { initial: join(process.cwd(), ".env") })) || join(process.cwd(), ".env");

  // The day a project is cut is what lets `npm run trim` tell the starter's features from its own later.
  const trimRecord = readProjectRecord(process.cwd());
  const isUncutClone = !trimRecord.starter.cutFrom && Boolean(trimRecord.starter.repository);
  const stampCut =
    isUncutClone &&
    (detectRole(trimRecord, originRepository(process.cwd())) === "project" ||
      (await askConfirm("Is this a new site cut from the starter, rather than work on the starter itself?", true)));

  const summary: SummaryRow[] = [];

  if (projectMode === "new") {
    summary.push({ value: `New project “${projectName}” in org ${organization}` });
    summary.push({ label: "Dataset", value: `${dataset} (${datasetVisibility})` });
  } else {
    summary.push({ label: "Project ID", value: projectId });
    summary.push({ label: "Dataset", value: dataset });
  }

  summary.push({ label: "API tokens", value: createTokens ? "✅ viewer + editor" : SKIPPED });
  summary.push({ label: "CORS", value: addCors ? corsOrigins.join(", ") : SKIPPED });

  let seedSummary = "Empty dataset";

  if (importSeed) {
    seedSummary = `✅ ${SEED_ARCHIVE_PATH} → ${dataset} (replaces documents with the same IDs)`;
  } else if (!seedAvailable) {
    seedSummary = `Empty dataset (no ${SEED_ARCHIVE_PATH} in this checkout)`;
  }

  summary.push({ label: "Content", value: seedSummary });
  summary.push({ label: "Env file", value: envPath });

  if (stampCut) {
    summary.push({ label: "Starter cut", value: `${today()} (recorded for npm run trim)` });
  }

  printSummary(summary);

  if (isDryRun) {
    finishDryRun();
  }

  await confirmOrCancel("Run these steps now?", { initial: true });

  if (projectMode === "new") {
    const spinner = ora("Creating Sanity project…").start();
    const created = runSanityCli([
      "projects",
      "create",
      projectName,
      "--organization",
      organization,
      "--dataset",
      dataset,
      "--dataset-visibility",
      datasetVisibility,
      "--yes",
      "--json",
    ]);

    if (!created.ok) {
      spinner.fail("Project creation failed");
      console.error(created.stderr || created.stdout);
      process.exit(created.status ?? 1);
    }

    try {
      projectId = parseProjectId(parseJsonFromCliOutput(created.stdout));
    } catch (e) {
      spinner.fail("Could not parse project response");
      console.error(e);
      process.exit(1);
    }

    spinner.succeed(`Project created, id ${projectId}`);
  } else {
    console.log(`\n✅ Using project ${projectId}\n`);
  }

  let viewToken = "";
  let editToken = "";

  if (createTokens) {
    let s = ora("Creating viewer token…").start();
    const view = runSanityCli(["tokens", "add", "Frontend - View", "--role=viewer", "--yes", "--json", "-p", projectId]);

    if (!view.ok) {
      s.fail("Viewer token failed");
      console.error(view.stderr || view.stdout);
      process.exit(view.status ?? 1);
    }

    try {
      viewToken = parseTokenSecret(parseJsonFromCliOutput(view.stdout));
    } catch (e) {
      s.fail("Invalid token response");
      console.error(e);
      process.exit(1);
    }

    s.succeed("Viewer token created");

    s = ora("Creating editor token…").start();
    const edit = runSanityCli(["tokens", "add", "Frontend - Edit", "--role=editor", "--yes", "--json", "-p", projectId]);

    if (!edit.ok) {
      s.fail("Editor token failed");
      console.error(edit.stderr || edit.stdout);
      process.exit(edit.status ?? 1);
    }

    try {
      editToken = parseTokenSecret(parseJsonFromCliOutput(edit.stdout));
    } catch (e) {
      s.fail("Invalid token response");
      console.error(e);
      process.exit(1);
    }

    s.succeed("Editor token created");

    console.log("");
  } else {
    console.log("⏭️  Skipping token creation. Ensure SANITY_API_* are in .env if you need them.\n");
  }

  if (addCors) {
    for (const origin of corsOrigins) {
      const s = ora(`CORS: ${origin}`).start();
      const cors = runSanityCli(["cors", "add", origin, "--credentials", "-p", projectId]);

      if (!cors.ok) {
        const msg = `${cors.stderr}${cors.stdout}`;

        if (/exist|already|duplicate/i.test(msg)) {
          s.warn(`Already present or similar: ${origin}`);
        } else {
          s.fail("CORS failed");
          console.error(msg);
          process.exit(cors.status ?? 1);
        }
      } else {
        s.succeed(`CORS added: ${origin}`);
      }
    }
    console.log("");
  }

  const apiVersion = process.env[`${publicPrefix}SANITY_API_VERSION`] ?? "2025-02-19";

  const updates: Record<string, string> = {
    [`${publicPrefix}SANITY_PROJECT_ID`]: projectId,
    [`${publicPrefix}SANITY_DATASET`]: dataset,
    [`${publicPrefix}SANITY_API_VERSION`]: apiVersion,
    [`${publicPrefix}SANITY_STUDIO_BASE_PATH`]: DEFAULT_STUDIO_PATH,
  };

  if (createTokens) {
    updates.SANITY_API_VIEW_TOKEN = viewToken;
    updates.SANITY_API_EDIT_TOKEN = editToken;
  }

  if (ensureEnvFromExample(envPath, examplePath)) {
    console.log(`📄 Created ${envPath} from .env.example\n`);
  } else if (!existsSync(envPath)) {
    console.log(`📄 Creating ${envPath}\n`);
  }

  upsertEnvFile(envPath, updates);
  console.log(`✅ Updated ${envPath}\n`);

  if (stampCut) {
    writeProjectRecord(process.cwd(), { ...trimRecord, starter: { ...trimRecord.starter, cutFrom: today() } });
    console.log(`✅ Recorded the starter cut (${today()}) for \`npm run trim\`\n`);
  }

  if (importSeed) {
    printStep("📥", `Importing the seed content into "${dataset}"…`);

    // The flags override a CLI config still holding the pre-run env; the env pair keeps `sanity.cli.ts` resolvable with no `.env`.
    const seed = runSanityCliStreaming(
      ["dataset", "import", SEED_ARCHIVE_PATH, "--dataset", dataset, "--replace", "-p", projectId],
      { [`${publicPrefix}SANITY_PROJECT_ID`]: projectId, [`${publicPrefix}SANITY_DATASET`]: dataset }
    );

    if (!seed.ok) {
      fail(
        `Seed import failed${seed.error ? `: ${seed.error}` : "."}`,
        "Everything above it is already done, so do not re-run the whole wizard.",
        `Retry the import with: npm run sanity:dataset-import -- --file ${SEED_ARCHIVE_PATH} --dataset ${dataset} --replace`
      );
    }

    console.log(`\n✅ Seeded "${dataset}" from ${SEED_ARCHIVE_PATH}\n`);
  }

  console.log("🎉 Done.\n");
  console.log("   Next: `npm run sanity:typegen`\n");

  if (seedAvailable && !importSeed) {
    console.log(`   Changed your mind? npm run sanity:dataset-import -- --file ${SEED_ARCHIVE_PATH}\n`);
  }
}

main().catch((err) => {
  fail("Unexpected error.", err instanceof Error ? (err.stack ?? err.message) : String(err));
});
