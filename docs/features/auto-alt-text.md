# Automatic alt text

Images uploaded to the media library are described by Sanity AI (Agent Actions) and the result is
stored as the asset's **alternative text**. Because alt text lives on the asset rather than on each
image field, one description covers every document that uses that image, and the image fragments
already read it (`asset->altText`).

- **Turn it on:** Studio, **Settings** singleton, **Agents** tab, **Automatic alt text**.
- **Trigger:** a listener in the Studio itself, not a webhook. Nothing to configure outside this repo.
- **Backfill:** the button in that same panel, or `POST /api/agents/image-alt-text`.
- **Edit by hand:** the media browser. Editors always win; nothing overwrites existing alt text.

## End-to-end flow

```
Upload in the media browser
            │
            ▼
  sanity.imageAsset created
            │  Studio listener: *[_type == "sanity.imageAsset" && !defined(altText)]
            │  (transition "appear", queued one at a time)
            ▼
┌──────────────────────────────────────────────────────────────┐
│ POST /api/agents/image-alt-text   { _id }                    │
│  1. read the Settings toggle (off -> 200, skipped)           │
│  2. re-check the asset still has no altText                  │
│  3. agent.action.transform(image-description, noWrite)       │
│  4. patch sanity.imageAsset.altText                          │
└──────────────────────────────────────────────────────────────┘
            │
            ▼
  asset->altText  ──────────▶  every document rendering that image
```

Patching `altText` in step 4 drops the asset out of the listener's query, so the write cannot
re-trigger the listener. Step 2 repeats the check anyway, because two Studio tabs can both observe one
upload, and because an editor may have typed alt text in the meantime.

## Why the trigger lives in the Studio, not a webhook

Uploads are pinned to the media browser (`assetSources: () => [mediaAssetSource]` and
`directUploads: false` in `sanity.config.ts`), so an image cannot enter the dataset without a Studio
being open. That removes the usual reason to reach for a webhook, and keeping the trigger in
`sanity/auto-alt-text.tsx` buys back a lot:

- No dashboard step, and no config living outside the repository.
- No shared secret: a Studio call carries the editor's Sanity session, which `authorizeStudioRequest` verifies with Sanity (see [Studio API auth](./studio-api-auth.md)).
- It is versioned, reviewed, and deployed with everything else.

The cost is that it only covers uploads made through a Studio. Assets that arrive some other way (a
dataset import, `sanity dataset import`, a script) are the backfill panel's job. If you ever add such a
path and want it automatic too, a Sanity GROQ-powered webhook on
`_type == "sanity.imageAsset" && !defined(altText)` posting `{_id}` to this endpoint covers it, once the
route accepts a shared secret for it (a webhook cannot carry a Studio session; see
[Studio API auth](./studio-api-auth.md) and the webhook notes below).

The listener queues descriptions one at a time, so dropping ten images into the media browser does not
fire ten concurrent Agent Actions. It does not read the toggle itself: the route is the single
authority on whether to spend credits, so a stale Studio tab cannot act on a setting that has since
been switched off.

## Why a scratch document

Describing an image is `operation: { type: "image-description" }`, which is a **Transform target**
operation. Transform is schema-aware: it needs a `schemaId` and a source document whose type is in the
deployed schema. Alt text lives on `sanity.imageAsset`, a system type that is not in the workspace
schema, so the agent cannot write there directly.

So `src/features/agents/alt-text.ts` runs Transform against `imageAltText`, a one-field document type that
exists only to give the description a typed place to land
(`sanity/schemas/documents/image-alt-text.tsx`). It runs with `noWrite: true`, so nothing is stored in
it. The description comes back on the response and the route patches the asset itself.

`imageAltText` is registered in `AGENT_SCRATCH_DOCUMENTS` (`sanity/constants.ts`), which removes its
"create new" template, restricts its document actions, and keeps it out of the structure, so editors
never see it.

## Setup

Two steps, both in this repository. There is no dashboard configuration.

### 1. Deploy the schema

Agent Actions resolve field types against the **deployed** schema, not the local one.
`npm run sanity:typegen` only extracts locally, so deploy after any schema change or the agent works
from a stale copy:

```sh
npm run sanity:schema-deploy
```

The resulting schema id is `_.schemas.default` (this workspace is the unnamed default), which is what
`SANITY_AGENT_SCHEMA_ID` in `sanity/constants.ts` points at.

### 2. Turn the toggle on

**Settings -> Agents -> Automatic alt text -> Describe new uploads**, then publish. It is **off by
default**, because each description spends AI credits with nobody watching.

That is the whole setup. Upload an image in the media browser and it gains alt text within a few
seconds, with a toast showing what was written.

## Fields

| Field | Type | Purpose |
| --- | --- | --- |
| **Describe new uploads** (`enabled`) | boolean | Gates the automatic path. Off by default. The backfill button ignores it, since that is an explicit action. |
| **Description guidance** (`guidance`) | text | Optional steer: vocabulary to prefer, how much detail, what to leave out. Overrides the built-in style rules and is reused on every run. |

