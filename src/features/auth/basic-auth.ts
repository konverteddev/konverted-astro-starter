// Basic Auth primitives, shared by the middleware gate and by the route cache provider, which has to
// recognise already-authenticated traffic before the middleware runs.

export function decodeBasicAuthHeader(header: string | null): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const b64 = header.slice(6).trim();

  try {
    const decoded = atob(b64);
    const colon = decoded.indexOf(":");

    if (colon === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, colon),
      password: decoded.slice(colon + 1),
    };
  } catch {
    return null;
  }
}

/** Constant-time compare, so a credential check cannot be probed one character at a time. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let out = 0;

  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return out === 0;
}

/** The 401 that makes a browser ask for the username and password. */
export function basicAuthChallenge(): Response {
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Protected"' },
  });
}

/** True when the request's Basic header carries exactly these credentials. */
export function hasBasicCredentials(header: string | null, username: string, password: string): boolean {
  const creds = decodeBasicAuthHeader(header);

  return Boolean(creds && timingSafeEqual(creds.username, username) && timingSafeEqual(creds.password, password));
}

/** Null when unconfigured, or when the credentials fall outside latin1, which `btoa`/`atob` could not round-trip anyway. */
export function basicAuthorizationHeader(username: string, password: string): string | null {
  const user = username.trim();

  if (!user || !password) {
    return null;
  }

  try {
    return `Basic ${btoa(`${user}:${password}`)}`;
  } catch {
    return null;
  }
}
