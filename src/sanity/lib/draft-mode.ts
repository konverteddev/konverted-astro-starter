// Draft mode = a signed Studio preview session (verified once per request by `src/middleware.ts` into
// `locals.draftSession`) plus the Presentation perspective cookie, which picks the perspective. The
// perspective cookie alone is forgeable, so it never switches rendering to drafts by itself. Read only
// when the page is server-rendered (prerendered contexts have no request, and touching Astro.cookies
// there would warn).

import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import type { AstroCookies } from "astro";

type DraftContext = { isPrerendered: boolean; cookies: AstroCookies; locals: App.Locals };

export function isDraftMode({ isPrerendered, cookies, locals }: DraftContext): boolean {
  return !isPrerendered && locals.draftSession === true && cookies.has(perspectiveCookieName);
}

export function getDraftModeProps(astro: DraftContext) {
  return {
    perspectiveCookie: isDraftMode(astro) ? (astro.cookies.get(perspectiveCookieName)?.value ?? undefined) : undefined,
  };
}
