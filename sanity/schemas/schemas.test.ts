import assert from "node:assert/strict";
import { before, test } from "node:test";

// Media fields pull in Studio inputs that read the API version from `sanity/config.ts`, which requires
// its env on import. Placeholders only where the environment has no value; imported once they are set.
const PLACEHOLDER_ENV: Record<string, string> = {
  SANITY_STUDIO_PROJECT_ID: "test-project",
  SANITY_STUDIO_DATASET: "test",
  SANITY_STUDIO_SITE_URL: "https://example.com",
  SANITY_STUDIO_API_VERSION: "2099-01-31",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "test-project",
  NEXT_PUBLIC_SANITY_DATASET: "test",
  NEXT_PUBLIC_SANITY_API_VERSION: "2099-01-31",
  NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH: "/studio",
};

for (const [name, value] of Object.entries(PLACEHOLDER_ENV)) {
  process.env[name] ??= value;
}

let redirect: typeof import("./documents/redirect").redirect;
let mediaPreviewSelect: typeof import("./fields/create-media").mediaPreviewSelect;

before(async () => {
  ({ redirect } = await import("./documents/redirect"));
  ({ mediaPreviewSelect } = await import("./fields/create-media"));
});

type CustomValidator = (value: unknown, context: { parent?: unknown }) => true | string;

/** Captures the callback a field's `validation` passes to `Rule.custom`, mocking the rule chain. */
function captureFieldValidator(fieldName: string): CustomValidator {
  const field = (redirect.fields as Array<{ name: string; validation?: unknown }>).find((f) => f.name === fieldName);
  assert.ok(field?.validation, `field ${fieldName} has no validation`);

  let captured: CustomValidator | undefined;
  const rule = {
    required() {
      return this;
    },
    custom(fn: CustomValidator) {
      captured = fn;
      return this;
    },
  };

  (field.validation as (rule: unknown) => unknown)(rule);
  assert.ok(captured, `field ${fieldName} never called Rule.custom`);
  return captured;
}

test("redirect: from/to require a leading slash and reject matching paths", () => {
  for (const [fieldName, otherField] of [
    ["from", "to"],
    ["to", "from"],
  ] as const) {
    const validate = captureFieldValidator(fieldName);

    assert.equal(validate(undefined, {}), true, `${fieldName}: empty is left to required()`);
    assert.equal(validate("about", {}), 'Path must start with a "/" (e.g., "/about").');
    assert.equal(validate("/same", { parent: { [otherField]: "/same" } }), 'The "From" and "To" paths cannot be the same.');
    assert.equal(validate("/old-page", { parent: { [otherField]: "/new-page" } }), true);
  }
});

test("mediaPreviewSelect: bare and prefixed select maps", () => {
  assert.deepEqual(mediaPreviewSelect(), {
    type: "type",
    image: "image",
    playbackId: "video.asset.playbackId",
    thumbTime: "video.asset.thumbTime",
    videoCoverUrl: "videoCover.asset.url",
  });

  assert.deepEqual(mediaPreviewSelect("appMedia"), {
    type: "appMedia.type",
    image: "appMedia.image",
    playbackId: "appMedia.video.asset.playbackId",
    thumbTime: "appMedia.video.asset.thumbTime",
    videoCoverUrl: "appMedia.videoCover.asset.url",
  });
});
