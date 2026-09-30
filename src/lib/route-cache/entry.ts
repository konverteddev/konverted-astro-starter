// Cache entries for the gated store, written as JSON: bodies travel base64-encoded (`/favicon.ico` is
// bytes) and headers as pairs.

import type { CacheOptions } from "astro";

/** Store entries are size-capped; skip an unusually large body rather than fail the write. */
export const ENTRY_MAX_BYTES = 1_000_000;

export type RouteCacheEntry = {
  status: number;
  headers: [string, string][];
  body: string;
};

// Campaign and referral parameters never change content; without this every ?utm_source is its own entry.
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "_hsenc",
  "_hsmi",
  "_ke",
  "oly_anon_id",
  "oly_enc_id",
  "rb_clickid",
  "s_cid",
  "vero_id",
  "wickedid",
  "yclid",
  "__s",
  "ref",
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();

  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

/** Sorted query, so parameter order cannot fragment the cache; tracking parameters are dropped, since they never change what renders. */
export function entryKey(url: URL): string {
  const params = new URLSearchParams(url.search);

  for (const key of [...params.keys()]) {
    if (isTrackingParam(key)) {
      params.delete(key);
    }
  }

  params.sort();

  const query = params.toString();

  return `astro-route:${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

/** Null when it must not be stored: only a plain 200 with a lifetime the route asked for is an entry. */
export function entryTtl(response: Response, options: CacheOptions | undefined): number | null {
  if (response.status !== 200 || response.headers.has("set-cookie")) {
    return null;
  }

  const maxAge = options?.maxAge ?? 0;

  return maxAge > 0 ? maxAge : null;
}

// Web-standard base64, no `Buffer`: this is bundled into SSR output. Chunked so a page body cannot overflow the argument list.
function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function toEntry(response: Response): Promise<RouteCacheEntry | null> {
  const body = new Uint8Array(await response.arrayBuffer());

  if (body.byteLength > ENTRY_MAX_BYTES) {
    return null;
  }

  const headers: [string, string][] = [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      headers.push([key, value]);
    }
  });

  return { status: response.status, headers, body: bytesToBase64(body) };
}

export function toResponse(entry: RouteCacheEntry): Response {
  return new Response(base64ToBytes(entry.body), {
    status: entry.status,
    headers: new Headers(entry.headers),
  });
}
