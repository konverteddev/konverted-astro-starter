// The gate for every API route that backs the Studio. A request is let through only when it carries the
// Sanity session of a person with publish access to this project's content, and Sanity confirms it.
// Framework-free (Web Crypto and fetch only), so the same file serves Next.js and Astro.
//
// Nothing a caller can type is trusted. Origin, Referer, Host and X-Forwarded-Host are request headers,
// so curl sends whatever it likes. A valid Sanity token is not enough either: every Sanity account can
// mint one. The decision uses the documented Access API permission list for this project
// (https://www.sanity.io/docs/http-reference/access-api, "Get current user permissions"), which also
// covers custom roles. API (robot) tokens are refused as well: these routes serve the Studio, not scripts.
// See docs/studio-api-auth.md.

// The Access API is versioned on its own and does not exist at older content API versions (404), so it
// cannot follow the project's `*_SANITY_API_VERSION`: this pins the documented Access API contract.
const ACCESS_API_VERSION = "v2025-07-11";
const MAX_PERMISSION_PAGES = 5;
// Not in Sanity's reference docs: `/users/me` reports this `provider` for API (robot) tokens. Used only to
// refuse robots; the allow decision never depends on it.
const ROBOT_PROVIDER = "sanity-token";
const VERIFY_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;

type Verdict = "allowed" | "forbidden" | "unauthenticated";

export type StudioAuthConfig = {
  projectId: string;
  /** The project's Sanity API version, from its env (`*_SANITY_API_VERSION`), with or without a leading `v`. */
  apiVersion: string;
  /** Optional shared secret for a route with a legitimate non-Studio caller (a webhook). */
  automationSecret?: string | null;
};

export type AuthorizeOptions = {
  /** Also accept `x-api-secret: <automationSecret>`. Off by default: a Studio route has one way in. */
  allowAutomationSecret?: boolean;
};

// Keyed by a hash of the token, so a Studio session costs one Sanity round trip a minute, not one per
// call. A removed editor keeps access for at most CACHE_TTL_MS.
const verdictCache = new Map<string, { verdict: Verdict; expiresAt: number }>();

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hashKey(value: string) {
  return Array.from(await sha256(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings, via their fixed-length digests. */
export async function secretsMatch(provided: string, expected: string) {
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;

  for (let index = 0; index < a.length; index++) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }

  return diff === 0;
}

function bearerToken(request: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec((request.headers.get("authorization") ?? "").trim());
  return match?.[1] ?? null;
}

function cachedVerdict(key: string) {
  const entry = verdictCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    verdictCache.delete(key);
    return null;
  }

  return entry.verdict;
}

function cacheVerdict(key: string, verdict: Verdict) {
  if (verdictCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = verdictCache.keys().next().value;

    if (oldest !== undefined) {
      verdictCache.delete(oldest);
    }
  }

  verdictCache.set(key, { verdict, expiresAt: Date.now() + CACHE_TTL_MS });
}

function sanityGet(url: string, token: string) {
  return fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
  });
}

type AccessPermission = { type?: unknown; action?: unknown; params?: { mode?: unknown } | null };

/** Publish access to content: the built-in administrator, editor and developer roles grant
 *  `sanity.document.filter.mode` in `publish` mode; custom roles may grant `sanity.document.filter` update. */
function grantsPublish(permission: AccessPermission) {
  return (
    (permission.type === "sanity.document.filter.mode" && permission.params?.mode === "publish") ||
    (permission.type === "sanity.document.filter" && permission.action === "update")
  );
}

