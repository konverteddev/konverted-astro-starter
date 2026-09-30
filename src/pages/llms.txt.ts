import type { APIRoute } from "astro";
import { LlmsTxtServeQuery } from "~/features/agents/query";
import { CACHE_TTL, SITE_WIDE_CACHE_TAGS } from "~/lib/cache";
import type { LlmsTxtServeQueryResult } from "~/sanity/types";
import { loadQuery } from "../sanity/lib/load-query";

// Serves the published llms.txt content managed in the Settings singleton (generated in the Studio).
export const GET: APIRoute = async ({ cache }) => {
  // The content lives on Settings; its publish invalidates the 'siteSettings' tag.
  cache.set({ ...CACHE_TTL, tags: [...SITE_WIDE_CACHE_TAGS] });

  const { data } = await loadQuery<LlmsTxtServeQueryResult>({ query: LlmsTxtServeQuery });

  if (data?.enabled === false || !data?.content) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(data.content, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
