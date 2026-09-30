// `PUBLIC_SITE_URL` is hand-edited (a `.env` line, a dashboard field), so normalizing it once here
// is what keeps a stray trailing slash out of every canonical, `<loc>`, and share link.

export function normalizeSiteUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** The site root keeps its single slash (`https://site.com/`), the canonical form for a homepage. */
export function joinSiteUrl(base: string, path?: string | null): string {
  const origin = normalizeSiteUrl(base);
  const relative = (path ?? "").trim().replace(/^\/+/, "");

  return relative === "" ? `${origin}/` : `${origin}/${relative}`;
}
