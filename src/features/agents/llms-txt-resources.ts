/**
 * The "## Developer resources" section of llms.txt is appended in code, not written by the model,
 * so the machine endpoints are always present with exact URLs no matter what generation produces.
 */
export function renderDeveloperResourcesSection(baseUrl: string): string {
  const origin = baseUrl.replace(/\/$/, "");

  return `## Developer resources

- [OpenAPI description](${origin}/openapi.json): OpenAPI 3.1 description of the public machine surface, including the Markdown content negotiation and the JSON error shape.
- [Sitemap](${origin}/sitemap.xml): Every indexable page URL with its last-modified date.
- [RSS feed](${origin}/feed.xml): RSS 2.0 feed of the blog, newest first, with full article bodies.
- [Crawler policy](${origin}/robots.txt): Which crawlers may index or cite this site, and the Content-Signal directives.`;
}

/** Before "## Optional" when present, else appended. A section the model emitted anyway is stripped first. */
export function insertDeveloperResourcesSection(markdown: string, baseUrl: string): string {
  const withoutExisting = markdown.replace(/^## Developer resources\s*\n[\s\S]*?(?=^## |$(?![\s\S]))/m, "").trimEnd();
  const section = renderDeveloperResourcesSection(baseUrl);
  const optionalMatch = withoutExisting.match(/^## Optional\s*$/m);

  if (optionalMatch?.index === undefined) {
    return `${withoutExisting}\n\n${section}\n`;
  }

  const before = withoutExisting.slice(0, optionalMatch.index).trimEnd();
  const optional = withoutExisting.slice(optionalMatch.index);

  return `${before}\n\n${section}\n\n${optional}\n`;
}
