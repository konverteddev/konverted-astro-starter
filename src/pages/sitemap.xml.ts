import type { APIRoute } from "astro";
import { isSectionPreviewPath } from "~/features/page-builder/section-preview-path";
import { CACHE_TTL, SITE_WIDE_CACHE_TAGS } from "~/lib/cache";
import { absoluteUrl } from "~/lib/env";
import type { SitemapQResult } from "~/sanity/types";
import { loadQuery } from "../sanity/lib/load-query";
import { SitemapQ } from "../sanity/queries";

// CMS-driven sitemap: every routed document that is not noindex or password protected.
export const GET: APIRoute = async ({ cache }) => {
  // Any routed document's publish changes the sitemap, so it carries every routed _type.
  cache.set({ ...CACHE_TTL, tags: ["page", "legalPage", "article", "person", "blog", ...SITE_WIDE_CACHE_TAGS] });

  const { data: entries } = await loadQuery<SitemapQResult>({ query: SitemapQ });

  const urls = (entries ?? [])
    // The specimen's prefix is reserved and always gated, so a CMS page given a URL under it is never public.
    .filter((entry) => entry.uri && !isSectionPreviewPath(entry.uri))
    .map((entry) => {
      const loc = absoluteUrl(entry.uri);
      // Google ignores <changefreq> and <priority>, so entries carry only the URL and a content-driven lastmod.
      return ["  <url>", `    <loc>${loc}</loc>`, `    <lastmod>${entry.updatedAt}</lastmod>`, "  </url>"].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
