# RSS feed for the blog

The site serves an [RSS 2.0](https://www.rssboard.org/rss-specification) feed of the blog at [`/feed.xml`](/feed.xml). Readers and browser extensions can subscribe to follow new posts.

- **Serve it:** the 50 most recent articles, newest first, as `application/rss+xml`.
- **Discover it:** the blog index and every article emit `<link rel="alternate" type="application/rss+xml">` in `<head>`, and the index shows an RSS link under its intro.
- **Agents:** the code-owned Developer resources section of `llms.txt` lists it (`src/features/agents/llms-txt-resources.ts`); it appears the next time `llms.txt` is generated in the Studio.
- **No CMS surface:** the feed is derived from `article` documents, the `blog` singleton and the Site name. There is nothing to edit in the Studio.

## What is in it

The channel is titled `<Site name> <Blog title>` and described by the blog singleton's SEO description. Its `<link>` is the blog index.

Each item carries `title`, `link`, a permalink `guid`, `pubDate` (from `publishedAt`), `dc:creator` (the author), one `category` per category, the SEO description as `description`, and the whole body as `content:encoded`.

- **Excluded:** articles set to `noIndex` or **Password protect**, the same rule the sitemap applies. A per-article lock cannot be enforced inside a feed, so those articles never enter it.
- `lastBuildDate` is the newest `_updatedAt` among the items, not the request time, so an unchanged feed is byte-identical between fetches.

## How it works

1. **Query.** `FeedXmlQ` (`src/features/feed/query.ts`) selects every routed `article` and projects the body through `frag::agentRichText`, the reader-facing block projection shared with [Agent Markdown](./agent-markdown.md).
2. **Fetch.** `src/pages/feed.xml.ts` calls `loadQuery` without draft props, so the feed is always the published perspective and a preview cookie never leaks a draft into it.
3. **Serialize.** `src/features/feed/html.ts` turns each body into reader-safe HTML with [`@portabletext/to-html`](https://github.com/portabletext/to-html). `src/features/feed/xml.ts` hand-builds the RSS string with XML escaping and wraps the HTML in `CDATA`. Both are pure (the site origin is passed in) and covered by `src/features/feed/xml.test.ts`.
4. **Cache.** The response is tagged `article`, `articleCategory`, `person`, `blog` plus the site-wide tags, so a publish of anything the feed prints busts it through `/api/revalidate` (see [Revalidation and Caching](../sanity/revalidation-and-caching.md)).

## Portable Text to reader-safe HTML

Readers sanitize aggressively (no scripts, styles, iframes or interactive widgets), so each block maps to the closest plain HTML that keeps its meaning:

| Block / mark | Output in the feed |
| --- | --- |
| `mediaBlock` | `<figure>` with an `<img>` (1200px wide, `auto=format`) plus `<figcaption>`; non-image media is skipped |
| `linkField` mark | `<a href>`, site-relative hrefs resolved to absolute |
| `sup` | `<sup>` |
| `caption` style | an emphasized paragraph |
| headings, lists, `strong` / `em` / `code` | the `@portabletext/to-html` defaults |
| decorative marks, empty paragraphs, a block with no renderer | dropped, text kept |

A new rich text block reaches the feed in two edits: project what a reader should get in `AgentMarkdownRichTextFn` (`src/features/agents/query.ts`), then add its renderer to `types` in `html.ts` (and to `markdown.ts` for agents). Until then the block is silently absent from the feed, never broken.

## Basic Auth

Every other dotted path (`sitemap.xml`, `robots.txt`, `llms.txt`) skips Basic Auth. The feed does not: it carries whole article bodies, so the middleware keeps `/feed.xml` behind **site-wide** Basic Auth. While the site is gated the feed answers `401` without credentials and serves with them (most readers accept a username and password). The route cache keys gated and public responses apart, as it does for pages. See [Basic Authentication](./basic-auth.md).

## Manual verification

1. **Serve:** `curl -i https://<your-domain>/feed.xml` returns `200`, `content-type: application/rss+xml`, and lists the published articles newest first.
2. **Discover:** view source on `/blog` or any `/blog/<slug>` and confirm the `<link rel="alternate" type="application/rss+xml">`.
3. **Validate:** paste the feed into the [W3C Feed Validator](https://validator.w3.org/feed/).
4. **Revalidation:** publish an article and confirm it appears in the feed within seconds, with no redeploy.

## Implementation reference

| Concern | Location |
| --- | --- |
| Route, cache tags | [`src/pages/feed.xml.ts`](../../src/pages/feed.xml.ts) |
| GROQ query (`FeedXmlQ`) | [`src/features/feed/query.ts`](../../src/features/feed/query.ts) |
| Portable Text to reader-safe HTML | [`src/features/feed/html.ts`](../../src/features/feed/html.ts) |
| RSS document | [`src/features/feed/xml.ts`](../../src/features/feed/xml.ts) |
| Path, MIME, item limit, channel title | [`src/features/feed/constants.ts`](../../src/features/feed/constants.ts), [`title.ts`](../../src/features/feed/title.ts) |
| Autodiscovery | [`src/features/feed/FeedLink.astro`](../../src/features/feed/FeedLink.astro), used by `src/pages/blog/index.astro` and `src/pages/blog/[slug].astro` |
| Visible link | [`src/features/blog/ArticleList.astro`](../../src/features/blog/ArticleList.astro) |
| Basic Auth exception | [`src/features/auth/excluded-paths.ts`](../../src/features/auth/excluded-paths.ts) (`isExcludedPath`) |
| Dependency | `@portabletext/to-html` |
