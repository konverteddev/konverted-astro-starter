/** The channel's name, shared by the feed and the `<link rel="alternate">` that advertises it. */
export function feedTitle(siteName?: string | null, section?: string | null): string {
  return [siteName, section ?? "Blog"].filter(Boolean).join(" ");
}
