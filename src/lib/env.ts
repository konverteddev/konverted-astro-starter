// Re-exports secrets from `astro:env/server`, so importing this from client code is a build error.
// The Studio keeps `sanity/config.ts`, because the Sanity CLI runs outside Astro.

import { PUBLIC_SITE_URL as CONFIGURED_SITE_URL } from "astro:env/client";
import { joinSiteUrl, normalizeSiteUrl } from "./site-url";

export {
  PUBLIC_SANITY_API_VERSION,
  PUBLIC_SANITY_DATASET,
  PUBLIC_SANITY_PROJECT_ID,
  PUBLIC_SANITY_STUDIO_BASE_PATH,
  PUBLIC_UMAMI_WEBSITE_ID,
} from "astro:env/client";

export {
  BASIC_AUTH_PASSWORD,
  BASIC_AUTH_USERNAME,
  RESEND_API_KEY,
  RESEND_EMAIL_FROM,
  ROUTE_CACHE_VERCEL_RUNTIME,
  SANITY_API_EDIT_TOKEN,
  SANITY_API_VIEW_TOKEN,
  SANITY_REVALIDATE_SECRET,
} from "astro:env/server";

// The only read of the raw site URL: normalized here so nothing downstream defends against a slash.
export const PUBLIC_SITE_URL = normalizeSiteUrl(CONFIGURED_SITE_URL);

/** Every absolute URL comes from here; a hand-built one fails the guard in `site-url.test.ts`. */
export function absoluteUrl(path?: string | null): string {
  return joinSiteUrl(PUBLIC_SITE_URL, path);
}
