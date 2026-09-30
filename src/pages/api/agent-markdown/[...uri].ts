import type { APIRoute } from "astro";
import { renderNotFoundMarkdown } from "~/features/agents/not-found-markdown";
import { AgentMarkdownServeQuery } from "~/features/agents/query";
import { normalizePathname } from "~/features/utils/pathname";
import { CACHE_TTL } from "~/lib/cache";
import { CONTENT_VERSION_PARAM, contentVersion } from "~/lib/content-version";
import { PUBLIC_SITE_URL } from "~/lib/env";
import type { AgentMarkdownServeQueryResult } from "~/sanity/types";
import { sanityClient } from "../../../sanity/lib/client";

// Serves the stored `agentMarkdown.content` for a routed document; the middleware rewrites eligible
// `Accept: text/markdown` requests here.
export const prerender = false;

// Published perspective, stega off: agents get the clean, published Markdown body.
const serveClient = sanityClient.withConfig({ perspective: "published", stega: false });

export const GET: APIRoute = async ({ params, cache }) => {
  const uri = normalizePathname(`/${params.uri ?? ""}`);

  // The Markdown body belongs to the routed document, so its publish (uri tag) busts this entry.
  cache.set({ ...CACHE_TTL, tags: [uri] });

  const data = await serveClient.fetch<AgentMarkdownServeQueryResult>(AgentMarkdownServeQuery, {
    uri,
    [CONTENT_VERSION_PARAM]: await contentVersion.read(),
  });

  const isEnabled = data?.enabled !== false;
  const content = typeof data?.content === "string" ? data.content.trim() : "";

  // Markdown recovery map rather than a bare error, so an agent that lands here can re-orient.
  if (!isEnabled || !content) {
    return new Response(renderNotFoundMarkdown(PUBLIC_SITE_URL), {
      status: 404,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
        vary: "Accept",
      },
    });
  }

  return new Response(`${content}\n`, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      vary: "Accept",
    },
  });
};
