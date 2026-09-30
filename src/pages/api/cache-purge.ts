import type { APIRoute } from "astro";
import { timingSafeEqual } from "~/features/auth/basic-auth";
import { contentVersion } from "~/lib/content-version";
import { SANITY_REVALIDATE_SECRET } from "~/lib/env";
import { ROUTE_CACHE_ALL_TAG } from "~/lib/route-cache/create-provider";

// Escape hatch: empties the whole route cache in the instance that receives the request.
// Reuses SANITY_REVALIDATE_SECRET as a Bearer token: both endpoints bust cache, so it grants nothing new.
export const prerender = false;

export const POST: APIRoute = async ({ request, cache }) => {
  if (!SANITY_REVALIDATE_SECRET) {
    return Response.json({ ok: false, error: "SANITY_REVALIDATE_SECRET is not set." }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!timingSafeEqual(provided, SANITY_REVALIDATE_SECRET)) {
    return Response.json({ ok: false, error: "Invalid secret" }, { status: 401 });
  }

  // A suspect cache is re-rendered from origin, not from whatever the CDN holds under the old version.
  await contentVersion.bump();
  await cache.invalidate({ tags: [ROUTE_CACHE_ALL_TAG] });

  return Response.json({ ok: true, purged: "all" });
};
