import type { APIRoute } from "astro";
import { type AgentMarkdownPage, pageToMarkdown } from "~/features/agents/markdown";
import { AgentMarkdownContentQuery } from "~/features/agents/query";
import { authorizeStudioRequest } from "~/features/api/auth";
import { PUBLIC_SITE_URL } from "~/lib/env";
import type { AgentMarkdownContentQueryResult } from "~/sanity/types";
import { sanityEditClient } from "../../../sanity/lib/client";

// Studio-triggered per-page agent Markdown generation.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = await authorizeStudioRequest(request);

  if (denied) {
    return denied;
  }

  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const uri = typeof body?.uri === "string" ? body.uri.trim() : "";

    if (!uri) {
      return Response.json({ error: "Missing page URL. Save this page's URL, then try again." }, { status: 400 });
    }

    // No eligibility gate: generation is allowed even when serving is off or the page is noindex.
    const page = await sanityEditClient
      .withConfig({ perspective: "drafts" })
      .fetch<AgentMarkdownContentQueryResult>(AgentMarkdownContentQuery, { uri });

    if (!page) {
      return Response.json({ error: "No page found at this URL." }, { status: 404 });
    }

    const baseUrl = PUBLIC_SITE_URL;
    const text = pageToMarkdown(page as AgentMarkdownPage, baseUrl).trim();

    if (!text) {
      return Response.json({ error: "This page has no content to serialize yet." }, { status: 422 });
    }

    return Response.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
};
