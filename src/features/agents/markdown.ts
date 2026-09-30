// Serializes a page to Markdown. Pure: no Sanity or env. Section content runs through `sectionRenderers`,
// with project-specific fields added in the PROJECT block below.

import { capitalCase } from "change-case";

type Span = { _type?: string | null; text?: string | null; marks?: string[] | null };

type MarkDef = { _key?: string | null; _type?: string | null; href?: string | null };

type Block = {
  _type?: string | null;
  style?: string | null;
  listItem?: string | null;
  level?: number | null;
  children?: Span[] | null;
  markDefs?: MarkDef[] | null;
  alt?: string | null;
  imageUrl?: string | null;
};

// Keyed by the fragment's aliases, so adding a field needs no change to this type.
type RawSection = Record<string, unknown>;

export type AgentMarkdownPage = {
  _type?: string | null;
  uri?: string | null;
  title?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  author?: string | null;
  categories?: (string | null)[] | null;
  sections?: (RawSection | null)[] | null;
  // Articles only: the body is one rich text field on the document, not a page-builder section.
  content?: (Block | null)[] | null;
  // Blog index only: the listing lives on the document, not in a page-builder section.
  heading?: string | null;
  intro?: (Block | null)[] | null;
  articles?: (ArticleListItem | null)[] | null;
};

type ArticleListItem = {
  uri?: string | null;
  title?: string | null;
  description?: string | null;
  publishedAt?: string | null;
};

type RenderContext = { baseUrl: string };

export type SectionRenderer = (section: RawSection, ctx: RenderContext) => string;

const DECORATORS = new Set(["strong", "em", "code"]);

function absolutize(href: string, baseUrl: string): string {
  if (!href) {
    return "";
  }

  if (href.startsWith("/")) {
    return `${baseUrl}${href}`;
  }

  return href;
}

