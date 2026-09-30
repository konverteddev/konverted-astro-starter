import type { APIRoute } from "astro";
import { capitalCase } from "change-case";
import { insertDeveloperResourcesSection } from "~/features/agents/llms-txt-resources";
import { LlmsTxtInventoryQuery } from "~/features/agents/query";
import { authorizeStudioRequest } from "~/features/api/auth";
import { absoluteUrl, PUBLIC_SITE_URL } from "~/lib/env";
import type { LlmsTxtInventoryQueryResult } from "~/sanity/types";
import { sanityEditClient } from "../../../sanity/lib/client";

// Studio-triggered llms.txt generation.
export const prerender = false;

// Agent Actions are only available on the experimental "vX" API version.
const AGENT_API_VERSION = "vX";

const LLMS_TXT_INSTRUCTION = `You are writing a /llms.txt file for a website, following the official specification by Jeremy Howard at https://llmstxt.org.

WHAT IT IS
/llms.txt is a concise, curated, Markdown map of a site that helps LLMs use it at inference time, when a context window cannot hold the whole site. It is an expert-level index of links with short descriptions, not a full content dump.

STRUCTURE (Markdown, in exactly this order; only the H1 is required, everything else is optional, include what genuinely helps):
1. An H1 ("# ") with the site name. This is the only required section.
2. A blockquote ("> ") with a short summary containing the key information needed to understand the rest of the file.
3. A details section of any Markdown EXCEPT headings, containing in this order: (a) one orientation sentence on how to use this index, naming which sections to prefer for what (for example: the blog index for discovery, individual articles for deep dives); (b) exactly one short sentence stating that every page listed below is also available as token-light Markdown by requesting the same URL with an "Accept: text/markdown" header; (c) when legal or policy pages are listed, one sentence noting they are included for licensing, data handling, and purchase constraints; (d) a "When to use this site:" note of 2-4 sentences telling an agent which concrete jobs this site is the right source for, derived from the site summary and the entries, ending with where policy or licensing questions are answered when such pages exist. Name the jobs specifically; generic marketing copy does not count as guidance. Beyond these four items, add detail only when it genuinely helps.
4. Zero or more H2 ("## ") sections, each containing a "file list": a bullet list where every item is a link "[name](url)" optionally followed by ": " and a short note.
5. An optional final "## Optional" H2 section whose links may be skipped when a shorter context is needed; put secondary, skippable links there.

Canonical shape:
# Title

> Optional description goes here

Optional details go here

## Section name

- [Link title](https://link_url): Optional link details

## Optional

- [Link title](https://link_url)

HARD RULES
- This is an index, not a copy of the site. Never reproduce or summarize a page's body content; the single sentence after each link is the maximum detail per entry.
- Use ONLY the entries provided in $content. Never invent, guess, shorten, or alter a URL; copy each "url" field verbatim. The entries are already de-duplicated by URL, so include every entry exactly once and never add a second or "Optional" entry for an alternate route that resolves to a page already listed.
- Use each entry's "title" as the link text as provided. Index and singleton pages that need no title already arrive with a clear, route-based label (for example "Index" for the home page, otherwise the title-cased final path segment). Never output "Untitled" or a placeholder-looking label such as "Test"; if a title still reads like a placeholder, derive a clearer one from its URL path and use it in both the link text and the surrounding description.
- Group links into sensible H2 sections. A good default is "## Pages" for entries with type "page" and "## Articles" for entries with type "article"; rename or merge them if it reads better. Legal and policy pages stay in the main Pages section: agents consult them for licensing, refunds, and data handling before recommending anything. Reserve "## Optional" for links an agent can genuinely skip, and omit the section entirely when nothing qualifies.
- Never write a "## Developer resources" section: the machine endpoints (OpenAPI, sitemap, crawler policy) are appended in code after you finish, so writing one yourself would duplicate it.
- After each link add ": " then one concise, information-dense sentence naming what the page concretely contains. If the entry has a "description", keep its specifics rather than flattening them into something blander; if not, write one from the title and site context.
- Use concise, clear language. Avoid ambiguous terms and unexplained jargon. No marketing fluff.
- Output plain Markdown only: no code fences, no preamble, no closing commentary, no front matter, and no headings other than the single H1 and the H2 section headers. Start directly with the H1.

INPUTS
Site name: $siteName
Site summary: $summary
Editor guidance (optional; obey it unless it is "(none)"): $guidance

Site entries (JSON array; each has type, title, url, and optional description, publishedAt, categories):
$content`;

/** Strip a wrapping markdown code fence if the model added one despite instructions. */
function stripCodeFences(input: string): string {
  const fenced = input.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```\s*$/);

  return fenced?.[1] ?? input;
}

/** Derived in code, so the model never invents a name for a title-less page: the root is "Index", anything else its title-cased last segment. */
function routeLabel(uri: string): string {
  const segment = uri.split("/").filter(Boolean).at(-1);

  return segment ? capitalCase(segment) : "Index";
}

export const POST: APIRoute = async ({ request }) => {
  const denied = await authorizeStudioRequest(request);

  if (denied) {
    return denied;
  }

  try {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    const guidanceFromBody = typeof body?.guidance === "string" ? body.guidance.trim() : "";

    // Overlay drafts so the generated file reflects work in progress, not just what is published.
    const data = await sanityEditClient
      .withConfig({ perspective: "drafts" })
      .fetch<LlmsTxtInventoryQueryResult>(LlmsTxtInventoryQuery);

    const siteName = data.site?.name?.trim() || "This site";
    const summary = data.site?.summary?.trim() || "";
    const guidance = guidanceFromBody || data.site?.guidance?.trim() || "";

    const seenUrls = new Set<string>();

    // Drop alternate/duplicate routes that resolve to a page already listed (same absolute URL).
    const entries = (data.pages ?? [])
      .map((page) => {
        const uri = page.uri ?? "/";

        return {
          type: page._type === "article" ? "article" : "page",
          title: page.title?.trim() || routeLabel(uri),
          url: absoluteUrl(uri),
          description: page.description?.trim() || undefined,
          publishedAt: page.publishedAt || undefined,
          categories: page.categories?.filter((category): category is string => Boolean(category)) ?? undefined,
        };
      })
      .filter((entry) => {
        if (seenUrls.has(entry.url)) {
          return false;
        }

        seenUrls.add(entry.url);
        return true;
      });

    if (entries.length === 0) {
      return Response.json(
        { error: "No indexable pages found. Publish at least one page before generating llms.txt." },
        { status: 422 }
      );
    }

    const agentClient = sanityEditClient.withConfig({ apiVersion: AGENT_API_VERSION });

    const response = await agentClient.agent.action.prompt({
      instruction: LLMS_TXT_INSTRUCTION,
      instructionParams: {
        siteName: { type: "constant", value: siteName },
        summary: { type: "constant", value: summary || "(no site summary provided)" },
        guidance: { type: "constant", value: guidance || "(none)" },
        content: { type: "constant", value: JSON.stringify(entries, null, 2) },
      },
      temperature: 0.2,
    });

    const text = stripCodeFences(typeof response === "string" ? response : String(response)).trim();

    if (!text) {
      return Response.json({ error: "Sanity AI returned an empty document. Try again." }, { status: 502 });
    }

    return Response.json({ text: insertDeveloperResourcesSection(text, PUBLIC_SITE_URL) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
};
