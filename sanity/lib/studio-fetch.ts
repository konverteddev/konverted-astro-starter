import * as React from "react";
import { type SanityClient, useClient } from "sanity";
import { sanityConfig } from "../config";

// `fetch` for this app's Studio-only API routes: adds the signed-in editor's Sanity token, which the
// route verifies with Sanity (`authorizeStudioRequest`). The token is only readable because
// `sanity.config.ts` sets `auth.loginMethod: "token"`; under cookie auth it stays in an httpOnly cookie
// on api.sanity.io that the app's own server never receives. See docs/studio-api-auth.md.

export function studioFetch(client: SanityClient, input: string, init: RequestInit = {}) {
  const token = client.config().token;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}

export type StudioFetch = (input: string, init?: RequestInit) => Promise<Response>;

export function useStudioFetch(): StudioFetch {
  const client = useClient({ apiVersion: sanityConfig.apiVersion });
  return React.useCallback((input, init) => studioFetch(client, input, init), [client]);
}
