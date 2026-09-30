/**
 * The site's own cookies, and the one module allowed to assign `document.cookie`.
 * Not the Cookie Store API: its async reads and writes lose races the announcement guard and click handlers run.
 */

/** `Secure` is invalid over http, so it is set only where the browser would accept it. */
function attributes(maxAgeSeconds: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  return `Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API cannot replace this; see above.
  document.cookie = `${name}=${value}; ${attributes(maxAgeSeconds)}`;
}

/** Presence only: every cookie here is a flag or is read by the server, never read back for its value. */
export function hasCookie(name: string) {
  return document.cookie.split("; ").some((cookie) => cookie.startsWith(`${name}=`));
}
