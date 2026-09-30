import assert from "node:assert/strict";
import { test } from "node:test";
import type { Rule } from "sanity";
import { composeValidation, isEmptyObjectValue, requireTypeWhenObjectHasValue } from "./utils";

/** Captures the callback passed to `Rule.custom` so tests can invoke it directly. */
type ValidationContext = { parent?: unknown };

function captureCustom(builder: (rule: unknown) => unknown): (value: unknown, context?: ValidationContext) => true | string {
  let captured: ((value: unknown, context: ValidationContext) => true | string) | undefined;
  builder({
    custom(fn: (value: unknown, context: ValidationContext) => true | string) {
      captured = fn;
      return this;
    },
  });

  assert.ok(captured, "validation builder never called Rule.custom");
  const fn = captured;
  return (value, context = {}) => fn(value, context);
}

test("isEmptyObjectValue: true only for objects whose values are all nullish", () => {
  assert.equal(isEmptyObjectValue({}), true);
  assert.equal(isEmptyObjectValue({ type: null, image: undefined }), true);
  assert.equal(isEmptyObjectValue({ type: "image" }), false);
  assert.equal(isEmptyObjectValue(null), false);
  assert.equal(isEmptyObjectValue([1]), false);
  assert.equal(isEmptyObjectValue("x"), false);
});

test("requireTypeWhenObjectHasValue: the contract used by createMediaField/createLinkField", () => {
  const validate = captureCustom(requireTypeWhenObjectHasValue("Select a media type."));

  // No value or stale all-null object: valid (editors cleared the field).
  assert.equal(validate(undefined), true);
  assert.equal(validate({ type: null, image: null }), true);

  // Meaningful content without a type: invalid.
  assert.equal(validate({ type: undefined, image: "asset-ref" }), "Select a media type.");

  // Type present: valid.
  assert.equal(validate({ type: "image", image: "asset-ref" }), true);
});

test("requireTypeWhenObjectHasValue: a hidden field never blocks saving on initial-value residue", () => {
  // A hidden object holds non-null residue with no `type`, which `isEmptyObjectValue` alone does not catch.
  const residue = { canDownload: true, openInNewTab: false, paramsHref: "?modal=contact" };
  assert.equal(isEmptyObjectValue(residue), false);

  const hidden = ({ parent }: { parent: { [key: string]: unknown } }) => parent.type !== "agency";
  const validate = captureCustom(requireTypeWhenObjectHasValue("Select a link type.", hidden));

  assert.equal(validate(residue, { parent: { type: "freelance" } }), true);
  assert.equal(validate(residue, { parent: { type: "agency" } }), "Select a link type.");
  assert.equal(validate({ type: "external" }, { parent: { type: "agency" } }), true);
});

test("composeValidation: base alone passes through; external results are combined with base", () => {
  const rule = {} as Rule;
  const base = () => "base";
  const external = () => "external";

  assert.equal(composeValidation(base)(rule), "base");
  assert.deepEqual(composeValidation(base, external)(rule), ["external", "base"]);
  assert.deepEqual(composeValidation(base, () => ["e1", "e2"])(rule), ["e1", "e2", "base"]);
});