// Headline/caption are multi-line `text` fields but render as single-line Markdown, so collapse whitespace.
function singleLine(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function titleFromUri(uri: string): string {
  const trimmed = uri.replace(/^\/|\/$/g, "");

  if (!trimmed) {
    return "Home";
  }

  const last = trimmed.split("/").filter(Boolean).at(-1) ?? "";
  return capitalCase(last) || "Home";
}

function readString(section: RawSection, key: string): string {
  return typeof section[key] === "string" ? (section[key] as string) : "";
}

function readBlocks(section: RawSection, key: string): Block[] {
  return Array.isArray(section[key]) ? (section[key] as Block[]) : [];
}

function readObject<T>(section: RawSection, key: string): T | null {
  const value = section[key];
  return value && typeof value === "object" ? (value as T) : null;
}

function renderSpan(span: Span, markDefs: MarkDef[], baseUrl: string): string {
  const text = span.text ?? "";

  if (!text) {
    return "";
  }

  const marks = span.marks ?? [];
  let out = text;

  if (marks.includes("code")) {
    out = `\`${out}\``;
  }

  if (marks.includes("em")) {
    out = `_${out}_`;
  }

  if (marks.includes("strong")) {
    out = `**${out}**`;
  }

  const linkKey = marks.find((mark) => !DECORATORS.has(mark));

  if (linkKey) {
    const def = markDefs.find((markDef) => markDef._key === linkKey);
    const href = def?.href ? absolutize(def.href, baseUrl) : "";

    if (href) {
      out = `[${out}](${href})`;
    }
  }

  return out;
}

function renderChildren(block: Block, baseUrl: string): string {
  const markDefs = block.markDefs ?? [];
  return (block.children ?? []).map((child) => renderSpan(child, markDefs, baseUrl)).join("");
}

const HEADING_PREFIX: Record<string, string> = {
  h2: "## ",
  h3: "### ",
  h4: "#### ",
};

function renderBlock(block: Block, baseUrl: string): string {
  if (block._type === "mediaBlock") {
    return block.imageUrl ? `![${block.alt ?? ""}](${block.imageUrl})` : "";
  }

  if (block._type !== "block") {
    return "";
  }

  const inline = renderChildren(block, baseUrl).trim();

  if (!inline) {
    return "";
  }

  if (block.listItem) {
    const indent = "  ".repeat(Math.max((block.level ?? 1) - 1, 0));
    const bullet = block.listItem === "number" ? "1." : "-";
    return `${indent}${bullet} ${inline}`;
  }

  const heading = block.style ? HEADING_PREFIX[block.style] : undefined;

  if (heading) {
    return `${heading}${inline}`;
  }

  if (block.style === "caption") {
    return `_${inline}_`;
  }

  return inline;
}

// Portable Text array -> Markdown. Spec-standard; not a per-project tuning point.
function renderBlocks(blocks: Block[], baseUrl: string): string {
  const lines: string[] = [];
  let previousWasList = false;

  for (const block of blocks) {
    const line = renderBlock(block, baseUrl);

    if (!line) {
      continue;
    }

    const isList = block._type === "block" && Boolean(block.listItem);

    if (lines.length > 0 && !(isList && previousWasList)) {
      lines.push("");
    }

    lines.push(line);
    previousWasList = isList;
  }

  return lines.join("\n");
}

// Default renderers for the guaranteed page-builder factory fields; reused when a clone composes its own `sectionRenderers`.

/** `appRichText` (createRichTextField) -> Markdown body. */
export const renderRichText: SectionRenderer = (section, ctx) => renderBlocks(readBlocks(section, "text"), ctx.baseUrl);

/** `appMedia` (createMediaField) -> image (non-image media is skipped). */
export const renderMedia: SectionRenderer = (section) => {
  const media = readObject<{ alt?: string | null; imageUrl?: string | null }>(section, "media");
  return media?.imageUrl ? `![${media.alt ?? ""}](${media.imageUrl})` : "";
};

/** `appLink` (createLinkField) -> Markdown link. */
export const renderLink: SectionRenderer = (section, ctx) => {
  const link = readObject<{ href?: string | null; text?: string | null }>(section, "cta");

  if (!link?.href) {
    return "";
  }

  const href = absolutize(link.href, ctx.baseUrl);
  return `[${link.text?.trim() || href}](${href})`;
};

// PROJECT block: project a new field under an alias in query.ts, add a renderer, slot it into `sectionRenderers`.

const renderHeadline: SectionRenderer = (section) => {
  const headline = readString(section, "headline").trim();
  return headline ? `## ${singleLine(headline)}` : "";
};

const renderCaption: SectionRenderer = (section) => {
  const caption = readString(section, "caption").trim();
  return caption ? `_${singleLine(caption)}_` : "";
};

/** Section renderers in output order: the factory defaults plus this project's `headline` / `caption`. */
export const sectionRenderers: SectionRenderer[] = [renderHeadline, renderRichText, renderMedia, renderCaption, renderLink];

function renderSection(section: RawSection, baseUrl: string): string {
  return sectionRenderers
    .map((render) => render(section, { baseUrl }))
    .filter((fragment) => fragment.trim().length > 0)
    .join("\n\n");
}

// Not a section: the listing belongs to the `blog` document, so it renders like an article's body.
function renderArticleList(page: AgentMarkdownPage, baseUrl: string): string {
  const rows = (page.articles ?? [])
    .filter((article): article is ArticleListItem => Boolean(article))
    .map((article) => {
      const title = singleLine(article.title ?? "");
      const uri = (article.uri ?? "").trim();

      if (!title || !uri) {
        return "";
      }

      let row = `- [${title}](${absolutize(uri, baseUrl)})`;
      const description = singleLine(article.description ?? "");

      if (description) {
        row += `: ${description}`;
      }

      const date = (article.publishedAt ?? "").slice(0, 10);

      if (date) {
        row += ` (${date})`;
      }

      return row;
    })
    .filter(Boolean)
    .join("\n");

  const heading = singleLine(page.heading ?? "");
  const intro = renderBlocks(
    (page.intro ?? []).filter((block): block is Block => Boolean(block)),
    baseUrl
  );

  return [heading ? `## ${heading}` : "", intro, rows]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

function renderArticleMeta(page: AgentMarkdownPage): string {
  const bits: string[] = [];

  if (page.author) {
    bits.push(`By ${page.author}`);
  }

  if (page.publishedAt) {
    bits.push(page.publishedAt.slice(0, 10));
  }

  const categories = (page.categories ?? []).filter((category): category is string => Boolean(category));

  if (categories.length > 0) {
    bits.push(categories.join(", "));
  }

  return bits.length > 0 ? `_${bits.join(" · ")}_` : "";
}

export function pageToMarkdown(page: AgentMarkdownPage, baseUrl: string): string {
  const uri = page.uri ?? "/";
  const title = page.title?.trim() || titleFromUri(uri);

  const blocks: string[] = [`# ${title}`];

  const meta = renderArticleMeta(page);

  if (meta) {
    blocks.push(meta);
  }

  if (page.description?.trim()) {
    blocks.push(page.description.trim());
  }

  const articleList = renderArticleList(page, baseUrl);

  if (articleList) {
    blocks.push(articleList);
  }

  // An article's body: a rich text field on the document, so it renders before any section loop.
  const body = renderBlocks(
    (page.content ?? []).filter((block): block is Block => Boolean(block)),
    baseUrl
  );

  if (body) {
    blocks.push(body);
  }

  for (const section of page.sections ?? []) {
    if (!section) {
      continue;
    }

    const rendered = renderSection(section, baseUrl).trim();

    if (rendered) {
      blocks.push(rendered);
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
