import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOpenApiDocument } from "./openapi";

type Operation = {
  operationId?: string;
  summary?: string;
  description?: string;
  responses?: Record<string, unknown>;
};

function allOperations(document: ReturnType<typeof buildOpenApiDocument>): Operation[] {
  return Object.values(document.paths).flatMap((pathItem) => Object.values(pathItem) as Operation[]);
}

test("declares OpenAPI 3.1 with a server on the given origin", () => {
  const document = buildOpenApiDocument({ baseUrl: "https://example.com/" });

  assert.equal(document.openapi, "3.1.0");
  assert.deepEqual(
    document.servers.map((server) => server.url),
    ["https://example.com"]
  );
});

test("titles the document with the CMS site name, with a neutral fallback", () => {
  const named = buildOpenApiDocument({ baseUrl: "https://example.com", siteName: "  Acme  " });
  const unnamed = buildOpenApiDocument({ baseUrl: "https://example.com" });

  assert.equal(named.info.title, "Acme public API");
  assert.equal(named.info.contact.name, "Acme");
  assert.equal(unnamed.info.title, "This site public API");
});

test("the CMS description leads the info description when present", () => {
  const withDescription = buildOpenApiDocument({ baseUrl: "https://example.com", description: "A portfolio." });
  const without = buildOpenApiDocument({ baseUrl: "https://example.com" });

  assert.match(withDescription.info.description, /^A portfolio\. Read-only and unauthenticated\./);
  assert.match(without.info.description, /^Read-only and unauthenticated\./);
});

test("every operation has a unique operationId, a description, and responses", () => {
  const document = buildOpenApiDocument({ baseUrl: "https://example.com" });
  const operations = allOperations(document);
  const ids = operations.map((operation) => operation.operationId);

  assert.ok(operations.length >= 5);
  assert.equal(new Set(ids).size, ids.length);

  for (const operation of operations) {
    assert.ok(operation.operationId, "operationId missing");
    assert.ok(operation.summary, `summary missing on ${operation.operationId}`);
    assert.ok(operation.description, `description missing on ${operation.operationId}`);
    assert.ok(
      operation.responses && Object.keys(operation.responses).length > 0,
      `responses missing on ${operation.operationId}`
    );
  }
});

test("every $ref resolves to a declared component schema", () => {
  const document = buildOpenApiDocument({ baseUrl: "https://example.com" });
  const refs = [...JSON.stringify(document).matchAll(/"\$ref":"([^"]+)"/g)].map((match) => match[1]);

  for (const ref of refs) {
    const name = ref?.replace("#/components/schemas/", "") ?? "";
    assert.ok(name in document.components.schemas, `unresolved $ref: ${ref}`);
  }
});

test("the error schema documents code and hint alongside the message", () => {
  const document = buildOpenApiDocument({ baseUrl: "https://example.com" });
  const errorSchema = document.components.schemas.ErrorResponse;

  assert.deepEqual(errorSchema.required, ["error", "code"]);
  assert.ok(errorSchema.properties.hint);
});
