// Agent-Markdown eligibility for `src/middleware.ts`; cache mechanics live in `~/features/sanity/proxy-state`.

import { createProxySanityState } from "~/features/sanity/proxy-state";
import { normalizePathname } from "~/features/utils/pathname";
import { PUBLIC_SANITY_API_VERSION, PUBLIC_SANITY_DATASET, PUBLIC_SANITY_PROJECT_ID, SANITY_API_VIEW_TOKEN } from "~/lib/env";
import { SANITY_SINGLETON_SITE_SETTINGS_ID } from "~/sanity/constants";

// Under `/api` so it sits outside the public `(web)` catch-all and gets its own CDN cache entry.
export const AGENT_MARKDOWN_INTERNAL_BASE_PATH = "/api/agent-markdown";

type AgentMarkdownRoute = { uri?: string | null; excluded?: boolean | null };

type AgentMarkdownPayload = {
  siteWideBasicAuth?: boolean | null;
  routes: AgentMarkdownRoute[] | null;
};

/** Request-facing shape: paths pre-normalized into a Set once per fetch (O(1) per request). */
export type AgentMarkdownState = {
  siteWideBasicAuth: boolean;
  excludedPathSet: ReadonlySet<string>;
};

function toAgentMarkdownState(payload: AgentMarkdownPayload): AgentMarkdownState {
  const excludedPaths = (payload.routes ?? [])
    .filter((route): route is { uri: string; excluded: true } => route.excluded === true && typeof route.uri === "string")
    .map((route) => normalizePathname(route.uri));

  return {
    siteWideBasicAuth: payload.siteWideBasicAuth === true,
    excludedPathSet: new Set(excludedPaths),
  };
}

// Project over the STABLE set, never filter: membership changes on first generation and even the live API misses it.
const SANITY_AGENT_MARKDOWN_STATE_QUERY = `{
  "siteWideBasicAuth": *[_type == "${SANITY_SINGLETON_SITE_SETTINGS_ID}"][0].basicAuth.siteWideEnabled,
  "routes": *[defined(uri.current)]{
    "uri": uri.current,
    "excluded": seoMetadata.noIndex == true
      || passwordProtected == true
      || agentMarkdown.enabled == false
      || !defined(agentMarkdown.content)
      || agentMarkdown.content == ""
  }
}`;

export const getAgentMarkdownState = createProxySanityState(SANITY_AGENT_MARKDOWN_STATE_QUERY, toAgentMarkdownState, {
  projectId: PUBLIC_SANITY_PROJECT_ID,
  dataset: PUBLIC_SANITY_DATASET,
  apiVersion: PUBLIC_SANITY_API_VERSION,
  token: SANITY_API_VIEW_TOKEN,
});
