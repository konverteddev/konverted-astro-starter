/**
 * What the schema declares, read from the extracted schema rather than from the code.
 *
 * `sanity-schema.json` is the one artifact that states the content model outright: every document
 * type this project registers, by name. That makes it the right basis for "is this content
 * stranded?", because the question has an exact answer that needs no knowledge of where any file
 * lives — a `_type` with documents but no schema behind it cannot be rendered, queried by the app,
 * or opened in the Studio, whatever the tree around it looks like.
 *
 * The manifest cannot answer that question outside the project it was written for. This can answer
 * it anywhere, including in a project that renamed its types or moved its schema folder, and it
 * finds orphans of types nobody wrote a manifest entry for.
 *
 * Everything here is pure: the caller reads the file and runs the queries.
 */

/** One entry of the extracted schema. Only the two fields this module reads are described. */
type SchemaEntry = { name?: string; type?: string };

/** A `_type` present in the dataset, with how many documents carry it. */
export type LiveType = { type: string; published: number; drafts: number };

/**
 * Types this project's schema does not own.
 *
 * A dot is a namespace, and every namespace belongs to Sanity or to a plugin: `sanity.imageAsset`,
 * `media.tag`, `mux.apiKey`. A project's own document types are plain identifiers. Judged by that
 * shape rather than by a list of prefixes, because a list is only ever as current as the last plugin
 * someone installed, and `mux.apiKey` proved the point: the Mux plugin writes it at runtime, the
 * extract never mentions it, and it held live credentials one confirmation away from deletion.
 *
 * Being wrong in this direction costs a type never being offered for purge. Being wrong the other
 * way deletes something no one can put back.
 */
export function isSystemType(type: string): boolean {
  return type.includes(".") || type.startsWith("_");
}

/**
 * Document type names the extracted schema declares.
 *
 * Object types are skipped: only a document type can have documents stored against it, so only a
 * document type can be orphaned.
 */
export function parseRegisteredTypes(json: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`sanity-schema.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("sanity-schema.json is not the expected array of schema entries.");
  }

  const names = (parsed as SchemaEntry[])
    .filter((entry) => entry.type === "document" && typeof entry.name === "string")
    .map((entry) => entry.name as string);

  return [...new Set(names)].sort();
}

/**
 * Every type name a stored item may carry: named schema types, plus the `_type` literals the extract
 * writes for inline array members. A page-builder item is the second kind (`ctaSectionField`).
 */
export function parseAllTypeNames(json: string): string[] {
  const names = new Set<string>();

  const walk = (value: unknown): void => {
    if (value === null || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const entry = value as Record<string, unknown>;
    const literal = (entry._type as { value?: { type?: string; value?: unknown } } | undefined)?.value;

    if (literal?.type === "string" && typeof literal.value === "string") {
      names.add(literal.value);
    }

    Object.values(entry).forEach(walk);
  };

  const parsed = JSON.parse(json) as SchemaEntry[];

  for (const entry of parsed) {
    if (typeof entry.name === "string") {
      names.add(entry.name);
    }
  }

  walk(parsed);

  return [...names].sort();
}

/** A page-builder section type the schema has stopped declaring, and how many items still use it. */
export type StrandedSection = { type: string; uses: number };

/** Section types pages still store that no schema type declares: a code-only trim of a section leaves these. */
export function findStrandedSectionTypes(declared: readonly string[], live: readonly string[]): string[] {
  const known = new Set(declared);

  return [...new Set(live)].filter((type) => !known.has(type) && !isSystemType(type)).sort();
}

/**
 * Live types with no schema behind them, newest problem first (most documents first).
 *
 * This is the whole orphan report. A type is stranded when the dataset still stores documents under
 * it and the schema no longer declares it, which is exactly the state a code-only trim leaves
 * behind, and also the state left by a type that was renamed or dropped years ago.
 */
export function findOrphanTypes(registered: string[], live: LiveType[]): LiveType[] {
  const known = new Set(registered);

  return live
    .filter((entry) => !known.has(entry.type) && !isSystemType(entry.type) && entry.published + entry.drafts > 0)
    .sort((a, b) => b.published + b.drafts - (a.published + a.drafts) || a.type.localeCompare(b.type));
}

/** Live types the schema still declares, so their documents are in use rather than stranded. */
export function findLiveRegisteredTypes(registered: string[], live: LiveType[]): LiveType[] {
  const known = new Set(registered);

  return live.filter((entry) => known.has(entry.type) && !isSystemType(entry.type));
}

/** English pluralisation, kept beside the formatter that needs it. */
function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The `📊 Stranded content` block: what has documents but no schema. */
export function formatOrphanReport(
  dataset: string,
  orphans: LiveType[],
  registeredCount: number,
  sections: readonly StrandedSection[] = []
): string[] {
  const lines = [`📊 Stranded content in "${dataset}"`, ""];

  if (orphans.length === 0 && sections.length === 0) {
    return [...lines, `   ✅ Nothing stranded. Every stored type is one of the ${registeredCount} the schema declares.`, ""];
  }

  const width = Math.max(...orphans.map((entry) => entry.type.length), ...sections.map((entry) => entry.type.length));

  for (const entry of orphans) {
    const drafts = entry.drafts > 0 ? ` (+${plural(entry.drafts, "draft")})` : "";

    lines.push(
      `   • ${entry.type.padEnd(width)}  ${String(entry.published).padStart(5)} ${entry.published === 1 ? "document " : "documents"}${drafts}`
    );
  }

  for (const entry of sections) {
    lines.push(
      `   • ${entry.type.padEnd(width)}  ${String(entry.uses).padStart(5)} section ${entry.uses === 1 ? "use" : "uses"} inside pages`
    );
  }

  if (orphans.length > 0) {
    lines.push(
      "",
      `   ${plural(orphans.length, "type")} with no schema behind ${orphans.length === 1 ? "it" : "them"}: these documents cannot be`,
      "   rendered, queried by the app, or opened in the Studio."
    );
  }

  if (sections.length > 0) {
    lines.push(
      "",
      "   Section items whose type the schema no longer declares: the Studio flags them as unknown and",
      "   the site skips them. Deleting strips them out of their pages."
    );
  }

  return [...lines, ""];
}
