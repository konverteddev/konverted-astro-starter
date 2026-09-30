import { assertValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";
import type { APIRoute } from "astro";
import { docCacheTags } from "~/lib/cache";
import { contentVersion } from "~/lib/content-version";
import { SANITY_REVALIDATE_SECRET } from "~/lib/env";

// Sanity publish webhook to cache invalidation, projection `{_id, _type, "uri": uri.current}`.
// A document busts its own routes and its `_type` tag; publishing `site` busts every page.
export const prerender = false;

type WebhookBody = {
  _id?: string;
  _type?: string;
  uri?: string | null;
};

export const POST: APIRoute = async ({ request, cache }) => {
  if (!SANITY_REVALIDATE_SECRET) {
    return Response.json({ ok: false, error: "SANITY_REVALIDATE_SECRET is not set." }, { status: 500 });
  }

  const signature = request.headers.get(SIGNATURE_HEADER_NAME);
  const body = await request.text();

  try {
    await assertValidSignature(body, signature ?? "", SANITY_REVALIDATE_SECRET);
  } catch {
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload: WebhookBody;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload._id || !payload._type) {
    return Response.json({ ok: false, error: "Webhook projection must include _id and _type" }, { status: 400 });
  }

  const tags = docCacheTags({ _id: payload._id, _type: payload._type, uri: payload.uri });

  // Bump first, or a render between the two stores a CDN-stale page no later publish would expire.
  await contentVersion.bump();
  await cache.invalidate({ tags });

  return Response.json({ ok: true, invalidated: tags });
};
