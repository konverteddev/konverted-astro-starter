// The paths `src/middleware.ts` never gates. Takes the Studio base path as an argument, so it reads no
// env and the test can run it outside Astro.

import { FEED_PATH } from "~/features/feed/constants";

function isStudioPath(pathname: string, studioBasePath: string): boolean {
  const base = studioBasePath.replace(/\/$/, "") || "/";

  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Studio, API routes, Astro internals and file-like paths. */
export function isExcludedPath(pathname: string, studioBasePath: string): boolean {
  if (isStudioPath(pathname, studioBasePath)) {
    return true;
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/_astro/") || pathname === "/favicon.ico") {
    return true;
  }

  // The feed carries whole article bodies, so unlike the other dot-paths it sits behind site-wide Basic Auth.
  if (pathname === FEED_PATH) {
    return false;
  }

  // Paths with a file extension are never gated, matching the source middleware's dot-path skip.
  return /\.[a-z0-9]+$/i.test(pathname);
}
