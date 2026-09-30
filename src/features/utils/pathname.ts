/**
 * Canonical pathname form: no trailing slash, `/` stays `/`. Request pathnames and Sanity `uri.current`
 * values must go through this or set lookups silently miss.
 */
export function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/$/, "");
}
