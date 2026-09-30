/**
 * What a feature costs in live content, and what it takes to remove it.
 *
 * The report runs before the trim asks anything, so "remove the blog" is answered knowing there are
 * twelve articles in `development`. The purge that follows is deliberately loud about the three
 * things a naive delete gets wrong:
 *
 * - **Strong references block deletion.** `article.categories[] -> articleCategory` and
 *   `article.author -> person` are strong, so articles have to go before the categories and people
 *   they point at. The plan states that order rather than discovering it as a failed transaction.
 * - **Weak references dangle.** `internal.link` is `weak: true` and can point at any routed document
 *   from the Site singleton, a person's links, a CTA section or any rich text annotation. Deleting
 *   the target leaves a live `_ref` to nothing, so every holder is listed instead of quietly broken.
 * - **Section anchors are not references at all.** `internal.sectionTarget` stores a section item's
 *   `_key` as a plain string, so removing a section silently degrades those links to a bare page
 *   URL. The keys that are about to disappear are collected and reported.
 *
 * The query builders and the formatting are pure and unit tested; only `readUsage` and `purge` talk
 * to Sanity.
 */

import type { SanityClient } from "@sanity/client";
import { captureSanityCommand } from "../sanity-dataset/lib";
import {
  findOrphanTypes,
  findStrandedSectionTypes,
  type LiveType,
  parseAllTypeNames,
  parseRegisteredTypes,
  type StrandedSection,
} from "./schema";

/**
 * Sanity type names, including the dotted form plugins use (`mux.videoAsset`).
 *
 * These no longer only come from the manifest: the orphan report discovers them in the dataset, so
 * anything interpolated into a query is checked against this first and skipped if it does not match.
 */
const TYPE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;

export type DocumentUsage = {
  type: string;
  published: number;
  drafts: number;
};

export type SectionUsage = {
  type: string;
  /** One entry per page that still uses the section, with how many times. */
  pages: { _id: string; uri?: string; count: number }[];
};

export type ReferenceHolder = {
  _id: string;
  _type: string;
  uri?: string;
};

export type Usage = {
  dataset: string;
  documents: DocumentUsage[];
  sections: SectionUsage[];
  /** Documents holding a weak reference to something about to be deleted. */
  weakReferenceHolders: ReferenceHolder[];
  /** Documents whose `internal.sectionTarget` names a section key about to disappear. */
  sectionAnchorHolders: ReferenceHolder[];
  /** Documents carrying generated Markdown that goes stale the moment content is deleted. */
  staleMarkdownHolders: ReferenceHolder[];
  /** Doomed documents something outside the delete set still references. */
  blocked: BlockedDocument[];
};

/** A doomed document, and what still points at it from outside the delete set. */
export type BlockedDocument = {
  _id: string;
  _type: string;
  blockedBy: ReferenceHolder[];
};

function assertTypeNames(types: string[]): void {
  for (const type of types) {
    if (!TYPE_NAME.test(type)) {
      throw new Error(`Refusing to build a query for the unexpected type name "${type}".`);
    }
  }
}

/** A GROQ string literal, single-quoted because the shell already owns the double quotes. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

/**
 * One query for the whole report. Published and draft documents are counted separately with an
 * explicit `path("drafts.**")` test, so the numbers do not depend on which perspective the Sanity
 * CLI happens to run under.
 */
export function buildUsageQuery(documentTypes: string[], sectionTypes: string[]): string {
  assertTypeNames([...documentTypes, ...sectionTypes]);

  const documents = documentTypes
    .map(
      (type) =>
        `${literal(type)}: { "published": count(*[_type == ${literal(type)} && !(_id in path("drafts.**"))]), "drafts": count(*[_type == ${literal(type)} && _id in path("drafts.**")]) }`
    )
    .join(", ");

  const sections = sectionTypes
    .map(
      (type) =>
        `${literal(type)}: *[count(pageBuilder.sectionsArray[_type == ${literal(type)}]) > 0]{ _id, "uri": uri.current, "count": count(pageBuilder.sectionsArray[_type == ${literal(type)}]) }`
    )
    .join(", ");

  return `{ "documents": { ${documents} }, "sections": { ${sections} } }`;
}

/**
 * Documents whose `internal.sectionTarget` names one of the section keys about to be removed. The
 * anchor is a plain string rather than a reference, so nothing in Sanity would ever report these as
 * broken; without this query they degrade silently to a bare page URL.
 *
 * GROQ has no "find this string anywhere in the document" operator, so the scan covers where the
 * schema actually puts a link: a page-builder section's own `appLink`. A `sectionTarget` written
 * into a rich text annotation is not reachable here, which is why the closing report says the
 * anchor check is a floor rather than a guarantee.
 */
