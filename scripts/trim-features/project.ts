/**
 * This repository's side of the trim: which starter it was cut from, and what became of each feature.
 * `features.ts` belongs to the starter and is replaced on update; `project.json` belongs to the project.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORE_DOCUMENT_TYPES, FEATURES, type Feature, onDisk, SECTION_FILE, SECTIONS_DIR, sectionNamesOf } from "./features";
import { findImporters, type Importer, type ImportIndex } from "./importers";

export const PROJECT_FILE = "scripts/trim-features/project.json";

/** What a project decided about a feature. Everything else is read off the tree. */
export type RecordedState = "trimmed" | "removed" | "adopted";

export type FeatureRecord = { state: RecordedState; on?: string; note?: string };

export type ProjectRecord = {
  /** `root` is the starter's first commit: a clone that shares it shares the starter's history. */
  starter: { repository: string; root?: string; cutFrom: string | null };
  features: Record<string, FeatureRecord>;
  /** Sections and document types this project wrote itself, so the coverage checks leave them be. */
  sections: string[];
  documentTypes: string[];
};

export type Role = "starter" | "project";

export type FeatureStatus = "present" | "partial" | "absent" | "never-had" | RecordedState;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LINE_WIDTH = 130;
const STATES: readonly RecordedState[] = ["trimmed", "removed", "adopted"];

export function emptyRecord(repository = ""): ProjectRecord {
  return { starter: { repository, cutFrom: null }, features: {}, sections: [], documentTypes: [] };
}

export function isDate(value: string): boolean {
  return DATE.test(value) && !Number.isNaN(Date.parse(value));
}

export function parseProjectRecord(json: string): ProjectRecord {
  let raw: Partial<ProjectRecord>;

  try {
    raw = JSON.parse(json) as Partial<ProjectRecord>;
  } catch {
    throw new Error(`${PROJECT_FILE} is not valid JSON.`);
  }

  const cutFrom = raw.starter?.cutFrom ?? null;

  if (cutFrom !== null && !isDate(cutFrom)) {
    throw new Error(`${PROJECT_FILE}: starter.cutFrom must be a YYYY-MM-DD date or null, not "${cutFrom}".`);
  }

  for (const [id, entry] of Object.entries(raw.features ?? {})) {
    if (!STATES.includes(entry.state)) {
      throw new Error(`${PROJECT_FILE}: ${id} has state "${entry.state}", expected one of ${STATES.join(", ")}.`);
    }
  }

  return {
    starter: { repository: raw.starter?.repository ?? "", root: raw.starter?.root, cutFrom },
    features: raw.features ?? {},
    sections: raw.sections ?? [],
    documentTypes: raw.documentTypes ?? [],
  };
}

export function serializeProjectRecord(record: ProjectRecord): string {
  const features = Object.fromEntries(Object.entries(record.features).sort(([a], [b]) => a.localeCompare(b)));
  const sorted = {
    ...record,
    features,
    sections: [...new Set(record.sections)].sort(),
    documentTypes: [...new Set(record.documentTypes)].sort(),
  };

  return `${inlineShortArrays(JSON.stringify(sorted, null, 2))}\n`;
}

/** Biome's JSON layout: an array that fits in the line width sits on one line, so a format run is a no-op. */
function inlineShortArrays(json: string): string {
  const lines = json.split("\n");
  const out: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const close = lines.findIndex((candidate, at) => at > index && candidate.trim().startsWith("]"));

    if (!line.endsWith("[") || close === -1) {
      out.push(line);
      continue;
    }

    const items = lines.slice(index + 1, close).map((item) => item.trim().replace(/,$/, ""));
    const inline = `${line}${items.join(", ")}${(lines[close] ?? "").trim()}`;

    if (inline.length <= LINE_WIDTH) {
      out.push(inline);
      index = close;
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}

export function readProjectRecord(root: string): ProjectRecord {
  const path = join(root, PROJECT_FILE);

  return existsSync(path) ? parseProjectRecord(readFileSync(path, "utf8")) : emptyRecord();
}

export function writeProjectRecord(root: string, record: ProjectRecord): void {
  writeFileSync(join(root, PROJECT_FILE), serializeProjectRecord(record), "utf8");
}

/** `git@github.com:Owner/Repo.git` and `https://github.com/owner/repo` are the same repository. */
export function normalizeRepository(url: string): string {
  return url
    .trim()
    .replace(/\.git$/, "")
    .replace(/^.*github\.com[:/]/, "")
    .toLowerCase();
}

function git(root: string, args: string[]): string | undefined {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });

  return result.status === 0 ? result.stdout.trim() : undefined;
}

