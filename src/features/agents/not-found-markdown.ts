export type NotFoundLink = {
  label: string;
  path: string;
  note?: string;
};

/** The recovery links a lost agent gets on a 404. Edit to match the routes this app serves. */
export const NOT_FOUND_LINKS: readonly NotFoundLink[] = [
  { label: "Site index for agents", path: "/llms.txt", note: "every public page with a one-line description" },
  { label: "Homepage", path: "/" },
  { label: "Blog index", path: "/blog" },
  { label: "Sitemap", path: "/sitemap.xml" },
  { label: "OpenAPI description of the public endpoints", path: "/openapi.json" },
];

/** Markdown body for agent-facing 404 responses: a recovery map instead of a bare error. */
export function renderNotFoundMarkdown(baseUrl: string, links: readonly NotFoundLink[] = NOT_FOUND_LINKS): string {
  const origin = baseUrl.replace(/\/$/, "");
  const linkLines = links
    .map((link) => `- [${link.label}](${origin}${link.path === "/" ? "/" : link.path})${link.note ? `: ${link.note}` : ""}`)
    .join("\n");

  return `# 404 Not Found

The requested path does not exist on this site.

Where to look next:

${linkLines}

Every HTML page listed in llms.txt is also served as Markdown when requested with an \`Accept: text/markdown\` header.
`;
}