export function buildSectionAnchorQuery(sectionKeys: string[]): string {
  if (sectionKeys.length === 0) {
    return "[]";
  }

  const keys = sectionKeys.map(literal).join(", ");

  return `*[
  count(pageBuilder.sectionsArray[sectionContent.appLink.internal.sectionTarget in [${keys}]]) > 0
]{ _id, _type, "uri": uri.current }`;
}

/**
 * Every `_key` a removed section occupies, so the anchors pointing at them can be reported. Returned
 * alongside the owning document, because a `_key` is only unique within its own array.
 */
export function buildSectionKeyQuery(sectionTypes: string[]): string {
  assertTypeNames(sectionTypes);

  const types = sectionTypes.map(literal).join(", ");

  return `*[count(pageBuilder.sectionsArray[_type in [${types}]]) > 0]{
  _id,
  "uri": uri.current,
  "keys": pageBuilder.sectionsArray[_type in [${types}]]._key
}`;
}

/** Documents carrying generated Markdown, which is stored verbatim and goes wrong after a purge. */
export function buildStaleMarkdownQuery(): string {
  return `*[defined(agentMarkdown.content) || defined(llms.content)]{ _id, _type, "uri": uri.current }`;
}

/** Ids of every document of the doomed types, drafts included, newest-dependent types first. */
export function buildDeleteIdsQuery(documentTypes: string[]): string {
  assertTypeNames(documentTypes);

  const types = documentTypes.map(literal).join(", ");

  return `*[_type in [${types}]]{ _id, _type }`;
}

/**
 * Every distinct `_type` stored in the dataset.
 *
 * The other half of the orphan report: the schema says what is declared, this says what is actually
 * stored, and the difference is what nothing can render.
 */
export function buildLiveTypesQuery(): string {
  return `array::unique(*[]._type)`;
}

/** Every section item type pages store, declared or not: the other half of the stranded-section check. */
export function buildLiveSectionTypesQuery(): string {
  return `array::unique(*[defined(pageBuilder.sectionsArray)].pageBuilder.sectionsArray[]._type)`;
}

/** Published and draft counts for a set of types, counted separately so neither hides the other. */
export function buildTypeCountsQuery(types: string[]): string {
  const usable = types.filter((type) => TYPE_NAME.test(type));

  if (usable.length === 0) {
    return "{}";
  }

  const entries = usable
    .map(
      (type) =>
        `${literal(type)}: { "published": count(*[_type == ${literal(type)} && !(_id in path("drafts.**"))]), "drafts": count(*[_type == ${literal(type)} && _id in path("drafts.**")]) }`
    )
    .join(", ");

  return `{ ${entries} }`;
}

/**
 * Documents of the doomed types that something *outside* the delete set still points at.
 *
 * This replaces knowing a deletion order. A strong reference from a document that is also being
 * deleted is not a problem, because both go in one transaction; a reference from anything that
 * survives is, and no hardcoded ordering could have anticipated it for a type the manifest has
 * never heard of. So the dataset is asked directly.
 */
export function buildExternalReferrerQuery(documentTypes: string[]): string {
  assertTypeNames(documentTypes);

  const types = documentTypes.map(literal).join(", ");

  return `*[_type in [${types}]]{
  _id,
  _type,
  "blockedBy": *[references(^._id) && !(_type in [${types}])][0...5]{ _id, _type, "uri": uri.current }
}[count(blockedBy) > 0][0...50]`;
}

/** A query for whole documents by id, to read the references a holder actually stores. */
export function buildDocumentsQuery(ids: string[]): string {
  return `*[_id in [${ids.map(literal).join(", ")}]]`;
}

/**
 * Whether `holder` references `id` strongly, weakly, or not at all. A strong reference makes Sanity
 * refuse the whole transaction; a weak one survives it and dangles.
 */
