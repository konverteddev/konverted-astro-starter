// The only module allowed to import `sanity:client` (Biome noRestrictedImports enforces it):
// every other consumer gets its client from here, so config seams stay in one place.

// biome-ignore lint/style/noRestrictedImports: this module IS the seam.
import { sanityClient as baseClient } from "sanity:client";
import { SANITY_API_EDIT_TOKEN } from "~/lib/env";

/** `loadQuery` keys every published read to the content version, so the render after a publish is a CDN miss by construction. */
export const sanityClient = baseClient.withConfig({ useCdn: true });

/** Write-capable, for API routes only. Never import in a rendering path; generation routes override the perspective per call. */
export const sanityEditClient = baseClient.withConfig({
  token: SANITY_API_EDIT_TOKEN,
  useCdn: false,
  perspective: "published",
  stega: false,
});
