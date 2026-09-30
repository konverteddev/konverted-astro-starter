import type { APIRoute } from "astro";
import { buildOpenApiDocument } from "~/features/api/openapi";
import { SiteQuery } from "~/features/site/query";
import { CACHE_TTL, SITE_WIDE_CACHE_TAGS } from "~/lib/cache";
import { PUBLIC_SITE_URL } from "~/lib/env";
import type { SiteQueryResult } from "~/sanity/types";
import { loadQuery } from "../sanity/lib/load-query";

/** Serves the OpenAPI description of the public machine surface; name and description come from the Site singleton. */
export const GET: APIRoute = async ({ cache }) => {
  cache.set({ ...CACHE_TTL, tags: [...SITE_WIDE_CACHE_TAGS] });

  const { data: site } = await loadQuery<SiteQueryResult>({ query: SiteQuery });

  const document = buildOpenApiDocument({
    baseUrl: PUBLIC_SITE_URL,
    siteName: site?.name ?? undefined,
    description: site?.seoMetadata?.description ?? undefined,
  });

  return Response.json(document);
};