/** Documented Access API: every permission this token holds on the project, paginated. */
async function publishAccess(token: string, projectId: string): Promise<Verdict> {
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PERMISSION_PAGES; page++) {
    const url = new URL(`https://api.sanity.io/${ACCESS_API_VERSION}/access/project/${projectId}/user-permissions/me`);
    url.searchParams.set("limit", "100");

    if (cursor) {
      url.searchParams.set("nextCursor", cursor);
    }

    const response = await sanityGet(url.toString(), token);

    if (response.status === 401) {
      return "unauthenticated";
    }

    if (response.status === 403) {
      return "forbidden";
    }

    if (!response.ok) {
      throw new Error(`Sanity answered ${response.status} while reading Studio permissions.`);
    }

    const body = (await response.json()) as { data?: AccessPermission[] | null; nextCursor?: string | null };

    if ((body.data ?? []).some(grantsPublish)) {
      return "allowed";
    }

    cursor = body.nextCursor ?? null;

    if (!cursor) {
      return "forbidden";
    }
  }

  return "forbidden";
}

/** Refuses API (robot) tokens, which the Access API treats like people. `/users/me` requires a valid session. */
async function sessionKind(
  token: string,
  { projectId, apiVersion }: StudioAuthConfig
): Promise<"person" | "robot" | "unauthenticated"> {
  const response = await sanityGet(`https://${projectId}.api.sanity.io/v${apiVersion.replace(/^v/, "")}/users/me`, token);

  if (response.status === 401 || response.status === 403) {
    return "unauthenticated";
  }

  if (!response.ok) {
    throw new Error(`Sanity answered ${response.status} while verifying a Studio session.`);
  }

  const user = (await response.json()) as { id?: unknown; provider?: unknown };

  if (typeof user.id !== "string" || !user.id) {
    return "unauthenticated";
  }

  return user.provider === ROBOT_PROVIDER ? "robot" : "person";
}

/** Both checks in parallel. Throws on a network failure or an unexpected status, so an outage fails
 *  closed without being cached. */
async function verifyToken(token: string, config: StudioAuthConfig): Promise<Verdict> {
  const [kind, access] = await Promise.all([sessionKind(token, config), publishAccess(token, config.projectId)]);

  if (kind === "unauthenticated" || access === "unauthenticated") {
    return "unauthenticated";
  }

  if (kind === "robot") {
    return "forbidden";
  }

  return access;
}

async function studioVerdict(request: Request, config: StudioAuthConfig): Promise<Verdict> {
  const token = bearerToken(request);

  if (!token) {
    return "unauthenticated";
  }

  const key = await hashKey(`${config.projectId}:${token}`);
  const cached = cachedVerdict(key);

  if (cached) {
    return cached;
  }

  const verdict = await verifyToken(token, config);
  cacheVerdict(key, verdict);
  return verdict;
}

function denial(status: number, error: string, code: string, hint: string) {
  return Response.json({ error, code, hint }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Resolves to `null` when the request may proceed, or to the error `Response` to return. Call it first
 * in every Studio-backed handler:
 *
 *   const denied = await authorizeStudioRequest(request);
 *   if (denied) { return denied; }
 *
 * Studio code sends the token with `studioFetch` / `useStudioFetch` (`sanity/lib/studio-fetch.ts`).
 */
export async function authorizeStudioRequest(
  request: Request,
  config: StudioAuthConfig,
  options: AuthorizeOptions = {}
): Promise<Response | null> {
  const provided = request.headers.get("x-api-secret");

  if (
    options.allowAutomationSecret &&
    config.automationSecret &&
    provided &&
    (await secretsMatch(provided, config.automationSecret))
  ) {
    return null;
  }

  let verdict: Verdict;

  try {
    verdict = await studioVerdict(request, config);
  } catch {
    return denial(
      503,
      "Could not verify the Studio session.",
      "auth_unavailable",
      "Sanity did not answer the session check. Try again in a moment."
    );
  }

  if (verdict === "allowed") {
    return null;
  }

  if (verdict === "forbidden") {
    return denial(
      403,
      "Forbidden.",
      "forbidden",
      "Only a signed-in Studio user with publish access to this project can call this route."
    );
  }

  return denial(
    401,
    "Unauthorized.",
    "unauthorized",
    "These routes back the Studio. Sign in to the Studio and call them from there."
  );
}
