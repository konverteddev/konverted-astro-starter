import { stegaClean } from "@sanity/client/stega";

/**
 * Resolves the brand token name a colour annotation stores to its CSS variable, so editing the token
 * in the stylesheet reaches published content. `stegaClean` first: this ends up inside a CSS value.
 */
export function tokenColor(value: string | null | undefined): string | undefined {
  const name = stegaClean(value ?? "");

  return name ? `var(--color-${name})` : undefined;
}
