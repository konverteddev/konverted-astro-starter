import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSummaryRows } from "./cli";

test("formatSummaryRows aligns the value column across labels of different widths", () => {
  assert.deepEqual(
    formatSummaryRows([
      { label: "Dataset", value: "production" },
      { label: "Project ID", value: "abc123" },
    ]),
    ["   • Dataset:    production", "   • Project ID: abc123"]
  );
});

test("formatSummaryRows renders a label-less row as a plain bullet", () => {
  assert.deepEqual(formatSummaryRows([{ value: "New project in org acme" }, { label: "Dataset", value: "production" }]), [
    "   • New project in org acme",
    "   • Dataset: production",
  ]);
});

test("formatSummaryRows handles an empty summary", () => {
  assert.deepEqual(formatSummaryRows([]), []);
});
