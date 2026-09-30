import assert from "node:assert/strict";
import { test } from "node:test";
import { insertDeveloperResourcesSection, renderDeveloperResourcesSection } from "./llms-txt-resources";

const BASE = "https://example.com";

test("renders the machine endpoints with exact URLs on the given origin", () => {
  const section = renderDeveloperResourcesSection(`${BASE}/`);

  assert.match(section, /^## Developer resources/);
  assert.match(section, /\(https:\/\/example\.com\/openapi\.json\)/);
  assert.match(section, /\(https:\/\/example\.com\/sitemap\.xml\)/);
  assert.match(section, /\(https:\/\/example\.com\/feed\.xml\)/);
  assert.match(section, /\(https:\/\/example\.com\/robots\.txt\)/);
});

test("appends at the end when there is no Optional section", () => {
  const result = insertDeveloperResourcesSection("# Site\n\n## Pages\n\n- [A](https://example.com/a)", BASE);

  assert.match(result, /## Pages[\s\S]*## Developer resources/);
  assert.match(result, /robots\.txt\).*\n$/);
});

test("inserts before Optional so that section stays last", () => {
  const result = insertDeveloperResourcesSection(
    "# Site\n\n## Pages\n\n- [A](https://example.com/a)\n\n## Optional\n\n- [B](https://example.com/b)",
    BASE
  );

  const resources = result.indexOf("## Developer resources");
  const optional = result.indexOf("## Optional");

  assert.ok(resources !== -1 && optional !== -1);
  assert.ok(resources < optional);
  assert.match(result, /- \[B\]\(https:\/\/example\.com\/b\)\n$/);
});

test("a section the model emitted anyway is replaced by the code-owned copy", () => {
  const result = insertDeveloperResourcesSection(
    "# Site\n\n## Developer resources\n\n- [Bad](https://wrong.example/openapi.json)\n\n## Optional\n\n- [B](https://example.com/b)",
    BASE
  );

  assert.equal(result.match(/## Developer resources/g)?.length, 1);
  assert.doesNotMatch(result, /wrong\.example/);
  assert.match(result, /https:\/\/example\.com\/openapi\.json/);
});
