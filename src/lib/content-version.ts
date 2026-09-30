// The content version every published read carries (see ./route-cache/content-version.ts), stored beside
// the route cache's marker so a publish reaches every Vercel instance and a deploy does not reset it.

import { ROUTE_CACHE_VERCEL_RUNTIME } from "~/lib/env";
import { createContentVersion, createMemoryVersionStore } from "./route-cache/content-version";
import { createVercelVersionStore } from "./route-cache/vercel-store";

export { CONTENT_VERSION_PARAM } from "./route-cache/content-version";

export const contentVersion = createContentVersion(
  ROUTE_CACHE_VERCEL_RUNTIME ? createVercelVersionStore() : createMemoryVersionStore()
);
