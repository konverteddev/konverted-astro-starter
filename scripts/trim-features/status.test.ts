import assert from "node:assert/strict";
import { test } from "node:test";
import { findFeature } from "./features";
import { describeUsage, type FeatureRow, hasStranded, needsRecording, orderDatasets } from "./status";

function row(id: string, overrides: Partial<FeatureRow> = {}): FeatureRow {
  const feature = findFeature(id);

  assert.ok(feature);

  return { feature, status: "present", unresolved: [], importers: [], content: [], ...overrides };
}

test("orderDatasets puts production first and keeps the rest in listed order", () => {
  assert.deepEqual(orderDatasets(["development", "staging", "production"]), ["production", "development", "staging"]);
  assert.deepEqual(orderDatasets(["development"]), ["development"]);
  assert.deepEqual(orderDatasets([]), []);
});

test("describeUsage counts documents and section uses in every dataset, singular when one", () => {
  const blog = row("blog", {
    content: [
      { dataset: "production", count: 1 },
      { dataset: "development", count: 12 },
    ],
  });
  const media = row("section:media", { content: [{ dataset: "production", count: 3 }] });

  assert.equal(describeUsage(blog), "1 document in production · 12 documents in development");
  assert.equal(describeUsage(media), "3 uses in production");
});

test("describeUsage says a code-only feature holds no content, and names importers and drift", () => {
  const forms = row("forms", {
    content: [{ dataset: "production", count: 0 }],
    importers: [{ file: "src/pages/contact.astro", target: "src/features/forms" }],
  });

  assert.equal(describeUsage(forms), "code only · imported by 1 file outside it");
});

test("needsRecording asks only in a project, and only when something is unsettled", () => {
  const settled = {
    role: "project" as const,
    record: { starter: { repository: "x", cutFrom: "2026-09-01" }, features: {}, sections: [], documentTypes: [] },
    rows: [row("blog")],
    unaccountedSections: [],
    unaccountedTypes: [],
  };

  assert.equal(needsRecording(settled), false);
  assert.equal(needsRecording({ ...settled, record: { ...settled.record, starter: { repository: "x", cutFrom: null } } }), true);
  assert.equal(needsRecording({ ...settled, rows: [row("blog", { status: "absent" })] }), true);
  assert.equal(needsRecording({ ...settled, unaccountedSections: ["FaqSection"] }), true);
  assert.equal(needsRecording({ ...settled, role: "starter", unaccountedSections: ["FaqSection"] }), false);
});

test("hasStranded is true for documents or section uses in any dataset", () => {
  assert.equal(hasStranded([]), false);
  assert.equal(hasStranded([{ dataset: "production", documents: [], sections: [] }]), false);
  assert.equal(hasStranded([{ dataset: "production", documents: [], sections: [{ type: "mediaSectionField", uses: 3 }] }]), true);
});
