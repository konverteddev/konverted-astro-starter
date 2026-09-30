import assert from "node:assert/strict";
import { test } from "node:test";
import { FEATURES, type Feature, findFeature, sectionNamesOf, shapesOf } from "./features";
import {
  detectRole,
  emptyRecord,
  featureStatus,
  findRecordConflicts,
  findUnaccountedSections,
  findUnaccountedTypes,
  normalizeRepository,
  type ProjectRecord,
  parseProjectRecord,
  recordTrimmed,
  serializeProjectRecord,
  statusesOf,
} from "./project";
import { isSystemType } from "./schema";

const STARTER = "The-Content-Architecture/the-content-architecture-astro";

function feature(id: string): Feature {
  const found = findFeature(id);

  assert.ok(found, `no feature ${id}`);

  return found;
}

function project(overrides: Partial<ProjectRecord> = {}, cutFrom: string | null = "2026-08-19"): ProjectRecord {
  return { ...emptyRecord(STARTER), ...overrides, starter: { repository: STARTER, cutFrom } };
}

const everything = () => true;
const nothing = () => false;

test("normalizeRepository treats ssh and https remotes of one repository as the same", () => {
  const ssh = normalizeRepository(`git@github.com:${STARTER}.git`);

  assert.equal(ssh, normalizeRepository(`https://github.com/${STARTER}`));
  assert.equal(ssh, normalizeRepository(STARTER));
});

test("detectRole: the starter is its own origin with no cut date; anything else is a project", () => {
  const starter = normalizeRepository(STARTER);

  assert.equal(detectRole(project({}, null), starter), "starter");
  assert.equal(detectRole(project({}, null), "someone/client-site"), "project");
  assert.equal(detectRole(project({}, null), undefined), "project");
  assert.equal(detectRole(project({}, "2026-08-19"), starter), "project");
});

test("featureStatus reads the tree when nothing is recorded", () => {
  const blog = feature("blog");

  assert.equal(featureStatus(blog, project(), everything), "present");
  assert.equal(
    featureStatus(blog, project(), (path) => path === blog.paths[0]),
    "partial"
  );
  assert.equal(featureStatus(blog, project(), nothing), "absent");
});

test("featureStatus: a feature newer than the cut was never here, whatever shares its names", () => {
  const headline = feature("section:headline");

  assert.equal(featureStatus(headline, project({}, "2026-08-19"), everything), "never-had");
  assert.equal(featureStatus(headline, project({}, "2026-09-09"), everything), "present");
  assert.equal(featureStatus(headline, project({}, null), everything), "present");
});

test("featureStatus: a recorded decision wins over the tree", () => {
  const record = project({ features: { blog: { state: "adopted", note: "became research" } } });

  assert.equal(featureStatus(feature("blog"), record, everything), "adopted");
});

test("a never-had feature does not vouch for a section that shares its name", () => {
  const record = project();
  const statuses = statusesOf(record, everything);
  const [headline = ""] = sectionNamesOf(feature("section:headline"));
  const [media = ""] = sectionNamesOf(feature("section:media"));

  assert.deepEqual(findUnaccountedSections([headline, media], record, statuses), [headline]);
  assert.deepEqual(findUnaccountedSections([headline], { ...record, sections: [headline] }, statuses), []);
});

test("an adopted feature still accounts for its types; the project's own types come from the record", () => {
  const record = project({ features: { blog: { state: "adopted" } }, documentTypes: ["research"] });
  const statuses = statusesOf(record, everything);

  assert.deepEqual(findUnaccountedTypes(["article", "research", "page", "mux.apiKey", "faq"], record, statuses, isSystemType), [
    "faq",
  ]);
});

test("findRecordConflicts names a trimmed feature whose files came back, and an unknown id", () => {
  const record = project({ features: { blog: { state: "trimmed" }, nope: { state: "removed" } } });

  const conflicts = findRecordConflicts(record, everything);

  assert.equal(conflicts.length, 2);
  assert.match(conflicts[0] ?? "", /blog is recorded as trimmed/);
  assert.match(conflicts[1] ?? "", /no such feature/);
  assert.deepEqual(findRecordConflicts(record, nothing).length, 1);
  assert.deepEqual(findRecordConflicts(project({ features: { blog: { state: "adopted" } } }), everything), []);
});

test("recordTrimmed dates every feature a run removed", () => {
  const next = recordTrimmed(project(), ["blog", "authors"], "2026-09-22");

  assert.deepEqual(next.features.blog, { state: "trimmed", on: "2026-09-22" });
  assert.deepEqual(next.features.authors, { state: "trimmed", on: "2026-09-22" });
});

test("the record round-trips, sorted and deduplicated so a rerun changes nothing", () => {
  const record = project({
    features: { "section:text": { state: "removed" }, blog: { state: "adopted" } },
    sections: ["ThesisSection", "FaqSection", "FaqSection"],
  });
  const json = serializeProjectRecord(record);
  const parsed = parseProjectRecord(json);

  assert.deepEqual(Object.keys(parsed.features), ["blog", "section:text"]);
  assert.deepEqual(parsed.sections, ["FaqSection", "ThesisSection"]);
  assert.equal(serializeProjectRecord(parsed), json);
});

test("parseProjectRecord refuses a bad date or state with a readable message", () => {
  assert.throws(() => parseProjectRecord('{"starter":{"cutFrom":"last week"}}'), /YYYY-MM-DD/);
  assert.throws(() => parseProjectRecord('{"features":{"blog":{"state":"gone"}}}'), /expected one of/);
  assert.throws(() => parseProjectRecord("{ nope"), /not valid JSON/);
});

test("every feature's since is on or after the first cut, so no project predates the starter", () => {
  for (const entry of FEATURES) {
    assert.ok(entry.since >= "2026-07-16", `${entry.id}: since ${entry.since} predates the starter`);
  }
});

test("a section the manifest names as a folder is still found as the flat file an older cut has", () => {
  const media = feature("section:media");
  const [renderer = "", ...rest] = media.paths;
  const flat = shapesOf(renderer).find((shape) => shape !== renderer) ?? "";
  const onlyFlat = (path: string) => path === flat || rest.includes(path);

  assert.notEqual(flat, "");
  assert.equal(featureStatus(media, project(), onlyFlat), "present");
  assert.deepEqual(shapesOf(rest[0] ?? ""), [rest[0]]);
});

test("the starter's first commit survives a round trip, and a record without one parses", () => {
  const record = project();
  const withRoot = { ...record, starter: { ...record.starter, root: "f541405eea64d8e3202df7789e15b79c5a93013b" } };

  assert.equal(parseProjectRecord(serializeProjectRecord(withRoot)).starter.root, withRoot.starter.root);
  assert.equal(parseProjectRecord(serializeProjectRecord(record)).starter.root, undefined);
  assert.doesNotMatch(serializeProjectRecord(record), /"root"/);
});
