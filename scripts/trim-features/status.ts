/**
 * What the trim knows about this repository: each starter feature's state, its content and its users.
 * `--status` prints it, `--reconcile` turns it into `project.json`, and the picker is built from it.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { askConfirm, askMultiSelect, askSelect, askText, cancel, fail, printDone, printHeader, printStep } from "../lib/cli";
import { readStranded, readTypeTotals, type Stranded } from "./dataset";
import { describeEdit, resolveEdits, type Unresolved } from "./edits";
import { FEATURES, type Feature, onDisk, resolveSelection } from "./features";
import { buildImportIndex, type Importer, type ImportIndex } from "./importers";
import {
  detectRole,
  type FeatureRecord,
  type FeatureStatus,
  featureStatus,
  findOutsideImporters,
  findRecordConflicts,
  findUnaccountedSections,
  findUnaccountedTypes,
  isDate,
  isOfferable,
  listSections,
  originRepository,
  PROJECT_FILE,
  type ProjectRecord,
  type Role,
  readProjectRecord,
  starterSources,
  statusesOf,
  suggestCutFrom,
  today,
  writeProjectRecord,
} from "./project";
import { isSystemType, parseRegisteredTypes } from "./schema";

const SCHEMA_FILE = "sanity-schema.json";
const FEATURE_DOCS = "docs/features";
const OWN_DOC = "docs/features/trimming-features.md";

export type FeatureRow = {
  feature: Feature;
  status: FeatureStatus;
  record?: FeatureRecord;
  unresolved: Unresolved[];
  importers: Importer[];
  content: { dataset: string; count: number }[];
};

export type Survey = {
  role: Role;
  origin?: string;
  record: ProjectRecord;
  rows: FeatureRow[];
  unaccountedSections: string[];
  unaccountedTypes: string[];
  conflicts: string[];
  unmodelled: string[];
  datasets: string[];
  /** Per dataset read, what it stores that the schema no longer declares. */
  stranded: Stranded[];
};

/** Whether the record is missing something only a person can settle, which `--reconcile` asks about. */
export function needsRecording(
  result: Pick<Survey, "role" | "record" | "rows" | "unaccountedSections" | "unaccountedTypes">
): boolean {
  if (result.role === "starter") {
    return false;
  }

  return (
    !result.record.starter.cutFrom ||
    result.rows.some((row) => row.status === "absent") ||
    result.unaccountedSections.length > 0 ||
    result.unaccountedTypes.length > 0
  );
}

/** Whether any dataset read holds content the schema no longer declares. */
export function hasStranded(stranded: readonly Stranded[]): boolean {
  return stranded.some((entry) => entry.documents.length > 0 || entry.sections.length > 0);
}

function exists(root: string): (path: string) => boolean {
  return (path) => existsSync(join(root, path));
}

function registeredTypes(root: string): string[] {
  const path = join(root, SCHEMA_FILE);

  return existsSync(path) ? parseRegisteredTypes(readFileSync(path, "utf8")) : [];
}

