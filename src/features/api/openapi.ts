// OpenAPI 3.1 description of the public machine surface, served at /openapi.json.
// Framework-free so it stays testable; every site-specific value arrives as a parameter.

const ERROR_RESPONSE_SCHEMA = {
  type: "object",
  description: "Uniform error body: human-readable message, stable machine code, and a resolution hint.",
  required: ["error", "code"],
  properties: {
    error: { type: "string", description: "Human-readable error message." },
    code: { type: "string", description: "Stable machine-readable error code slug." },
    hint: { type: "string", description: "How a caller can resolve or avoid the error." },
  },
} as const;

type OpenApiInput = {
  baseUrl: string;
  /** The site's own name, from the CMS. */
  siteName?: string;
  /** The site's own description, from the CMS. */
  description?: string;
};

export function buildOpenApiDocument({ baseUrl, siteName, description }: OpenApiInput) {
  const origin = baseUrl.replace(/\/$/, "");
  const name = siteName?.trim() || "This site";

  return {
    openapi: "3.1.0",
    info: {
      title: `${name} public API`,
      version: "1.0.0",
      summary: `Machine-readable surface of ${name} for AI agents and crawlers.`,
      description: [
        description?.trim(),
        "Read-only and unauthenticated. Every published page is available as Markdown through content negotiation; the llms.txt index lists them all. Errors from `/api/*` endpoints use the shared ErrorResponse JSON shape.",
      ]
        .filter(Boolean)
        .join(" "),
      contact: { name, url: origin },
    },
    servers: [{ url: origin, description: "Production" }],
    paths: {
      "/{path}": {
        get: {
          operationId: "getPageMarkdown",
          summary: "Any published page as Markdown",
          description:
            "Every published page is also served as token-light Markdown through content negotiation: request the page's own URL with an `Accept: text/markdown` header. The llms.txt index lists every available page. Unknown paths return a 404 with a Markdown recovery map.",
          parameters: [
            {
              name: "path",
              in: "path",
              required: true,
              description: "A published page path from llms.txt or the sitemap, for example `blog`.",
              schema: { type: "string" },
            },
            {
              name: "Accept",
              in: "header",
              required: true,
              description: "Must prefer `text/markdown` over `text/html` to receive the Markdown rendition.",
              schema: { type: "string", enum: ["text/markdown"] },
            },
          ],
          responses: {
            "200": {
              description: "The page rendered as Markdown.",
              content: { "text/markdown": { schema: { type: "string" } } },
            },
            "404": {
              description: "No published page at this path; the body is a Markdown recovery map with links to the site index.",
              content: { "text/markdown": { schema: { type: "string" } } },
            },
          },
        },
      },
      "/llms.txt": {
        get: {
          operationId: "getLlmsTxt",
          summary: "llms.txt site index",
          description:
            "Curated Markdown index of every public page with one-line descriptions, following the llms.txt convention (llmstxt.org). The best entry point for an agent exploring this site.",
          responses: {
            "200": { description: "The llms.txt document.", content: { "text/plain": { schema: { type: "string" } } } },
            "404": { description: "The index is disabled or has not been generated yet." },
          },
        },
      },
      "/openapi.json": {
        get: {
          operationId: "getOpenApiDocument",
          summary: "This OpenAPI document",
          description: "The OpenAPI 3.1 description of the public machine surface.",
          responses: {
            "200": {
              description: "The OpenAPI document.",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/sitemap.xml": {
        get: {
          operationId: "getSitemap",
          summary: "XML sitemap",
          description: "Every indexable page URL with its last-modified date.",
          responses: {
            "200": { description: "The sitemap.", content: { "application/xml": { schema: { type: "string" } } } },
          },
        },
      },
      "/robots.txt": {
        get: {
          operationId: "getRobotsTxt",
          summary: "Crawler policy",
          description: "Crawler and AI-training policy, including Content-Signal directives.",
          responses: {
            "200": { description: "The robots.txt document.", content: { "text/plain": { schema: { type: "string" } } } },
          },
        },
      },
    },
    components: { schemas: { ErrorResponse: ERROR_RESPONSE_SCHEMA } },
  };
}