export function originRepository(root: string): string | undefined {
  const url = git(root, ["remote", "get-url", "origin"]);

  return url ? normalizeRepository(url) : undefined;
}

/**
 * The starter is the repository `project.json` names, still cloned from its own origin. A stamped
 * cut date always means a project, and so does any other origin, or none.
 */
export function detectRole(record: ProjectRecord, origin: string | undefined): Role {
  if (record.starter.cutFrom) {
    return "project";
  }

  const starter = normalizeRepository(record.starter.repository);

  return starter && origin === starter ? "starter" : "project";
}

/** The date of the first commit: the cut, for a repository made from the starter as a template. */
export function rootCommitDate(root: string): string | undefined {
  const dates = git(root, ["log", "--max-parents=0", "--format=%cs"])?.split("\n") ?? [];

  return dates.filter(isDate).sort()[0];
}

/** Where to fetch the starter from: what was asked for, or the repository the record names, https then ssh. */
export function starterSources(record: ProjectRecord, from?: string): string[] {
  if (from) {
    return [from];
  }

  const repository = record.starter.repository;

  return repository ? [`https://github.com/${repository}.git`, `git@github.com:${repository}.git`] : [];
}

/**
 * Fetches the starter into `FETCH_HEAD`, trying each source in turn. Never prompts: a private
 * repository without credentials fails fast rather than hanging a script on a password.
 */
export function fetchStarter(
  root: string,
  sources: readonly string[],
  ref = "HEAD"
): { ok: boolean; source?: string; error?: string } {
  let error = "";

  for (const source of sources) {
    const result = spawnSync("git", ["fetch", "--quiet", "--no-tags", source, ref], {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -o BatchMode=yes" },
    });

    if (result.status === 0) {
      return { ok: true, source };
    }

    error = (result.stderr ?? "").trim() || `git fetch ${source} failed`;
  }

  return { ok: false, error };
}

/** `reliable` is false for a guess that may be later than the real cut, which is the safe direction. */
/** What the starter owns outright. Anything a project decides lives in `project.json` instead. */
export const UPSTREAM_PATHS = ["scripts/trim-features", ".agents/skills/trim-features", "docs/features/trimming-features.md"];

/**
 * Whether the starter ships a newer trim than this copy, `project.json` aside. False when the
 * starter cannot be reached, and for a starter ref that predates the record `trim:update` needs.
 */
export function isTrimBehind(root: string, sources: readonly string[]): boolean {
  if (sources.length === 0 || !fetchStarter(root, sources).ok) {
    return false;
  }

  // `git` answers undefined on a non-zero exit, which is what `cat-file -e` gives for a missing path.
  if (git(root, ["cat-file", "-e", "FETCH_HEAD:scripts/trim-features/project.ts"]) === undefined) {
    return false;
  }

  const diff = spawnSync("git", ["diff", "--quiet", "FETCH_HEAD", "--", ...UPSTREAM_PATHS, `:(exclude)${PROJECT_FILE}`], {
    cwd: root,
  });

  return diff.status === 1;
}

export type CutSuggestion = { date: string; basis: string; reliable: boolean };

/**
 * The best guess at the cut. A `git clone` shares history with the starter, and there the fork point
 * is exact, while its first commit is the starter's own. A template copy shares none, and there the
 * first commit is the cut.
 */
export function suggestCutFrom(root: string, record: ProjectRecord, sources: readonly string[]): CutSuggestion | undefined {
  if (sources.length > 0 && fetchStarter(root, sources).ok) {
    const base = git(root, ["merge-base", "HEAD", "FETCH_HEAD"]);
    const date = base ? git(root, ["log", "-1", "--format=%cs", base]) : undefined;

    if (date && isDate(date)) {
      return { date, basis: "the fork point with the starter", reliable: true };
    }
  }

  const roots = git(root, ["rev-list", "--max-parents=0", "HEAD"])?.split("\n") ?? [];

  // Too early would hide real starter features as "never had"; too late only misses a name clash.
  if (record.starter.root && roots.includes(record.starter.root)) {
    const late = git(root, ["log", "-1", "--format=%cs", "--", "scripts/trim-features/features.ts"]);

    return late && isDate(late)
      ? {
          date: late,
          basis: "the last change to the manifest (the starter could not be fetched for the fork point)",
          reliable: false,
        }
      : undefined;
  }

  const first = rootCommitDate(root);

  return first ? { date: first, basis: "the first commit (no history shared with the starter)", reliable: true } : undefined;
}

