# Technical SEO Checklist

Essential technical SEO elements for modern web applications.

## Table of Contents

- Metadata
- Sitemaps
- Canonical URLs
- Redirects
- Performance
- Robots.txt
- International SEO

## Metadata

### Title Tags

- Unique per page
- 50-60 characters
- Primary keyword near the beginning
- Brand name at the end (optional)

### Meta Descriptions

- Unique per page
- 150-160 characters
- Include call-to-action
- Contain relevant keywords

### Open Graph

```html
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Description" />
<meta property="og:image" content="https://example.com/image.jpg" />
<meta property="og:url" content="https://example.com/page" />
<meta property="og:type" content="article" />
```

### How this repo does it

Meta lives in one place: `src/layouts/Web.astro` renders every tag from its typed `Props`, and pages pass those props in the frontmatter. `seo()` in `src/sanity/seo.ts` merges a document's `seoMetadata` with the `site` singleton's defaults, so a page only supplies what it overrides (it also runs `getOgImageSrc`, which crops the CMS image to 1200x630).

```astro
---
import Web from "~/layouts/Web.astro";
import { loadSite, seo } from "../sanity/seo";

// `loadSite` is separate from `seo` so the route fetches it alongside its own document query.
const [{ data: page }, { data: site }] = await Promise.all([loadQuery<PageQResult>({ query: PageQ, params: { uri } }), loadSite(Astro)]);

const { title, description, image, robots } = page.seoMetadata ?? {};
const seoProps = seo(site, { title, description, image, robots, canonical });
---

<Web {...seoProps}>
  <Fragment slot="head">
    <!-- per-page extras only; the standard tags are already in Web.astro -->
  </Fragment>
</Web>
```

Two things to keep right: strings that end up in meta tags must be stega-free (`stegaClean`) so invisible preview characters never reach a crawler, and a page's `noindex` has to reach the `robots` prop rather than being handled at the template level.

## Sitemaps

`src/pages/sitemap.xml.ts` is a CMS-driven endpoint: one GROQ query (`SitemapQ`) returns every routed document that is not noindex or password protected, and the route serializes it. It is cached with the `page`, `article`, and site tags, so a publish invalidates it through `/api/revalidate`.

```ts
export const GET: APIRoute = async ({ cache }) => {
  cache.set({ ...CACHE_TTL, tags: ["page", "article", SITE_CACHE_TAG] });

  const { data: entries } = await loadQuery<SitemapQResult>({ query: SitemapQ });
  // ...serialize <url><loc>/<lastmod> per entry
};
```

Google ignores `<changefreq>` and `<priority>`, so entries carry only the URL and a content-driven `lastmod`. A new routed document type means adding it to `SitemapQ` and to the cache tags.

## Canonical URLs

Prevent duplicate content issues. The canonical is built with `absoluteUrl` (from `~/lib/env`, the one seam that joins the canonical origin to a path) and passed to `Web.astro` as a prop:

```ts
const canonical = absoluteUrl(uri);
```

Because the pages model stores a full `uri` per document, the canonical is always derivable from the document, never from the request URL (which can carry query strings or a preview path).

## Redirects

CMS-managed redirects live on the `siteSettings` document and are fetched once at config load, then handed to Astro's `redirects` config:

```js
// astro.config.mjs
export default defineConfig({
  redirects: await fetchRedirects(),
});
```

The fetch is fail-soft: a fresh clone with no env (or an unreachable Sanity) builds with no redirects instead of crashing. Because they are baked in at build time, a redirect added in the Studio needs a redeploy. See `docs/features/redirects.md`.

## Performance

[Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds) impact rankings:

- **LCP (Largest Contentful Paint):** < 2.5s
- **INP (Interaction to Next Paint):** < 200ms
- **CLS (Cumulative Layout Shift):** < 0.1

### Image optimization

- Render `SanityMedia.astro` (or `SanityImage.astro` directly); it builds a responsive `srcset` through `src/features/sanity/media/image/utils.ts` and never upscales.
- The URL builder requests `auto=format`, so Sanity's CDN serves WebP/AVIF where supported.
- LQIP is in the image fragment; `getLqipBackgroundStyle` paints it as a placeholder.
- Dimensions come from the asset metadata, so images reserve their box and do not shift layout.

### Font loading

Geist is self-hosted (`@fontsource-variable` plus the pixel faces in `public/fonts/geist-pixel/`) and every `@font-face` declares `font-display: swap`. Nothing is fetched from a third-party font host, so there is no extra connection on the critical path.

## Robots.txt

```
# public/robots.txt (or a dynamic src/pages/robots.txt.ts endpoint), use your *public* Studio path from
# PUBLIC_SANITY_STUDIO_BASE_PATH (default /studio)
User-agent: *
Allow: /
Disallow: /api/
Disallow: /studio/

# AI crawlers — allow or block based on your content strategy
# Uncomment to block specific AI crawlers:
# User-agent: GPTBot
# Disallow: /
# User-agent: ClaudeBot
# Disallow: /
# User-agent: PerplexityBot
# Disallow: /
# User-agent: Google-Extended
# Disallow: /

Sitemap: https://example.com/sitemap.xml
```

**AI crawler considerations:** Decide whether AI training crawlers should access your content. Blocking `Google-Extended` prevents AI training use while still allowing Google Search indexing. Review your policy regularly as this landscape evolves.

## International SEO (hreflang)

For multi-language sites, implement hreflang tags to indicate language/region variants:

This repo is single-locale today: there is no `lang` route segment and no hreflang output. If you add locales, emit the alternates from the `head` slot of `Web.astro` so every variant (plus `x-default`) ships on every page:

```astro
<Fragment slot="head">
  <link rel="alternate" hreflang="en" href={absoluteUrl(`/en${path}`)} />
  <link rel="alternate" hreflang="de" href={absoluteUrl(`/de${path}`)} />
  <link rel="alternate" hreflang="x-default" href={absoluteUrl(`/en${path}`)} />
</Fragment>
```

Include all language variants in sitemaps with `hreflang` annotations for proper indexing.
