// Builds the RSS 2.0 document (pure): `baseUrl` is injected so it runs under `node --test` without `astro:env`.

import { joinSiteUrl } from "~/lib/site-url";
import { FEED_LANGUAGE, FEED_MIME, FEED_PATH } from "./constants";
import { richTextToFeedHtml } from "./html";

export type FeedItem = {
  title?: string | null;
  href?: string | null;
  publishedAt?: string | null;
  _updatedAt?: string | null;
  description?: string | null;
  author?: string | null;
  categories?: (string | null | undefined)[] | null;
  content?: unknown;
};

export type FeedChannel = {
  title: string;
  description: string;
  /** Site-relative path of the page the feed mirrors. */
  path: string;
  items: FeedItem[];
};

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// CDATA cannot hold a literal "]]>", so an occurrence is split across two sections.
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function element(name: string, value: string | null | undefined): string | undefined {
  return value ? `      <${name}>${escapeXml(value)}</${name}>` : undefined;
}

function rfc822(date: string | null | undefined): string | undefined {
  const parsed = date ? new Date(date) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toUTCString() : undefined;
}

function renderItem(item: FeedItem, baseUrl: string): string {
  const url = joinSiteUrl(baseUrl, item.href);
  const html = richTextToFeedHtml(item.content, baseUrl);

  return [
    "    <item>",
    element("title", item.title ?? "Untitled"),
    element("link", url),
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    element("pubDate", rfc822(item.publishedAt)),
    element("dc:creator", item.author),
    ...(item.categories ?? []).map((category) => element("category", category)),
    element("description", item.description),
    html ? `      <content:encoded>${cdata(html)}</content:encoded>` : undefined,
    "    </item>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderFeed({ title, description, path, items }: FeedChannel, baseUrl: string): string {
  const listed = items.filter((item) => item.href);
  const lastBuild = listed
    .map((item) => item._updatedAt ?? "")
    .sort()
    .at(-1);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(joinSiteUrl(baseUrl, path))}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>${FEED_LANGUAGE}</language>`,
    // Content-driven, so an unchanged feed is byte-identical and a reader's conditional GET can skip it.
    `    <lastBuildDate>${rfc822(lastBuild) ?? new Date(0).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(joinSiteUrl(baseUrl, FEED_PATH))}" rel="self" type="${FEED_MIME}" />`,
    ...listed.map((item) => renderItem(item, baseUrl)),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