/** Docs under `docs/features/` that no manifest entry claims: starter kit the trim does not model. */
function findUnmodelledDocs(root: string): string[] {
  const dir = join(root, FEATURE_DOCS);

  if (!existsSync(dir)) {
    return [];
  }

  const claimed = new Set([OWN_DOC, ...FEATURES.flatMap((feature) => feature.docs ?? [])]);

  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${FEATURE_DOCS}/${name}`)
    .filter((path) => !claimed.has(path));
}

/** Production leads, since that is where real use shows; the rest keep the order they were listed in. */
export function orderDatasets(datasets: readonly string[]): string[] {
  return [...datasets].sort((a, b) => Number(b.includes("prod")) - Number(a.includes("prod")));
}

/** Content per dataset for every feature, or nothing for a dataset that could not be read. */
function readContent(datasets: string[]): Map<string, Record<string, number>> {
  const documentTypes = [...new Set(FEATURES.flatMap((feature) => feature.documentTypes ?? []))];
  const sectionTypes = [...new Set(FEATURES.flatMap((feature) => feature.sectionTypes ?? []))];
  const totals = new Map<string, Record<string, number>>();

  for (const dataset of datasets) {
    const read = readTypeTotals(dataset, documentTypes, sectionTypes);

    if (read) {
      totals.set(dataset, read);
    }
  }

  return totals;
}

export function survey(root: string, options: { datasets?: string[]; index?: ImportIndex } = {}): Survey {
  const has = exists(root);
  const record = readProjectRecord(root);
  const origin = originRepository(root);
  const statuses = statusesOf(record, has);
  const index = options.index ?? buildImportIndex(root);
  const content = readContent(options.datasets ?? []);
  const read = (file: string) => readFileSync(join(root, file), "utf8");

  const rows = FEATURES.map((feature): FeatureRow => {
    const status = statuses.get(feature.id) ?? featureStatus(feature, record, has);
    const live = isOfferable(status);
    const closure = resolveSelection([feature.id]).features;

    return {
      feature,
      status,
      record: record.features[feature.id],
      unresolved: live ? resolveEdits(feature.edits, has, read).unresolved : [],
      importers: live ? findOutsideImporters(index, closure) : [],
      content: [...content].map(([dataset, totals]) => ({
        dataset,
        count: [...(feature.documentTypes ?? []), ...(feature.sectionTypes ?? [])].reduce(
          (sum, type) => sum + (totals[type] ?? 0),
          0
        ),
      })),
    };
  });

  return {
    role: detectRole(record, origin),
    origin,
    record,
    rows,
    unaccountedSections: findUnaccountedSections(listSections(root), record, statuses),
    unaccountedTypes: findUnaccountedTypes(registeredTypes(root), record, statuses, isSystemType),
    conflicts: findRecordConflicts(record, has),
    unmodelled: findUnmodelledDocs(root),
    datasets: [...content.keys()],
    stranded: existsSync(join(root, SCHEMA_FILE))
      ? [...content.keys()].flatMap((dataset) => readStranded(dataset, readFileSync(join(root, SCHEMA_FILE), "utf8")) ?? [])
      : [],
  };
}

const LABELS: Record<FeatureStatus, string> = {
  present: "✅ present  ",
  partial: "◐  partial  ",
  absent: "❔ absent   ",
  "never-had": "·  never had",
  trimmed: "✂️  trimmed  ",
  removed: "✋ removed  ",
  adopted: "🏠 adopted  ",
};

/** One line of what a feature holds and who uses it: the picker's hint, and the status detail. */
export function describeUsage(row: FeatureRow): string {
  const [one, many] = row.feature.sectionTypes?.length ? ["use", "uses"] : ["document", "documents"];
  const parts = row.feature.codeOnly
    ? ["code only"]
    : row.content.map(({ dataset, count }) => `${count} ${count === 1 ? one : many} in ${dataset}`);

  if (row.importers.length > 0) {
    parts.push(`imported by ${row.importers.length} file${row.importers.length === 1 ? "" : "s"} outside it`);
  }

  if (row.unresolved.length > 0) {
    parts.push(row.unresolved.length === 1 ? "1 edit no longer matches" : `${row.unresolved.length} edits no longer match`);
  }

  return parts.join(" · ");
}

function describeRow(row: FeatureRow, record: ProjectRecord): string {
  switch (row.status) {
    case "present":
    case "partial":
      return describeUsage(row) || "nothing outside it imports it";
    case "never-had":
      return `joined the starter ${row.feature.since}, after this project's cut (${record.starter.cutFrom})`;
    case "absent":
      return "nothing of it is left and nothing records why: `--reconcile` records it";
    case "adopted":
      return row.record?.note ? `this project's now: ${row.record.note}` : "this project's now";
    case "trimmed":
      return row.record?.on ? `by the trim on ${row.record.on}` : "by the trim";
    case "removed":
      return "gone, not by a recorded trim";
  }
}

