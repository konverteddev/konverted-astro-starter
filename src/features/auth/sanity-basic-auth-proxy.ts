/**
 * Sanity query for the Basic Auth toggles, read from `src/middleware.ts`. Live API, not the CDN:
 * CDN publish invalidation misses result-set membership changes, which a security gate cannot ride on.
 */

import { createProxySanityState } from "~/features/sanity/proxy-state";
import { normalizePathname } from "~/features/utils/pathname";
import { PUBLIC_SANITY_API_VERSION, PUBLIC_SANITY_DATASET, PUBLIC_SANITY_PROJECT_ID, SANITY_API_VIEW_TOKEN } from "~/lib/env";
import { SANITY_SINGLETON_SITE_SETTINGS_ID } from "~/sanity/constants";

type BasicAuthPayload = {
  basicAuth: {
    siteWideEnabled?: boolean | null;
  } | null;
  protectedPaths: string[] | null;
};

// Paths pre-normalized into a Set once per fetch so the per-request check is O(1).
export type BasicAuthState = {
  siteWideEnabled: boolean;
  protectedPathSet: ReadonlySet<string>;
};

function toBasicAuthState(payload: BasicAuthPayload): BasicAuthState {
  return {
    siteWideEnabled: payload.basicAuth?.siteWideEnabled === true,
    protectedPathSet: new Set((payload.protectedPaths ?? []).map(normalizePathname)),
  };
}

// Site-wide protection is a global switch, so it lives on the one `siteSettings` document.
const SANITY_BASIC_AUTH_STATE_QUERY = `{
  "basicAuth": *[_type == "${SANITY_SINGLETON_SITE_SETTINGS_ID}"][0].basicAuth{
    siteWideEnabled
  },
  "protectedPaths": *[passwordProtected == true && defined(uri.current)].uri.current
}`;

export const getSanityBasicAuthState = createProxySanityState(SANITY_BASIC_AUTH_STATE_QUERY, toBasicAuthState, {
  projectId: PUBLIC_SANITY_PROJECT_ID,
  dataset: PUBLIC_SANITY_DATASET,
  apiVersion: PUBLIC_SANITY_API_VERSION,
  token: SANITY_API_VIEW_TOKEN,
});