export function featureStatus(feature: Feature, record: ProjectRecord, exists: (path: string) => boolean): FeatureStatus {
  const recorded = record.features[feature.id];

  if (recorded) {
    return recorded.state;
  }

  if (record.starter.cutFrom && feature.since > record.starter.cutFrom) {
    return "never-had";
  }

  const left = feature.paths.filter((path) => onDisk(path, exists).length > 0).length;

  if (left === feature.paths.length) {
    return "present";
  }

  return left > 0 ? "partial" : "absent";
}

/** A feature the trim can still remove: something of it is here and nobody has claimed it. */
export function isOfferable(status: FeatureStatus): boolean {
  return status === "present" || status === "partial";
}

/** Everything but `never-had` was the starter's here at some point, so its names are accounted for. */
function inScope(status: FeatureStatus): boolean {
  return status !== "never-had";
}

export function statusesOf(record: ProjectRecord, exists: (path: string) => boolean): Map<string, FeatureStatus> {
  return new Map(FEATURES.map((feature) => [feature.id, featureStatus(feature, record, exists)]));
}

/** Sections on disk, by the name both shapes share: flat until one grows a companion. */
export function listSections(root: string): string[] {
  const dir = join(root, SECTIONS_DIR);

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || SECTION_FILE.test(entry.name))
    .map((entry) => entry.name.replace(SECTION_FILE, ""));
}

/** Sections on disk that neither a starter feature in scope nor the project claims. */
export function findUnaccountedSections(
  sections: readonly string[],
  record: ProjectRecord,
  statuses: Map<string, FeatureStatus>
): string[] {
  const declared = new Set(FEATURES.filter((feature) => inScope(statuses.get(feature.id) ?? "present")).flatMap(sectionNamesOf));

  return sections.filter((name) => !declared.has(name) && !record.sections.includes(name));
}

/** Registered document types that neither the starter nor the project accounts for. */
export function findUnaccountedTypes(
  registered: readonly string[],
  record: ProjectRecord,
  statuses: Map<string, FeatureStatus>,
  isSystemType: (type: string) => boolean
): string[] {
  const known = new Set([
    ...CORE_DOCUMENT_TYPES,
    ...record.documentTypes,
    ...FEATURES.filter((feature) => inScope(statuses.get(feature.id) ?? "present")).flatMap(
      (feature) => feature.documentTypes ?? []
    ),
  ]);

  return registered.filter((type) => !isSystemType(type) && !known.has(type));
}

/** Record entries the tree contradicts, each as a sentence saying what to fix. */
export function findRecordConflicts(record: ProjectRecord, exists: (path: string) => boolean): string[] {
  const conflicts: string[] = [];

  for (const [id, entry] of Object.entries(record.features)) {
    const feature = FEATURES.find((candidate) => candidate.id === id);

    if (!feature) {
      conflicts.push(`${id} is recorded as ${entry.state}, but the starter manifest has no such feature.`);
      continue;
    }

    const left = feature.paths.flatMap((path) => onDisk(path, exists));

    if (entry.state !== "adopted" && left.length > 0) {
      conflicts.push(
        `${id} is recorded as ${entry.state}, but ${left.join(", ")} is back. Delete it, or mark the feature adopted.`
      );
    }
  }

  return conflicts;
}

/** The trim itself names every path, and generated types cite their sources. */
const NOT_A_REFERENCE = ["scripts/trim-features", "sanity/types.ts"];

/**
 * Code a removal would break: files outside these features, and outside the registries they edit,
 * that import what they delete. In a project that is the code saying the feature is still in use.
 */
export function findOutsideImporters(index: ImportIndex, features: readonly Feature[]): Importer[] {
  const owned = features.flatMap((feature) => feature.paths);
  const edited = features.flatMap((feature) => feature.edits.map((entry) => entry.file));

  return findImporters(index, owned, [...owned, ...edited, ...NOT_A_REFERENCE]);
}

/** The record after a trim run: every feature it removed, dated. */
export function recordTrimmed(record: ProjectRecord, ids: string[], on: string): ProjectRecord {
  const features = { ...record.features };

  for (const id of ids) {
    features[id] = { state: "trimmed", on };
  }

  return { ...record, features };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
