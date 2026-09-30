import type { APIRoute } from "astro";
import { SiteQuery } from "~/features/site/query";
import { FAVICON_MIME, FAVICON_ROUTE_PX, getFaviconImageSrc, resolveFaviconAsset } from "~/features/site/seo/favicon";
import { CACHE_TTL, SITE_WIDE_CACHE_TAGS } from "~/lib/cache";
import type { SiteQueryResult } from "~/sanity/types";
import { loadQuery } from "../sanity/lib/load-query";

/** An endpoint rather than a static file: the icon lives in the CMS and its CDN URL moves on every swap, so this path is the stable URL Google crawls. */
export const GET: APIRoute = async ({ cache }) => {
  // The icon lives on Settings, so publishing that singleton is what invalidates it.
  cache.set({ ...CACHE_TTL, tags: [...SITE_WIDE_CACHE_TAGS] });

  const { data: site } = await loadQuery<SiteQueryResult>({ query: SiteQuery });
  const asset = resolveFaviconAsset(site?.favicon);

  if (!asset) {
    return new Response(null, { status: 404 });
  }

  const upstream = await fetch(getFaviconImageSrc(asset, FAVICON_ROUTE_PX));

  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: 502 });
  }

  // Proxied rather than redirected: a 302 to the CDN would hand Google the unstable URL again.
  return new Response(upstream.body, { headers: { "content-type": FAVICON_MIME } });
};
