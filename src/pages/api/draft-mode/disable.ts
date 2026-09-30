import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import type { APIRoute } from "astro";
import { DRAFT_SESSION_COOKIE, safeRedirectPath } from "~/features/auth/draft-session";

// Clears the draft cookies, then returns to ?redirectTo (a same-origin path, never `//host`) or /.
export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  cookies.delete(perspectiveCookieName, { path: "/" });
  cookies.delete(DRAFT_SESSION_COOKIE, { path: "/" });
  return redirect(safeRedirectPath(new URL(request.url).searchParams.get("redirectTo")), 307);
};
