// Agent content negotiation for `src/middleware.ts`: a request that prefers Markdown is rewritten to
// the stored Markdown, unless Basic Auth covers the page, so protected content is never served as text.

import type { APIContext } from "astro";
import { AGENT_MARKDOWN_INTERNAL_BASE_PATH, getAgentMarkdownState } from "~/features/agents/markdown-proxy-state";
import { prefersMarkdown } from "~/features/agents/prefers-markdown";
import { FEED_PATH } from "~/features/feed/constants";
import { normalizePathname } from "~/features/utils/pathname";

/** The rewritten response, or null to fall through to the HTML and Basic Auth flow. */
export async function rewriteToAgentMarkdown(context: APIContext, pathname: string): Promise<Response | null> {
  if (context.request.method !== "GET" || pathname === FEED_PATH || !prefersMarkdown(context.request.headers.get("accept"))) {
    return null;
  }

  try {
    const { siteWideBasicAuth, excludedPathSet } = await getAgentMarkdownState();

    if (!siteWideBasicAuth && !excludedPathSet.has(normalizePathname(pathname))) {
      return context.rewrite(`${AGENT_MARKDOWN_INTERNAL_BASE_PATH}${pathname === "/" ? "" : pathname}`);
    }
  } catch (error) {
    console.error("middleware: agent markdown state fetch failed", error);
  }

  return null;
}