## What the AI is told

`ALT_TEXT_INSTRUCTION` in `src/features/agents/alt-text.ts` is the whole spec. In short: one line,
sentence case, no trailing period, 5 to 15 words, capped at 125 characters, lead with the subject,
quote legible text that carries the meaning, say what an interface is and what state it is in, and
leave out colour, lighting, mood, composition, and any adjective that adds no information. It never
opens with "Image of" or "This image shows".

The original file name is passed as a weak hint (disambiguation only, never quoted, never trusted over
the image). Editor guidance is passed as a parameter that overrides the stylistic rules.

`normalizeAltText` is the safety net, not the mechanism: it takes the first non-empty line, strips
wrapping quote pairs and any medium-restating opener that slipped through, drops the trailing period,
and truncates at a word boundary. A screen reader announces alt text in one breath, so a paragraph
pasted into that field is worse than a short sentence.

Two things keep the cost down: the source image is requested through the image pipeline at
`?w=1024&fit=max&fm=jpg&q=80`, so a full-size original does not travel at full weight, and SVGs are
excluded entirely (the pipeline serves them verbatim, so the model would receive markup rather than an
image).

## Backfill

The panel under the toggle shows how many images have no alt text and describes them in batches,
looping until the backlog is empty. It is batched because each image is a round trip to the vision
model and one request would outlive the function's time budget. The run is interruptible with **Stop**, and
a failed batch stops the loop rather than retrying.

Straight from the API, for a bulk run or from a script:

```sh
# describe a batch (default 3, max 8); repeat while `remaining` > 0
curl -s -X POST https://<your-domain>/api/agents/image-alt-text \
  -H "content-type: application/json" \
  -H "authorization: Bearer $SANITY_USER_TOKEN" \
  -d '{"backfill": true, "limit": 5}'

# counts only
curl -s https://<your-domain>/api/agents/image-alt-text \
  -H "authorization: Bearer $SANITY_USER_TOKEN"
```

`SANITY_USER_TOKEN` is your own Sanity login (`npx sanity debug --secrets` prints it after
`npx sanity login`). The route accepts only a person with publish access to this project; an anonymous
call, a forged `Origin`, or an API (robot) token is refused. See [Studio API auth](./studio-api-auth.md).

`{"force": true}` re-describes assets that already have alt text. It overwrites editor-written
descriptions, so it is opt-in and has no button.

## Manual verification

1. **Backfill:** open **Settings -> Agents**, confirm the panel reports the number of images without alt
   text, click **Backfill**, then check those assets in the media browser.
2. **Upload:** with the toggle on, drop an image into the media browser and confirm a toast appears
   with the description within a few seconds, and that the asset now carries it.
3. **Toggle off:** publish with the toggle off, upload again, and confirm no alt text appears (the
   route responds `200 {"status":"skipped"}`).
4. **No overwrite:** run the backfill twice; the second run reports nothing to backfill.

## Implementation reference

| Concern | Location |
| --- | --- |
| CMS fields (Agents tab) | `sanity/schemas/documents/site.tsx`: `altText` object (`enabled`, `guidance`) |
| Upload listener (Studio plugin) | `sanity/auto-alt-text.tsx`, registered in `sanity.config.ts` |
| Backfill panel (Studio input) | `sanity/inputs/alt-text-input.tsx` |
| Scratch document type | `sanity/schemas/documents/image-alt-text.tsx` |
| Instruction, normalizer, agent call | `src/features/agents/alt-text.ts` |
| Tests for the pure helpers | `src/features/agents/alt-text.test.ts` (`npm test`) |
| GROQ queries | `src/features/agents/query.ts`: `AltTextSettingsQuery`, `AltTextAssetQuery`, `AltTextBacklogQuery`, `AltTextStatsQuery` |
| Route (trigger + backfill) | `src/pages/api/agents/image-alt-text.ts` |
| Endpoint path (config seam) | `sanity/config.ts`, `endpoints.imageAltText` |
| Agent API version and schema id | `sanity/constants.ts`: `SANITY_AGENT_API_VERSION`, `SANITY_AGENT_SCHEMA_ID` |
| Auth | `src/features/api/auth.ts`: `authorizeStudioRequest` (see [Studio API auth](./studio-api-auth.md)) |
| Token | `SANITY_API_EDIT_TOKEN` via `src/lib/env.ts` (reused; no new var) |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Schema not found` or unknown type `imageAltText` | The deployed schema predates the type. Run `npm run sanity:schema-deploy`. |
| Uploads are never described | The toggle is off or unpublished, or the upload did not come from a Studio (an import or a script). Use Backfill. |
| Backfill button says "Nothing to backfill" but images look bare | Those assets already have alt text, or they are SVGs, which are excluded. |
| Every description fails | Agent Actions are not enabled for the project, or AI credits are exhausted. |
| A description is wrong or too wordy | Rewrite it in the media browser (it will not be overwritten), and add a **Description guidance** note so future runs behave. |
