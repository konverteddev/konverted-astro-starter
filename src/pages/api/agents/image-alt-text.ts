import type { APIRoute } from "astro";
import { buildDescriptionSourceUrl, generateAltText, isDescribableAsset } from "~/features/agents/alt-text";
import { AltTextAssetQuery, AltTextBacklogQuery, AltTextSettingsQuery, AltTextStatsQuery } from "~/features/agents/query";
import { authorizeStudioRequest } from "~/features/api/auth";
import type {
  AltTextAssetQueryResult,
  AltTextBacklogQueryResult,
  AltTextSettingsQueryResult,
  AltTextStatsQueryResult,
} from "~/sanity/types";
import { sanityEditClient } from "../../../sanity/lib/client";

// Studio-triggered alt text generation.
export const prerender = false;

/** Each description is a round trip, so the batch must finish inside the function's time budget; the panel loops. */
const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 8;

type AltTextResult = {
  _id: string;
  status: "described" | "skipped" | "failed";
  altText?: string;
  reason?: string;
};

/** Describe one asset and write the result to `sanity.imageAsset.altText`. Never throws. */
async function describeAsset(assetId: string, guidance: string, force: boolean): Promise<AltTextResult> {
  const asset = await sanityEditClient.fetch<AltTextAssetQueryResult>(AltTextAssetQuery, { assetId });

  if (!asset?.url) {
    return { _id: assetId, status: "skipped", reason: "Asset not found." };
  }

  // Re-checked here: two Studio tabs can observe one upload, and an editor's own correction must survive.
  if (asset.altText && !force) {
    return { _id: assetId, status: "skipped", reason: "Already has alt text." };
  }

  if (!isDescribableAsset(asset)) {
    return { _id: assetId, status: "skipped", reason: `Cannot describe a ${asset.extension ?? "non-raster"} asset.` };
  }

  try {
    const altText = await generateAltText(sanityEditClient, {
      imageUrl: buildDescriptionSourceUrl(asset.url),
      filename: asset.filename ?? undefined,
      guidance,
    });

    if (!altText) {
      return { _id: assetId, status: "failed", reason: "Sanity AI returned an empty description." };
    }

    await sanityEditClient.patch(assetId).set({ altText }).commit();

    return { _id: assetId, status: "described", altText };
  } catch (error) {
    return { _id: assetId, status: "failed", reason: error instanceof Error ? error.message : "Generation failed." };
  }
}

async function readSettings() {
  const settings = await sanityEditClient.fetch<AltTextSettingsQueryResult>(AltTextSettingsQuery);

  return {
    enabled: settings?.enabled === true,
    guidance: settings?.guidance?.trim() ?? "",
  };
}

function clampBatchSize(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(Math.max(Math.floor(value), 1), MAX_BATCH_SIZE);
}

/** Counts for the Studio backfill panel. */
export const GET: APIRoute = async ({ request }) => {
  const denied = await authorizeStudioRequest(request);

  if (denied) {
    return denied;
  }

  try {
    const stats = await sanityEditClient.fetch<AltTextStatsQueryResult>(AltTextStatsQuery);

    return Response.json({
      total: stats?.total ?? 0,
      missing: stats?.missing ?? 0,
      enabled: stats?.enabled === true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read alt text stats.";
    return Response.json({ error: message }, { status: 500 });
  }
};

/** Two callers: the Studio upload listener posts `{ _id }` and is toggle-gated; `{ backfill: true }` loops a batch and is always allowed. */
export const POST: APIRoute = async ({ request }) => {
  const denied = await authorizeStudioRequest(request);

  if (denied) {
    return denied;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { enabled, guidance } = await readSettings();
    const force = body.force === true;

    if (body.backfill === true) {
      const backlog = await sanityEditClient.fetch<AltTextBacklogQueryResult>(AltTextBacklogQuery, { force });
      const describable = backlog.filter((asset) => isDescribableAsset(asset));
      const batch = describable.slice(0, clampBatchSize(body.limit));

      const results: AltTextResult[] = [];

      // Sequential: Agent Actions are metered, and a partial batch reporting honestly beats a burst failing halfway.
      for (const asset of batch) {
        results.push(await describeAsset(asset._id, guidance, force));
      }

      const described = results.filter((result) => result.status === "described").length;

      return Response.json({
        results,
        described,
        remaining: Math.max(describable.length - described, 0),
      });
    }

    const assetId = typeof body._id === "string" ? body._id : undefined;

    if (!assetId) {
      return Response.json({ error: "Expected an asset `_id`, or `backfill: true`." }, { status: 400 });
    }

    if (!enabled && !force) {
      return Response.json({ _id: assetId, status: "skipped", reason: "Automatic alt text is off." });
    }

    return Response.json(await describeAsset(assetId, guidance, force));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alt text generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
};
