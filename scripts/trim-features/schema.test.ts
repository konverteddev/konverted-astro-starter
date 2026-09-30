import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  findLiveRegisteredTypes,
  findOrphanTypes,
  findStrandedSectionTypes,
  formatOrphanReport,
  isSystemType,
  type LiveType,
  parseAllTypeNames,
  parseRegisteredTypes,
} from "./schema";

const SCHEMA = JSON.stringify([
  { name: "page", type: "document", attributes: {} },
  { name: "article", type: "document" },
  { name: "sanity.imageAsset", type: "document" },
  { name: "appLink", type: "type" },
]);

const live = (type: string, published: number, drafts = 0): LiveType => ({ type, published, drafts });

test("parseRegisteredTypes takes document types only, since only they can have documents", () => {
  assert.deepEqual(parseRegisteredTypes(SCHEMA), ["article", "page", "sanity.imageAsset"]);
});

test("parseRegisteredTypes fails with a readable message rather than a stack trace", () => {
  assert.throws(() => parseRegisteredTypes("{ nope"), /not valid JSON/);
  assert.throws(() => parseRegisteredTypes('{"types":[]}'), /not the expected array/);
});

test("findOrphanTypes reports stored types the schema no longer declares", () => {
  const orphans = findOrphanTypes(["page", "article"], [live("page", 4), live("person", 3), live("blog", 1)]);

  assert.deepEqual(
    orphans.map((entry) => entry.type),
    ["person", "blog"]
  );
});

test("findOrphanTypes counts drafts, so an unpublished orphan is still reported", () => {
  assert.deepEqual(
    findOrphanTypes(["page"], [live("person", 0, 2)]).map((entry) => entry.type),
    ["person"]
  );
});

test("findOrphanTypes ignores a type with no documents left behind it", () => {
  assert.deepEqual(findOrphanTypes(["page"], [live("person", 0, 0)]), []);
});

test("findOrphanTypes never reports a plugin or system type, declared or not", () => {
  // AI Assist writes `sanity.assist.*` at runtime, so it is absent from the extract and would
  // otherwise look stranded. Deleting it would break the Studio.
  const orphans = findOrphanTypes(["page"], [live("sanity.assist.schemaType.annotations", 9), live("system.group", 2)]);

  assert.deepEqual(orphans, []);
  assert.ok(isSystemType("sanity.imageAsset"));
  assert.ok(isSystemType("_.schemas.default"));
  assert.ok(!isSystemType("person"));

  // Namespaced, so not this project's to delete, whether or not the extract happens to declare it.
  // `mux.apiKey` is the case that matters: the plugin writes it at runtime, it holds credentials,
  // and a prefix list that stopped at `sanity.` offered it for purge against a live dataset.
  assert.ok(isSystemType("mux.videoAsset"));
  assert.ok(isSystemType("mux.apiKey"));
  assert.ok(isSystemType("media.tag"));
});

test("findOrphanTypes puts the biggest problem first", () => {
  const orphans = findOrphanTypes([], [live("a", 1), live("b", 40), live("c", 9)]);

  assert.deepEqual(
    orphans.map((entry) => entry.type),
    ["b", "c", "a"]
  );
});

test("findLiveRegisteredTypes is the other half: stored types the schema still declares", () => {
  const types = findLiveRegisteredTypes(["page", "article"], [live("page", 4), live("person", 3)]);

  assert.deepEqual(
    types.map((entry) => entry.type),
    ["page"]
  );
});

test("formatOrphanReport gives a clean bill of health when nothing is stranded", () => {
  const report = formatOrphanReport("production", [], 17).join("\n");

  assert.match(report, /Nothing stranded/);
  assert.match(report, /17 the schema declares/);
});

test("formatOrphanReport names each type, its counts, and why it matters", () => {
  const report = formatOrphanReport("production", [live("article", 12, 2), live("person", 1)], 17).join("\n");

  assert.match(report, /article\s+12 documents \(\+2 drafts\)/);
  assert.match(report, /person\s+1 document /);
  assert.match(report, /2 types with no schema behind them/);
  assert.match(report, /cannot be\n {3}rendered, queried by the app, or opened in the Studio/);
});

test("this project's own extracted schema parses, and declares the types the app routes", () => {
  // Guards the assumption the whole orphan report rests on: that `sanity-schema.json` is present and
  // shaped the way this module reads it.
  const registered = parseRegisteredTypes(readFileSync(join(import.meta.dirname, "..", "..", "sanity-schema.json"), "utf8"));

  assert.ok(registered.includes("page"), "page is not in the extracted schema");
  assert.ok(registered.length > 5, `only ${registered.length} document types found`);
  assert.deepEqual(
    findOrphanTypes(
      registered,
      registered.map((type) => live(type, 1))
    ),
    []
  );
});

test("parseAllTypeNames includes object types and the _type literals of inline array members", () => {
  const withSections = JSON.stringify([
    ...JSON.parse(SCHEMA),
    {
      name: "page",
      type: "document",
      attributes: {
        sections: {
          type: "objectAttribute",
          value: {
            type: "array",
            of: {
              type: "object",
              attributes: { _type: { type: "objectAttribute", value: { type: "string", value: "ctaSectionField" } } },
            },
          },
        },
      },
    },
  ]);

  assert.deepEqual(parseAllTypeNames(SCHEMA), ["appLink", "article", "page", "sanity.imageAsset"]);
  assert.ok(parseAllTypeNames(withSections).includes("ctaSectionField"));
});

test("this project's own extract declares every page-builder member the starter ships", () => {
  const declared = parseAllTypeNames(readFileSync(join(import.meta.dirname, "..", "..", "sanity-schema.json"), "utf8"));

  assert.ok(
    declared.some((type) => type.endsWith("SectionField")),
    "no section member type found in the extract"
  );
});

test("findStrandedSectionTypes names section types pages store that no schema type declares", () => {
  assert.deepEqual(
    findStrandedSectionTypes(["textSectionField", "page"], ["textSectionField", "mediaSectionField", "mediaSectionField"]),
    ["mediaSectionField"]
  );
  assert.deepEqual(findStrandedSectionTypes(["textSectionField"], ["textSectionField"]), []);
});

test("formatOrphanReport lists stranded section uses beside stranded documents", () => {
  const report = formatOrphanReport("production", [live("legalPage", 1)], 10, [{ type: "mediaSectionField", uses: 3 }]).join(
    "\n"
  );

  assert.match(report, /legalPage\s+1 document /);
  assert.match(report, /mediaSectionField\s+3 section uses inside pages/);
  assert.match(report, /strips them out of their pages/);
  assert.doesNotMatch(formatOrphanReport("production", [], 10, []).join("\n"), /section uses/);
});
