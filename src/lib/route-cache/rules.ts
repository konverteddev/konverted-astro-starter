// Which requests the route cache may answer. Cache lookups run before `src/middleware.ts`, so these
// predicates stand in for everything the middleware would otherwise decide.

import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import { timingSafeEqual } from "~/features/auth/basic-auth";

function hasDraftCookie(request: Request): boolean {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return false;
  }

  return cookie.split(";").some((entry) => entry.trim().startsWith(`${perspectiveCookieName}=`));
}

/** Responses that must never be stored, in any layer. */
export function shouldBypassCache(request: Request): boolean {
  // Draft mode: the response depends on the editor's perspective, never on the shared cache.
  if (hasDraftCookie(request)) {
    return true;
  }

  // A cached HTML hit would answer before the middleware rewrites; a loose match is fine, since a false positive only skips the cache.
  if (request.headers.get("accept")?.toLowerCase().includes("markdown")) {
    return true;
  }

  return false;
}

/** The exact header match is what makes a shared entry safe, and rotating the credentials orphans everything under the old ones. */
export function isAuthenticatedRequest(request: Request, expectedAuthorization: string | null): boolean {
  const header = request.headers.get("authorization");

  if (!header || expectedAuthorization === null) {
    return false;
  }

  return timingSafeEqual(header, expectedAuthorization);
}
