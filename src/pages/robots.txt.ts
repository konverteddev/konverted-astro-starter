import type { APIRoute } from "astro";
import { renderRobotsTxt } from "~/features/agents/ai-crawlers";
import { absoluteUrl, PUBLIC_SANITY_STUDIO_BASE_PATH } from "~/lib/env";

export const GET: APIRoute = ({ cache }) => {
  // Depends only on env, so no tags; a day of freshness is plenty.
  cache.set({ maxAge: 86400 });

  // No trailing slash: `Disallow` is a prefix match, and `/studio/` would miss the bare route.
  const studioPath = PUBLIC_SANITY_STUDIO_BASE_PATH.replace(/\/$/, "");

  const body = renderRobotsTxt({
    disallow: ["/api/", studioPath],
    sitemap: absoluteUrl("/sitemap.xml"),
  });

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