export function formatSurvey(result: Survey): string[] {
  const { role, record, rows } = result;
  const width = Math.max(...rows.map((row) => row.feature.id.length));
  const cut =
    role === "starter"
      ? "the starter itself (its own origin, no cut date)"
      : record.starter.cutFrom
        ? `a project cut from ${record.starter.repository || "the starter"} on ${record.starter.cutFrom}`
        : "a project with no cut date: run `npm run trim -- --reconcile`";

  const lines = [`   This is ${cut}.`];

  if (result.datasets.length > 0) {
    lines.push(`   Content counted in: ${result.datasets.join(", ")}.`);
  }

  lines.push("", "   Starter features");

  for (const row of rows) {
    lines.push(`     ${LABELS[row.status]}  ${row.feature.id.padEnd(width)}  ${describeRow(row, record)}`);
  }

  const importers = rows.filter((row) => row.importers.length > 0);

  if (importers.length > 0) {
    lines.push("", "   Imported from outside the feature (a removal breaks these)");

    for (const row of importers) {
      lines.push(`     ${row.feature.id}: ${row.importers.map((entry) => entry.file).join(", ")}`);
    }
  }

  const drifted = rows.filter((row) => row.unresolved.length > 0);

  if (drifted.length > 0) {
    lines.push("", "   Edits this project has changed away (finished by hand on a trim)");

    for (const row of drifted) {
      for (const { file, edit } of row.unresolved) {
        lines.push(`     ${row.feature.id} · ${file}: ${describeEdit(edit)}`);
      }
    }
  }

  if (result.unaccountedSections.length > 0 || result.unaccountedTypes.length > 0) {
    lines.push("", "   Not accounted for (`npm test` fails on these; `--reconcile` records them as this project's)");

    for (const name of result.unaccountedSections) {
      lines.push(`     section ${name}`);
    }

    for (const type of result.unaccountedTypes) {
      lines.push(`     type    ${type}`);
    }
  }

  if (hasStranded(result.stranded)) {
    lines.push("", "   Content no schema declares any more (left by an earlier trim; `npm run trim` offers to delete it)");

    for (const { dataset, documents, sections } of result.stranded) {
      const parts = [
        ...documents.map((entry) => `${entry.type} ${entry.published + entry.drafts}`),
        ...sections.map((entry) => `${entry.type} ${entry.uses} in pages`),
      ];

      if (parts.length > 0) {
        lines.push(`     ${dataset}: ${parts.join(", ")}`);
      }
    }
  }

  if (result.conflicts.length > 0) {
    lines.push("", `   ${PROJECT_FILE} disagrees with the tree`);
    lines.push(...result.conflicts.map((conflict) => `     ${conflict}`));
  }

  if (result.unmodelled.length > 0) {
    lines.push("", "   Documented, but not something the trim can remove");
    lines.push(`     ${result.unmodelled.map((path) => path.replace(`${FEATURE_DOCS}/`, "")).join(", ")}`);
  }

  return [...lines, ""];
}

export function runStatus(root: string, datasets: string[]): void {
  printHeader("📋", "Trim status", ["What this repository has of the starter, and what it does with it. Writes nothing."]);
  console.log(formatSurvey(survey(root, { datasets })).join("\n"));
}

export type ReconcileOptions = { interactive: boolean; dryRun: boolean; cutFrom?: string; adopt: string[]; from?: string };

/**
 * Settles what the tree cannot say by itself: when this project was cut, which starter features it
 * took over, and which sections and types are its own. Everything absent is recorded as removed.
 */
