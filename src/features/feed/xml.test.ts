import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { richTextToFeedHtml } from "./html";
import { type FeedItem, renderFeed } from "./xml";

const BASE = "https://example.com/";

function paragraph(text: string, extra: Record<string, unknown> = {}) {
  return { _type: "block", style: "normal", children: [{ _type: "span", text, marks: [] }], markDefs: [], ...extra };
}

function feed(...items: FeedItem[]): string {
  return renderFeed({ title: "Acme Blog", description: "News & notes", path: "/blog", items }, BASE);
}

describe("renderFeed: channel", () => {
  it("joins channel and self links without doubling the origin's slash", () => {
    const xml = feed();

    assert.match(xml, /<link>https:\/\/example\.com\/blog<\/link>/);
    assert.match(xml, /<atom:link href="https:\/\/example\.com\/feed\.xml" rel="self" type="application\/rss\+xml" \/>/);
  });

  it("escapes channel text", () => {
    assert.match(feed(), /<description>News &amp; notes<\/description>/);
  });

  it("dates the build by the most recently edited item, not the most recently published", () => {
    const xml = feed(
      { href: "/blog/new", publishedAt: "2026-02-01", _updatedAt: "2026-02-01T10:00:00Z" },
      { href: "/blog/old", publishedAt: "2026-01-01", _updatedAt: "2026-03-05T10:00:00Z" }
    );

    assert.match(xml, /<lastBuildDate>Thu, 05 Mar 2026 10:00:00 GMT<\/lastBuildDate>/);
  });

  it("is byte-identical for identical content", () => {
    assert.equal(feed(), feed());
  });
});

describe("renderFeed: items", () => {
  it("resolves an article against the site", () => {
    const xml = feed({ title: "Ours", href: "/blog/ours" });

    assert.match(xml, /<link>https:\/\/example\.com\/blog\/ours<\/link>/);
    assert.match(xml, /<guid isPermaLink="true">https:\/\/example\.com\/blog\/ours<\/guid>/);
  });

  it("writes an RFC 822 pubDate from a date-only field", () => {
    assert.match(feed({ href: "/a", publishedAt: "2026-09-18" }), /<pubDate>Fri, 18 Sep 2026 00:00:00 GMT<\/pubDate>/);
  });

  it("carries author, categories and excerpt, escaped", () => {
    const xml = feed({ href: "/a", author: "Ada <Lovelace>", categories: ["News", null, "Guides"], description: "R&D" });

    assert.match(xml, /<dc:creator>Ada &lt;Lovelace&gt;<\/dc:creator>/);
    assert.match(xml, /<category>News<\/category>\n\s+<category>Guides<\/category>/);
    assert.match(xml, /<description>R&amp;D<\/description>/);
  });

  it("drops an item with nowhere to link", () => {
    assert.doesNotMatch(feed({ title: "Orphan" }), /<item>/);
  });

  it("omits content:encoded for an article without a body", () => {
    assert.doesNotMatch(feed({ href: "/blog/empty" }), /content:encoded/);
  });

  it("keeps a CDATA terminator in the body from closing the section", () => {
    const xml = feed({ href: "/a", content: [paragraph("a ]]> b")] });

    assert.match(xml, /<content:encoded><!\[CDATA\[<p>a \]\]&gt; b<\/p>\]\]><\/content:encoded>/);
  });
});

describe("richTextToFeedHtml", () => {
  it("resolves a site-relative link mark and leaves an absolute one alone", () => {
    const block = {
      _type: "block",
      style: "normal",
      markDefs: [
        { _key: "in", _type: "linkField", href: "/about/team" },
        { _key: "out", _type: "linkField", href: "mailto:hi@example.org" },
      ],
      children: [
        { _type: "span", text: "inside", marks: ["in"] },
        { _type: "span", text: "outside", marks: ["out", "strong"] },
      ],
    };

    const html = richTextToFeedHtml([block], BASE);

    assert.match(html, /<a href="https:\/\/example\.com\/about\/team">inside<\/a>/);
    assert.match(html, /<a href="mailto:hi@example\.org">/);
    assert.match(html, /<strong>outside<\/strong>/);
  });

  it("nests list levels", () => {
    const html = richTextToFeedHtml(
      [paragraph("one", { listItem: "bullet", level: 1 }), paragraph("inner", { listItem: "bullet", level: 2 })],
      BASE
    );

    assert.match(html, /<ul><li>one<ul><li>inner<\/li><\/ul><\/li><\/ul>/);
  });

  it("keeps decorative marks as plain text and unknown styles as paragraphs", () => {
    const html = richTextToFeedHtml(
      [{ _type: "block", style: "lead", children: [{ _type: "span", text: "Lead", marks: ["indent-key"] }], markDefs: [] }],
      BASE
    );

    assert.equal(html, "<p>Lead</p>");
  });

  it("sizes a media block's image and keeps its caption", () => {
    const html = richTextToFeedHtml(
      [{ _type: "mediaBlock", alt: 'A "quoted" alt', imageUrl: "https://cdn.sanity.io/a.jpg", caption: "A caption." }],
      BASE
    );

    assert.equal(
      html,
      '<figure><img src="https://cdn.sanity.io/a.jpg?w=1200&amp;fit=max&amp;auto=format" alt="A &quot;quoted&quot; alt" /><figcaption>A caption.</figcaption></figure>'
    );
  });

  it("drops a block without a renderer", () => {
    assert.equal(richTextToFeedHtml([{ _type: "unknownBlock" }, paragraph("Text.")], BASE), "<p>Text.</p>");
  });

  it("drops an empty paragraph", () => {
    assert.equal(richTextToFeedHtml([paragraph(""), paragraph("Text.")], BASE), "<p>Text.</p>");
  });

  it("returns nothing for a missing body", () => {
    assert.equal(richTextToFeedHtml(null, BASE), "");
  });
});
