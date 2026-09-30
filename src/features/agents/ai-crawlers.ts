/**
 * AI crawler policy: search and citation yes, model training no.
 * Stated here so it stays in version control rather than becoming a property of the host's edge injection.
 */

/** Blocked: training-only crawlers. Costs no search visibility, since `Google-Extended` never governs Search or AI Overviews. */
export const AI_TRAINING_CRAWLERS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "GPTBot",
  "Google-Extended",
  "meta-externalagent",
] as const;

/** Allowed: answer engines that fetch in order to cite. Listed explicitly so the group still wins if something upstream merges a broad block in. */
export const AI_CITATION_CRAWLERS = [
  "CCBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "OAI-SearchBot",
  "Perplexity-User",
  "PerplexityBot",
] as const;

/** Content Signals states what may be done with content once crawled, which user-agent groups cannot express. */
export const CONTENT_SIGNAL = "search=yes,ai-train=no,use=reference";

type RobotsGroup = {
  userAgents: readonly string[];
  contentSignal?: string;
  allow?: readonly string[];
  disallow?: readonly string[];
};

/** A crawler obeys only its most specific group (RFC 9309), so each named group has to repeat the site's own disallows. */
function renderGroup(group: RobotsGroup): string[] {
  return [
    ...group.userAgents.map((agent) => `User-agent: ${agent}`),
    ...(group.contentSignal ? [`Content-Signal: ${group.contentSignal}`] : []),
    ...(group.allow ?? []).map((path) => `Allow: ${path}`),
    ...(group.disallow ?? []).map((path) => `Disallow: ${path}`),
    "",
  ];
}

/** Full `robots.txt` body. `disallow` holds the site's own private path prefixes. */
export function renderRobotsTxt(options: { disallow: readonly string[]; sitemap: string }): string {
  return [
    "# Search and citation are welcome. Training is not.",
    "# Declared in the codebase so the policy travels with the site, not with the host.",
    "",
    ...renderGroup({
      userAgents: ["*"],
      contentSignal: CONTENT_SIGNAL,
      allow: ["/"],
      disallow: options.disallow,
    }),
    ...renderGroup({ userAgents: AI_CITATION_CRAWLERS, allow: ["/"], disallow: options.disallow }),
    ...renderGroup({ userAgents: AI_TRAINING_CRAWLERS, disallow: ["/"] }),
    `Sitemap: ${options.sitemap}`,
    "",
  ].join("\n");
}