export async function runReconcile(root: string, options: ReconcileOptions): Promise<void> {
  printHeader("🧾", "Trim reconcile", [`Records what this project did with the starter, in ${PROJECT_FILE}.`]);

  const before = survey(root);
  const record: ProjectRecord = structuredClone(before.record);
  const changes: string[] = [];
  // Read off the tree rather than recorded, so saying it again changes nothing.
  const observations: string[] = [];

  if (before.role === "starter" && !options.cutFrom) {
    if (!options.interactive) {
      fail(
        "This is the starter's own repository (its origin), so there is nothing to reconcile.",
        "If it is a project cut from the starter, pass --cut-from <YYYY-MM-DD>."
      );
    }

    const isProject = await askConfirm("This looks like the starter itself. Is it a project cut from the starter?", false);

    if (!isProject) {
      cancel("Nothing was recorded.");
    }
  }

  if (!record.starter.cutFrom || options.cutFrom) {
    const suggestion = options.cutFrom ? undefined : suggestCutFrom(root, record, starterSources(record, options.from));
    const suggested = options.cutFrom ?? suggestion?.date ?? today();

    if (suggestion) {
      printStep("📅", `Suggested cut: ${suggestion.date}, from ${suggestion.basis}.`);
    }

    // A script must not record a guess: a wrong cut decides which starter features count as present.
    if (!options.interactive && !options.cutFrom && !suggestion?.reliable) {
      fail(
        "No reliable cut date, so nothing was recorded.",
        "This clone shares the starter's history, and the starter could not be fetched to find the fork point.",
        "Pass --from <a reachable clone of the starter>, or --cut-from <YYYY-MM-DD>."
      );
    }

    const cutFrom =
      options.interactive && !options.cutFrom
        ? await askText("When was this project cut from the starter? (YYYY-MM-DD)", {
            initial: suggested,
            required: true,
            validate: (value) => (isDate(value) ? null : "Expected YYYY-MM-DD"),
          })
        : suggested;

    if (!isDate(cutFrom)) {
      fail(`"${cutFrom}" is not a YYYY-MM-DD date.`);
    }

    record.starter.cutFrom = cutFrom;
    changes.push(`cut from the starter on ${cutFrom}`);
  }

  for (const id of options.adopt) {
    if (!FEATURES.some((feature) => feature.id === id)) {
      fail(`Unknown feature id: ${id}`, `Known ids: ${FEATURES.map((feature) => feature.id).join(", ")}`);
    }

    record.features[id] = { state: "adopted" };
    changes.push(`${id}: adopted`);
  }

  const has = exists(root);
  const read = (file: string) => readFileSync(join(root, file), "utf8");

  for (const feature of FEATURES) {
    const status = featureStatus(feature, record, has);

    if (status === "absent") {
      record.features[feature.id] = { state: "removed" };
      changes.push(`${feature.id}: removed (none of its files are here)`);
      continue;
    }

    const left = feature.paths.flatMap((path) => onDisk(path, has));

    if (status === "never-had" && left.length > 0) {
      observations.push(`${feature.id} joined the starter after the cut, so ${left.join(", ")} is this project's own`);
      continue;
    }

    const drift = isOfferable(status) ? resolveEdits(feature.edits, has, read).unresolved.length : 0;

    if (!options.interactive || (status === "present" && drift === 0)) {
      continue;
    }

    const why = status === "partial" ? "only part of it is here" : `${drift} of its edits no longer match`;
    const choice = await askSelect(`${feature.title} (${feature.id}): ${why}. What is it now?`, [
      { title: "Still the starter's: keep it removable", value: "keep" as const },
      { title: "This project's now: it took it over and changed it (adopted)", value: "adopted" as const },
    ]);

    if (choice === "adopted") {
      const note = await askText("What did it become? (optional)", { required: false });

      record.features[feature.id] = note ? { state: "adopted", note } : { state: "adopted" };
      changes.push(`${feature.id}: adopted${note ? ` (${note})` : ""}`);
    }
  }

  const statuses = statusesOf(record, has);
  let sections = findUnaccountedSections(listSections(root), record, statuses);
  let types = findUnaccountedTypes(registeredTypes(root), record, statuses, isSystemType);

  // In a project, anything the starter's manifest does not declare was written here.
  if (options.interactive && sections.length > 0) {
    sections = await askMultiSelect(
      "Which sections did this project write itself?",
      sections.map((name) => ({ title: name, value: name, selected: true }))
    );
  }

  if (options.interactive && types.length > 0) {
    types = await askMultiSelect(
      "Which document types did this project add itself?",
      types.map((type) => ({ title: type, value: type, selected: true }))
    );
  }

  record.sections = [...record.sections, ...sections];
  record.documentTypes = [...record.documentTypes, ...types];
  changes.push(...sections.map((name) => `section ${name}: this project's own`));
  changes.push(...types.map((type) => `type ${type}: this project's own`));

  if (observations.length > 0) {
    console.log(observations.map((observation) => `\nℹ️  ${observation}`).join(""));
  }

  if (changes.length === 0) {
    printDone("Nothing to record.", `${PROJECT_FILE} already describes this tree.`);
    return;
  }

  printStep("🧾", `${options.dryRun ? "Would record" : "Recording"}:`);
  console.log(changes.map((change) => `   • ${change}`).join("\n"));

  if (options.dryRun) {
    console.log("");
    return;
  }

  if (options.interactive && !(await askConfirm(`Write these to ${PROJECT_FILE}?`, true))) {
    cancel("Nothing was recorded.");
  }

  writeProjectRecord(root, record);
  console.log("");
  console.log(formatSurvey(survey(root)).join("\n"));
  printDone("Recorded.", `Commit ${PROJECT_FILE} with the rest of the project.`);
}
