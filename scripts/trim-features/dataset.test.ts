import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeleteIdsQuery,
  buildDocumentsQuery,
  buildExternalReferrerQuery,
  buildSectionAnchorQuery,
  buildSectionKeyQuery,
  buildTypeCountsQuery,
  buildUsageQuery,
  formatPurgePlan,
  formatUsageReport,
  isStranded,
  referenceStrength,
  splitByStrength,
  type Usage,
} from "./dataset";

const EMPTY: Usage = {
  dataset: "development",
  documents: [],
  sections: [],
  weakReferenceHolders: [],
  sectionAnchorHolders: [],
  staleMarkdownHolders: [],
  blocked: [],
};

test("buildUsageQuery counts published and drafts separately for each type", () => {
  const query = buildUsageQuery(["article"], []);

  assert.match(query, /'article': \{ "published": count\(\*\[_type == 'article' && !\(_id in path\("drafts\.\*\*"\)\)\]\)/);
  assert.match(query, /"drafts": count\(\*\[_type == 'article' && _id in path\("drafts\.\*\*"\)\]\)/);
});

test("buildUsageQuery projects the pages a section still appears on, with a per-page count", () => {
  const query = buildUsageQuery([], ["mediaSectionField"]);

  assert.match(query, /'mediaSectionField': \*\[count\(pageBuilder\.sectionsArray\[_type == 'mediaSectionField'\]\) > 0\]/);
  assert.match(query, /"uri": uri\.current/);
});

test("buildUsageQuery stays valid GROQ when either list is empty", () => {
  // An unquoted key is a GROQ syntax error, and the purge plan reads a blog, which has no sections.
  assert.equal(buildUsageQuery([], []), `{ "documents": {  }, "sections": {  } }`);
  assert.doesNotMatch(buildUsageQuery(["article"], []), /[{,]\s*[A-Za-z_]\w*\s*:/);
  assert.doesNotMatch(buildUsageQuery([], ["mediaSectionField"]), /[{,]\s*[A-Za-z_]\w*\s*:/);
});

test("every query builder refuses a type name it did not expect", () => {
  const injection = `page'] || *[_type == 'site`;

  assert.throws(() => buildUsageQuery([injection], []), /Refusing to build a query/);
  assert.throws(() => buildSectionKeyQuery([injection]), /Refusing to build a query/);
  assert.throws(() => buildDeleteIdsQuery([injection]), /Refusing to build a query/);
});

test("referenceStrength finds a reference anywhere in a document, and tells weak from strong", () => {
  const site = { _id: "site", footer: [{ internal: { link: { _ref: "blog", _type: "reference", _weak: true } } }] };
  const page = { _id: "p1", sections: [{ author: { _ref: "person-1", _type: "reference" } }] };

  assert.equal(referenceStrength(site, "blog"), "weak");
  assert.equal(referenceStrength(page, "person-1"), "strong");
  assert.equal(referenceStrength(page, "blog"), undefined);
  assert.equal(
    referenceStrength({ a: { _ref: "x", _weak: true }, b: { _ref: "x" } }, "x"),
    "strong",
    "one strong reference is enough to block"
  );
});

test("splitByStrength blocks only on strong references, and treats an unreadable holder as strong", () => {
  const blocked = [
    { _id: "blog", _type: "blog", blockedBy: [{ _id: "site", _type: "site" }] },
    { _id: "person-1", _type: "person", blockedBy: [{ _id: "p1", _type: "page", uri: "/team" }] },
    { _id: "a1", _type: "article", blockedBy: [{ _id: "missing", _type: "page" }] },
  ];
  const holders = {
    site: { _id: "site", link: { _ref: "blog", _weak: true } },
    p1: { _id: "p1", author: { _ref: "person-1" } },
  };
  const { strong, weakHolders } = splitByStrength(blocked, holders);

  assert.deepEqual(
    strong.map((entry) => entry._id),
    ["person-1", "a1"]
  );
  assert.deepEqual(
    weakHolders.map((holder) => holder._id),
    ["site"]
  );
});

test("buildDocumentsQuery fetches whole documents by literal id", () => {
  assert.equal(buildDocumentsQuery(["site", "p1"]), "*[_id in ['site', 'p1']]");
});

test("buildSectionAnchorQuery answers an empty list rather than a query when nothing is anchored", () => {
  assert.equal(buildSectionAnchorQuery([]), "[]");
});

test("buildSectionAnchorQuery matches the section keys that are about to disappear", () => {
  const query = buildSectionAnchorQuery(["abc123", "def456"]);

  assert.match(query, /sectionContent\.appLink\.internal\.sectionTarget in \['abc123', 'def456'\]/);
});

test("buildExternalReferrerQuery only looks for referrers that survive the delete", () => {
  const query = buildExternalReferrerQuery(["article", "person"]);

  assert.match(query, /references\(\^\._id\) && !\(_type in \['article', 'person'\]\)/);
  assert.match(query, /count\(blockedBy\) > 0/);
});

test("buildTypeCountsQuery skips a type name it cannot safely interpolate", () => {
  const query = buildTypeCountsQuery(["article", "not a type'; --"]);

  assert.match(query, /'article':/);
  assert.ok(!query.includes("not a type"));
});

test("buildTypeCountsQuery stays valid GROQ when nothing is countable", () => {
  assert.equal(buildTypeCountsQuery([]), "{}");
  assert.equal(buildTypeCountsQuery(["!!!"]), "{}");
});

test("formatUsageReport marks a type with content as in use and an empty one as unused", () => {
  const lines = formatUsageReport({
    ...EMPTY,
    documents: [
      { type: "article", published: 12, drafts: 2 },
      { type: "contactFormSubmission", published: 0, drafts: 0 },
    ],
  });

  assert.equal(lines[0], "📊 Dataset usage (development)");
  assert.match(lines.join("\n"), /article\s+12 documents \(\+2 drafts\)\s+⚠️ {2}in use/);
  assert.match(lines.join("\n"), /contactFormSubmission\s+0 documents\s+✅ unused/);
});

test("formatUsageReport totals a section across the pages that use it", () => {
  const lines = formatUsageReport({
    ...EMPTY,
    sections: [
      {
        type: "mediaSectionField",
        pages: [
          { _id: "a", uri: "/", count: 2 },
          { _id: "b", uri: "/about", count: 6 },
        ],
      },
    ],
  });

  assert.match(lines.join("\n"), /mediaSectionField\s+8 instances across 2 pages\s+⚠️ {2}in use/);
});

test("formatUsageReport says so plainly when a feature stores nothing", () => {
  assert.match(formatUsageReport(EMPTY).join("\n"), /none of these features stores content/);
});

test("formatPurgePlan reports documents nothing can delete, and what is holding them", () => {
  const plan = formatPurgePlan(
    {
      ...EMPTY,
      blocked: [{ _id: "a1", _type: "article", blockedBy: [{ _id: "p1", _type: "page", uri: "/about" }] }],
    },
    ["article"]
  ).join("\n");

  assert.match(plan, /1 document is held by a strong reference/);
  assert.match(plan, /article a1 ← page \/about/);
  assert.match(plan, /refuse the whole purge and delete nothing/);
});

test("formatPurgePlan states the types and the total including drafts", () => {
  const plan = formatPurgePlan(
    {
      ...EMPTY,
      documents: [
        { type: "person", published: 1, drafts: 0 },
        { type: "article", published: 12, drafts: 2 },
      ],
    },
    ["person", "article"]
  ).join("\n");

  assert.match(plan, /Types: person, article/);
  assert.match(plan, /15 documents including drafts, deleted in one transaction/);
});

test("formatPurgePlan lists every dangling weak reference rather than summarising them", () => {
  const plan = formatPurgePlan(
    {
      ...EMPTY,
      weakReferenceHolders: [
        { _id: "site", _type: "site" },
        { _id: "p1", _type: "page", uri: "/about" },
      ],
    },
    ["article"]
  ).join("\n");

  assert.match(plan, /2 documents hold a weak reference that will dangle/);
  assert.match(plan, /- site site/);
  assert.match(plan, /- page \/about/);
});

test("formatPurgePlan warns about orphaned section anchors and stale generated Markdown", () => {
  const plan = formatPurgePlan(
    {
      ...EMPTY,
      sectionAnchorHolders: [{ _id: "p1", _type: "page", uri: "/pricing" }],
      staleMarkdownHolders: [{ _id: "p2", _type: "page", uri: "/" }],
    },
    ["article"]
  ).join("\n");

  assert.match(plan, /1 link anchors to a section that is being removed:/);
  assert.match(plan, /falls back to the bare page URL/);
  assert.match(plan, /1 document carries generated Markdown that will describe deleted content/);
  assert.match(plan, /Regenerate from the Agents tab/);
});

test("formatPurgePlan says there is nothing to delete when no document type is involved", () => {
  assert.match(formatPurgePlan(EMPTY, []).join("\n"), /nothing to delete/);
});

test("isStranded is true only when a feature still has documents to delete", () => {
  const usage: Usage = {
    ...EMPTY,
    documents: [
      { type: "article", published: 3, drafts: 0 },
      { type: "contactFormSubmission", published: 0, drafts: 0 },
    ],
  };

  assert.equal(isStranded({ documentTypes: ["article"] }, usage), true);
  assert.equal(isStranded({ documentTypes: ["contactFormSubmission"] }, usage), false);
  assert.equal(isStranded({ documentTypes: ["notInThisReport"] }, usage), false);
  assert.equal(isStranded({}, usage), false);
});

test("isStranded counts drafts, so a never-published article still blocks a clean bill of health", () => {
  const usage: Usage = { ...EMPTY, documents: [{ type: "article", published: 0, drafts: 2 }] };

  assert.equal(isStranded({ documentTypes: ["article"] }, usage), true);
});

test("isStranded counts section instances, which live on pages rather than as documents", () => {
  const used: Usage = { ...EMPTY, sections: [{ type: "mediaSectionField", pages: [{ _id: "a", count: 2 }] }] };
  const unused: Usage = { ...EMPTY, sections: [{ type: "mediaSectionField", pages: [] }] };

  assert.equal(isStranded({ sectionTypes: ["mediaSectionField"] }, used), true);
  assert.equal(isStranded({ sectionTypes: ["mediaSectionField"] }, unused), false);
});

test("formatPurgePlan states what a section purge strips, and keeps the pages", () => {
  const plan = formatPurgePlan(
    {
      ...EMPTY,
      sections: [
        {
          type: "ctaSectionField",
          pages: [
            { _id: "home", uri: "/", count: 1 },
            { _id: "about", uri: "/about", count: 1 },
          ],
        },
      ],
    },
    []
  ).join("\n");

  assert.match(plan, /ctaSectionField: 2 section uses stripped from 2 pages; the pages stay/);
  assert.doesNotMatch(plan, /documents including drafts/);
});
