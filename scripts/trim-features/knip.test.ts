import assert from "node:assert/strict";
import { test } from "node:test";
import { diffKnipReports, formatKnipReport, isEmptyReport, parseKnipReport } from "./knip";

const REPORT = JSON.stringify({
  issues: [
    { files: [{ name: "components/chip.tsx" }], dependencies: [], devDependencies: [] },
    { files: [{ name: "features/blog/format-date.ts" }], dependencies: [{ name: "resend", line: 1, col: 1 }] },
    { files: [], devDependencies: [{ name: "lint-staged", line: 2, col: 1 }] },
  ],
});

test("parseKnipReport reads unused files and packages out of the issue list", () => {
  assert.deepEqual(parseKnipReport(REPORT), {
    files: ["components/chip.tsx", "features/blog/format-date.ts"],
    dependencies: ["resend"],
    devDependencies: ["lint-staged"],
  });
});

test("parseKnipReport answers an empty report rather than throwing on an unexpected payload", () => {
  const empty = { files: [], dependencies: [], devDependencies: [] };

  assert.deepEqual(parseKnipReport("not json"), empty);
  assert.deepEqual(parseKnipReport("{}"), empty);
  assert.ok(isEmptyReport(parseKnipReport("{}")));
});

test("diffKnipReports keeps only what became unused, not the superset knip always sees", () => {
  const before = { files: ["components/chip.tsx"], dependencies: [], devDependencies: ["lint-staged"] };
  const after = {
    files: ["components/chip.tsx", "features/blog/format-date.ts"],
    dependencies: ["resend"],
    devDependencies: ["lint-staged"],
  };

  assert.deepEqual(diffKnipReports(before, after), {
    files: ["features/blog/format-date.ts"],
    dependencies: ["resend"],
    devDependencies: [],
  });
});

test("diffKnipReports is empty when the trim orphaned nothing new", () => {
  const same = { files: ["a.ts"], dependencies: ["b"], devDependencies: [] };

  assert.ok(isEmptyReport(diffKnipReports(same, same)));
});

test("formatKnipReport says so plainly when the trim orphaned nothing", () => {
  assert.match(
    formatKnipReport({ files: [], dependencies: [], devDependencies: [] }).join("\n"),
    /nothing that the trim newly orphaned/
  );
});

test("formatKnipReport lists files and packages under their own headings", () => {
  const lines = formatKnipReport({ files: ["a.ts"], dependencies: ["resend"], devDependencies: ["knip"] }).join("\n");

  assert.match(lines, /Files \(1\):\n {6}- a\.ts/);
  assert.match(lines, /Packages \(2\):\n {6}- resend\n {6}- knip/);
});
