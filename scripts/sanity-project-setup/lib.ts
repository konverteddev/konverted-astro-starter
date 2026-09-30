/**
 * Helpers for `scripts/sanity-project-setup/setup.ts` — env merging and Sanity CLI.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Copies `.env.example` to a missing `envPath`, so upserts preserve every template key. */
export function ensureEnvFromExample(envPath: string, examplePath: string): boolean {
  if (existsSync(envPath)) {
    return false;
  }

  if (!existsSync(examplePath)) {
    return false;
  }
  writeFileSync(envPath, readFileSync(examplePath, "utf8"), "utf8");
  return true;
}

/** Read from `.env.example` rather than hardcoded, so the script writes keys whatever host it is dropped into will read. */
export function readPublicEnvPrefix(exampleContents: string): string {
  return /^([A-Z0-9_]*?PUBLIC_)SANITY_PROJECT_ID\s*=/m.exec(exampleContents)?.[1] ?? "PUBLIC_";
}

/** Read from the example so the CORS default matches the port the dev server actually listens on. */
export function readLocalSiteOrigin(exampleContents: string, fallback: string): string {
  return /^[A-Z0-9_]*\s*=\s*(http:\/\/localhost:\d+)\s*$/m.exec(exampleContents)?.[1] ?? fallback;
}

/** Scans for the matching brace rather than slicing to end-of-output, so spinner lines and version notices are tolerated. */
export function parseJsonFromCliOutput(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  const start = trimmed.indexOf("{");

  if (start === -1) {
    throw new Error(`Expected JSON object in CLI output, got:\n${trimmed.slice(0, 500)}`);
  }

  const end = findMatchingBrace(trimmed, start);

  if (end === -1) {
    throw new Error(`Unterminated JSON object in CLI output:\n${trimmed.slice(start, start + 500)}`);
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

/** Newer CLIs return it under `token`, older under `key`. The error never echoes the body: a fresh secret must not reach a log. */
export function parseTokenSecret(obj: Record<string, unknown>): string {
  for (const field of ["token", "key"]) {
    const value = obj[field];

    if (typeof value === "string" && value) {
      return value;
    }
  }

  throw new Error(`Unexpected token JSON (no token or key field). Fields present: ${Object.keys(obj).join(", ") || "none"}`);
}

/** Accounts for nested objects and braces inside string literals; -1 when the object is never closed. */
function findMatchingBrace(text: string, open: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = open; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

export function runSanityCli(args: string[]): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const binName = process.platform === "win32" ? "sanity.cmd" : "sanity";
  const bin = join(process.cwd(), "node_modules", ".bin", binName);
  const result = spawnSync(bin, args, {
    encoding: "utf-8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // A spawn-level failure leaves `status` null, so surface `error` or callers print an empty message.
  const spawnError = result.error ? result.error.message : "";

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr || spawnError,
    status: result.status,
  };
}

/** Inherited stdio and layered env, for the long commands that print their own progress and read the project from env. */
export function runSanityCliStreaming(
  args: string[],
  extraEnv: Record<string, string> = {}
): { ok: boolean; error: string; status: number | null } {
  const binName = process.platform === "win32" ? "sanity.cmd" : "sanity";
  const bin = join(process.cwd(), "node_modules", ".bin", binName);
  const result = spawnSync(bin, args, {
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });

  return {
    ok: !result.error && result.status === 0,
    error: result.error ? result.error.message : "",
    status: result.status,
  };
}

export function formatEnvValue(value: string): string {
  if (/[\s#'"\\]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Upserts KEY=value pairs in a `.env` file, preserving unrelated lines and order where possible.
 */
export function upsertEnvFile(filePath: string, updates: Record<string, string>): void {
  const keysRemaining = new Set(Object.keys(updates));
  const lines: string[] = existsSync(filePath) ? readFileSync(filePath, "utf8").split(/\r?\n/) : [];

  const out: string[] = [];
  for (const line of lines) {
    const match = /^(?:export\s+)?([A-Za-z_]\w*)\s*=/.exec(line);

    if (match?.[1] && keysRemaining.has(match[1])) {
      const key = match[1];
      out.push(`${key}=${formatEnvValue(updates[key] ?? "")}`);
      keysRemaining.delete(key);
    } else {
      out.push(line);
    }
  }

  for (const key of keysRemaining) {
    out.push(`${key}=${formatEnvValue(updates[key] ?? "")}`);
  }

  const body = out.join("\n");
  writeFileSync(filePath, body.endsWith("\n") ? body : `${body}\n`, "utf8");
}
