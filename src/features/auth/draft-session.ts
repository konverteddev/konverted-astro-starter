// Proof that this browser went through the Presentation handshake. The Sanity preview cookie on its own
// proves nothing: it is a plain cookie any client can set, and trusting its presence let anyone skip the
// site's Basic Auth and read drafts. The draft-mode enable route, after Sanity's signed preview secret
// validates, also sets this httpOnly cookie: an expiry signed with HMAC-SHA256. Only a valid signature
// counts as a Studio session. Framework-free (Web Crypto only). See docs/studio-api-auth.md.

export const DRAFT_SESSION_COOKIE = "__draft_session";
export const DRAFT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(`draft-session:v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function signature(secret: string, expiresAt: number) {
  const signed = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(String(expiresAt)));
  return toBase64Url(new Uint8Array(signed));
}

/** A cookie value that stays valid for DRAFT_SESSION_MAX_AGE_SECONDS. `secret` is a server-only value. */
export async function createDraftSession(secret: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + DRAFT_SESSION_MAX_AGE_SECONDS;
  return `${expiresAt}.${await signature(secret, expiresAt)}`;
}

/** True only for an unexpired value this server signed. Constant-time on the signature. */
export async function verifyDraftSession(secret: string, value: string | null | undefined, now = Date.now()) {
  if (!secret || !value) {
    return false;
  }

  const [expiresRaw, provided, ...rest] = value.split(".");
  const expiresAt = Number(expiresRaw);

  if (rest.length > 0 || !provided || !Number.isInteger(expiresAt) || expiresAt < Math.floor(now / 1000)) {
    return false;
  }

  const expected = await signature(secret, expiresAt);

  if (expected.length !== provided.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < expected.length; index++) {
    diff |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }

  return diff === 0;
}

/** Reads one cookie from a raw `Cookie` header, for code that only has the Request. */
export function readCookie(cookieHeader: string | null, name: string) {
  for (const entry of (cookieHeader ?? "").split(";")) {
    const [key, ...value] = entry.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}

/** A same-origin path for `?redirectTo=`, never a protocol-relative (`//host`) or backslash (`/\host`) escape. */
export function safeRedirectPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }

  return value;
}