export function referenceStrength(holder: unknown, id: string): "strong" | "weak" | undefined {
  let found: "strong" | "weak" | undefined;

  const walk = (value: unknown): void => {
    if (found === "strong" || value === null || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const entry = value as Record<string, unknown>;

    if (entry._ref === id) {
      found = entry._weak === true ? (found ?? "weak") : "strong";
    }

    Object.values(entry).forEach(walk);
  };

  walk(holder);

  return found;
}

/**
 * Splits what points in from outside the purge by how it points. A holder that could not be read is
 * treated as strong: saying a purge might fail is safe, saying it will succeed is not.
 */
export function splitByStrength(
  blocked: BlockedDocument[],
  holders: Record<string, unknown>
): { strong: BlockedDocument[]; weakHolders: ReferenceHolder[] } {
  const strong: BlockedDocument[] = [];
  const weakHolders = new Map<string, ReferenceHolder>();

  for (const entry of blocked) {
    const strongHolders = entry.blockedBy.filter((holder) => {
      const document = holders[holder._id];

      return document === undefined || referenceStrength(document, entry._id) === "strong";
    });

    for (const holder of entry.blockedBy.filter((candidate) => !strongHolders.includes(candidate))) {
      weakHolders.set(holder._id, holder);
    }

    if (strongHolders.length > 0) {
      strong.push({ ...entry, blockedBy: strongHolders });
    }
  }

  return { strong, weakHolders: [...weakHolders.values()] };
}

/** Everything outside the purge that points in, split into what blocks it and what will dangle. */
function readReferrers(dataset: string, documentTypes: string[]): { strong: BlockedDocument[]; weakHolders: ReferenceHolder[] } {
  if (documentTypes.length === 0) {
    return { strong: [], weakHolders: [] };
  }

  const blocked = runQuery<BlockedDocument[]>(buildExternalReferrerQuery(documentTypes), dataset) ?? [];
  const ids = [...new Set(blocked.flatMap((entry) => entry.blockedBy.map((holder) => holder._id)))];
  const documents = ids.length > 0 ? (runQuery<{ _id: string }[]>(buildDocumentsQuery(ids), dataset) ?? []) : [];

  return splitByStrength(blocked, Object.fromEntries(documents.map((document) => [document._id, document])));
}

/**
 * Whether a feature still has content behind it.
 *
 * The question the dataset-only purge is built on: its files are gone, but is anything left to
 * delete? A type with a schema but no documents is not stranded, and preselecting it would invite
 * someone to confirm a delete that does nothing.
 */
export function isStranded(feature: { documentTypes?: string[]; sectionTypes?: string[] }, usage: Usage): boolean {
  const documentTypes = feature.documentTypes ?? [];
  const sectionTypes = feature.sectionTypes ?? [];

  const hasDocuments = usage.documents.some((entry) => documentTypes.includes(entry.type) && entry.published + entry.drafts > 0);
  const hasSections = usage.sections.some(
    (entry) => sectionTypes.includes(entry.type) && entry.pages.some((page) => page.count > 0)
  );

  return hasDocuments || hasSections;
}

/** English pluralisation for the report, kept out of the formatter so the formatter stays readable. */
function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Verb agreement for the counted warnings, so a single holder does not read as a typo. */
function verb(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** The `📊 Dataset usage` block, printed before the trim asks which features to remove. */
export function formatUsageReport(usage: Usage): string[] {
  const lines = [`📊 Dataset usage (${usage.dataset})`, ""];

  if (usage.documents.length === 0 && usage.sections.length === 0) {
    return [...lines, "   • nothing to report: none of these features stores content.", ""];
  }

  const labelWidth = Math.max(
    ...usage.documents.map((entry) => entry.type.length),
    ...usage.sections.map((entry) => entry.type.length),
    0
  );

  for (const entry of usage.documents) {
    const total = entry.published + entry.drafts;
    const drafts = entry.drafts > 0 ? ` (+${plural(entry.drafts, "draft")})` : "";
    const verdict = total > 0 ? "⚠️  in use" : "✅ unused";

    const noun = entry.published === 1 ? "document " : "documents";

    lines.push(`   • ${entry.type.padEnd(labelWidth)}  ${String(entry.published).padStart(4)} ${noun}${drafts}  ${verdict}`);
  }

  for (const entry of usage.sections) {
    const instances = entry.pages.reduce((sum, page) => sum + page.count, 0);
    const verdict = instances > 0 ? "⚠️  in use" : "✅ unused";

    lines.push(
      `   • ${entry.type.padEnd(labelWidth)}  ${String(instances).padStart(4)} ${instances === 1 ? "instance " : "instances"} across ${plural(entry.pages.length, "page")}  ${verdict}`
    );
  }

  return [...lines, ""];
}

/** The purge plan: the delete order, then everything the purge cannot fix and will not pretend to. */
export function formatPurgePlan(usage: Usage, documentTypes: string[]): string[] {
  const lines = ["🗑️  Dataset purge plan", ""];

  if (documentTypes.length === 0 && usage.sections.length === 0) {
    lines.push("   • nothing to delete.");
    return [...lines, ""];
  }

  if (documentTypes.length > 0) {
    // One transaction, so a strong reference between two doomed documents is not a problem and no
    // ordering is needed. What matters is anything outside the set still pointing in, which is
    // reported separately because no ordering could fix it.
    lines.push(`   Types: ${documentTypes.join(", ")}`);
  }

  if (documentTypes.length > 0) {
    const total = usage.documents.reduce((sum, entry) => sum + entry.published + entry.drafts, 0);
    lines.push(`   ${plural(total, "document")} including drafts, deleted in one transaction.`);
  }

  for (const { type, pages } of usage.sections.filter((entry) => entry.pages.length > 0)) {
    const uses = pages.reduce((sum, page) => sum + page.count, 0);
    lines.push(`   ${type}: ${plural(uses, "section use")} stripped from ${plural(pages.length, "page")}; the pages stay.`);
  }

  lines.push("");

  if (usage.blocked.length > 0) {
    lines.push(
      `   ⛔ ${plural(usage.blocked.length, "document")} ${verb(usage.blocked.length, "is", "are")} held by a strong reference from something that survives.`,
      "      Sanity would refuse the whole purge and delete nothing. Remove these references first:"
    );

    for (const entry of usage.blocked.slice(0, 10)) {
      const holders = entry.blockedBy.map((holder) => `${holder._type} ${holder.uri ?? holder._id}`).join(", ");
      lines.push(`      - ${entry._type} ${entry._id} ← ${holders}`);
    }

    if (usage.blocked.length > 10) {
      lines.push(`      … and ${usage.blocked.length - 10} more`);
    }

    lines.push("");
  }

  if (usage.weakReferenceHolders.length > 0) {
    const count = usage.weakReferenceHolders.length;
    lines.push(`   ⚠️  ${plural(count, "document")} ${verb(count, "holds", "hold")} a weak reference that will dangle:`);

    for (const holder of usage.weakReferenceHolders) {
      lines.push(`      - ${holder._type} ${holder.uri ?? holder._id}`);
    }

    lines.push("");
  }

  if (usage.sectionAnchorHolders.length > 0) {
    const count = usage.sectionAnchorHolders.length;
    lines.push(`   ⚠️  ${plural(count, "link")} ${verb(count, "anchors", "anchor")} to a section that is being removed:`);

    for (const holder of usage.sectionAnchorHolders) {
      lines.push(`      - ${holder._type} ${holder.uri ?? holder._id} (falls back to the bare page URL)`);
    }

    lines.push("");
  }

  if (usage.staleMarkdownHolders.length > 0) {
    const count = usage.staleMarkdownHolders.length;

    lines.push(
      `   ⚠️  ${plural(count, "document")} ${verb(count, "carries", "carry")} generated Markdown that will describe deleted content.`,
      "      Regenerate from the Agents tab after the purge.",
      ""
    );
  }

  return lines;
}

/** Reads a GROQ query through the Sanity CLI, which uses the machine's `sanity login` and no token. */
export function runQuery<Result>(query: string, dataset: string, apiVersion = "2025-02-19"): Result | undefined {
  const result = captureSanityCommand(["documents", "query", query, "--dataset", dataset, "--api-version", apiVersion]);

  if (!result.ok) {
    return undefined;
  }

  try {
    return JSON.parse(result.stdout) as Result;
  } catch {
    return undefined;
  }
}

type RawUsage = {
  documents: Record<string, { published: number; drafts: number }>;
  sections: Record<string, { _id: string; uri?: string; count: number }[]>;
};

/**
 * The whole report in four reads. Returns `undefined` when Sanity is unreachable, so the caller can
 * carry on with the code trim and say plainly that the choice is uninformed.
 */
export function readUsage(dataset: string, documentTypes: string[], sectionTypes: string[]): Usage | undefined {
  const raw = runQuery<RawUsage>(buildUsageQuery(documentTypes, sectionTypes), dataset);

  if (!raw) {
    return undefined;
  }

  const sectionKeyDocs =
    sectionTypes.length > 0
      ? (runQuery<{ _id: string; uri?: string; keys?: string[] }[]>(buildSectionKeyQuery(sectionTypes), dataset) ?? [])
      : [];
  const sectionKeys = sectionKeyDocs.flatMap((entry) => entry.keys ?? []);
  const referrers = readReferrers(dataset, documentTypes);

  return {
    dataset,
    documents: documentTypes.map((type) => ({
      type,
      published: raw.documents?.[type]?.published ?? 0,
      drafts: raw.documents?.[type]?.drafts ?? 0,
    })),
    sections: sectionTypes.map((type) => ({ type, pages: raw.sections?.[type] ?? [] })),
    weakReferenceHolders: referrers.weakHolders,
    sectionAnchorHolders:
      sectionKeys.length > 0 ? (runQuery<ReferenceHolder[]>(buildSectionAnchorQuery(sectionKeys), dataset) ?? []) : [],
    staleMarkdownHolders: runQuery<ReferenceHolder[]>(buildStaleMarkdownQuery(), dataset) ?? [],
    blocked: referrers.strong,
  };
}

/** Documents per type and section instances per section type, in one read, for the status table. */
export function readTypeTotals(
  dataset: string,
  documentTypes: string[],
  sectionTypes: string[]
): Record<string, number> | undefined {
  const raw = runQuery<RawUsage>(buildUsageQuery(documentTypes, sectionTypes), dataset);

  if (!raw) {
    return undefined;
  }

  return Object.fromEntries([
    ...documentTypes.map((type) => [type, (raw.documents?.[type]?.published ?? 0) + (raw.documents?.[type]?.drafts ?? 0)]),
    ...sectionTypes.map((type) => [type, (raw.sections?.[type] ?? []).reduce((sum, page) => sum + page.count, 0)]),
  ]);
}

export type Stranded = { dataset: string; documents: LiveType[]; sections: StrandedSection[] };

/**
 * What a dataset stores that the schema no longer declares: whole documents, and section items left
 * inside pages. Needs no manifest, so it finds what any earlier trim, or hand edit, left behind.
 */
export function readStranded(dataset: string, schemaJson: string): Stranded | undefined {
  const liveTypes = runQuery<string[]>(buildLiveTypesQuery(), dataset);

  if (!liveTypes) {
    return undefined;
  }

  const counts = runQuery<Record<string, { published: number; drafts: number }>>(buildTypeCountsQuery(liveTypes), dataset) ?? {};
  const live = liveTypes.map((type) => ({
    type,
    published: counts[type]?.published ?? 0,
    drafts: counts[type]?.drafts ?? 0,
  }));
  const sectionTypes = findStrandedSectionTypes(
    parseAllTypeNames(schemaJson),
    runQuery<string[]>(buildLiveSectionTypesQuery(), dataset) ?? []
  ).filter((type) => TYPE_NAME.test(type));
  const uses = sectionTypes.length > 0 ? runQuery<RawUsage>(buildUsageQuery([], sectionTypes), dataset) : undefined;

  return {
    dataset,
    documents: findOrphanTypes(parseRegisteredTypes(schemaJson), live),
    sections: sectionTypes.map((type) => ({
      type,
      uses: (uses?.sections?.[type] ?? []).reduce((sum, page) => sum + page.count, 0),
    })),
  };
}

export type PurgeResult = {
  deletedDocuments: number;
  strippedSections: number;
};

/**
 * Deletes the doomed documents in strong-reference order, then strips the removed sections out of
 * every page that still carries one. Sections are patched rather than deleted: the page survives,
 * only its `sectionsArray` entries go.
 */
export async function purge(
  client: SanityClient,
  options: { documentTypes: string[]; sectionTypes: string[] }
): Promise<PurgeResult> {
  const { documentTypes, sectionTypes } = options;
  let deletedDocuments = 0;

  if (documentTypes.length > 0) {
    const ids = await client.fetch<string[]>(`*[_type in $types]._id`, { types: documentTypes });

    if (ids.length > 0) {
      // One transaction for every type at once. A strong reference between two doomed documents is
      // then not a problem, which is what a deletion order used to be for; anything pointing in from
      // outside was reported by the plan and will fail here loudly rather than silently.
      await ids.reduce((tx, id) => tx.delete(id), client.transaction()).commit({ visibility: "async" });
      deletedDocuments = ids.length;
    }
  }

  let strippedSections = 0;

  if (sectionTypes.length > 0) {
    assertTypeNames(sectionTypes);

    const pages = await client.fetch<{ _id: string; count: number }[]>(
      `*[count(pageBuilder.sectionsArray[_type in $types]) > 0]{ _id, "count": count(pageBuilder.sectionsArray[_type in $types]) }`,
      { types: sectionTypes }
    );

    for (const page of pages) {
      await client
        .patch(page._id)
        .unset(sectionTypes.map((type) => `pageBuilder.sectionsArray[_type == "${type}"]`))
        .commit({ visibility: "async" });

      strippedSections += page.count;
    }
  }

  return { deletedDocuments, strippedSections };
}
