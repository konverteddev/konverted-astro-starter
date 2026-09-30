import assert from "node:assert/strict";
import { test } from "node:test";
import { apiErrorResponse } from "./errors";

test("returns the status with a JSON body of error, code, and hint", async () => {
  const response = apiErrorResponse(400, { error: "Bad input.", code: "bad_input", hint: "Fix it." });

  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Bad input.", code: "bad_input", hint: "Fix it." });
});

test("hint stays optional", async () => {
  const response = apiErrorResponse(500, { error: "Boom.", code: "internal_error" });

  assert.deepEqual(await response.json(), { error: "Boom.", code: "internal_error" });
});
