// Route cache provider (wired in astro.config.mjs). Answered inside the app, never by a downstream shared cache,
// so the revalidate webhook can always reach every copy and gated traffic is cacheable.

import type { CacheProviderFactory } from "astro";
import { basicAuthorizationHeader } from "~/features/auth/basic-auth";
import { BASIC_AUTH_PASSWORD, BASIC_AUTH_USERNAME, ROUTE_CACHE_VERCEL_RUNTIME } from "~/lib/env";
import { createRouteCacheProvider } from "./create-provider";
import { createMemoryStore, type RouteCacheStore } from "./store";
import { createVercelRouteCache } from "./vercel-store";

let expectedAuthorization: string | null | undefined;

function getExpectedAuthorization(): string | null {
  if (expectedAuthorization === undefined) {
    expectedAuthorization = basicAuthorizationHeader(BASIC_AUTH_USERNAME ?? "", BASIC_AUTH_PASSWORD ?? "");
  }

  return expectedAuthorization;
}

/** Vercel's Runtime Cache is shared by every instance and keyed per build; off, the in-process store keeps any other host working. */
function createStore(): RouteCacheStore {
  return ROUTE_CACHE_VERCEL_RUNTIME ? createVercelRouteCache(__ROUTE_CACHE_BUILD_ID__) : createMemoryStore();
}

const factory: CacheProviderFactory = () => createRouteCacheProvider({ store: createStore(), getExpectedAuthorization });

export default factory;
