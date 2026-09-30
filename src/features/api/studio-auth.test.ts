import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { authorizeStudioRequest, secretsMatch } from "./studio-auth";

const CONFIG = { projectId: "testproj", apiVersion: "2099-01-31", automationSecret: "automation-secret" };
const realFetch = globalThis.fetch;
let sanityCalls: string[] = [];

type Session = {
  /** `/users/me`: status and body. */
  me: { status: number; body?: unknown };
  /** Access API `user-permissions/me`: status and pages of permissions. */
  permissions: { status: number; pages?: unknown[][] };
};

const publishPermission = {
  type: "sanity.document.filter.mode",
  name: "sanity-all-documents",
  action: "mode",
  params: { mode: "publish" },
};
const readPermission = {
  type: "sanity.document.filter.mode",
  name: "sanity-all-documents",
  action: "mode",
  params: { mode: "read" },
};
const draftsOnlyPermission = {
  type: "sanity.document.filter.mode",
  name: "sanity-all-documents",
  action: "mode",
  params: { mode: "create" },
};
const projectReadPermission = { type: "sanity.project", name: "sanity-project", action: "read" };

const person = (...permissions: unknown[]): Session => ({
  me: { status: 200, body: { id: "g-person", provider: "google" } },
  permissions: { status: 200, pages: [permissions] },
});

/** Stands in for Sanity: routes each request by endpoint, then by the token it carries. */
function mockSanity(byToken: Record<string, Session | "network-error">) {
  sanityCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    sanityCalls.push(url.toString());
    const token = new Headers(init?.headers).get("authorization")?.replace(/^Bearer /, "") ?? "";
    const session = byToken[token];

    if (session === "network-error") {
      throw new TypeError("fetch failed");
    }

    const unauthorized = Response.json(
      { statusCode: 401, error: "Unauthorized", message: "A valid session is required" },
      { status: 401 }
    );

    if (!session) {
      return unauthorized;
    }

    if (url.pathname.endsWith("/users/me")) {
      return Response.json(session.me.body ?? {}, { status: session.me.status });
    }

    if (url.pathname.endsWith("/user-permissions/me")) {
      const pages = session.permissions.pages ?? [[]];
      const index = Number(url.searchParams.get("nextCursor") ?? 0);
      const nextCursor = index + 1 < pages.length ? String(index + 1) : null;
      return Response.json({ data: pages[index] ?? [], nextCursor }, { status: session.permissions.status });
    }

    return new Response("unexpected endpoint", { status: 500 });
  }) as typeof fetch;
}

function request(headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/route", { method: "POST", headers });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("no credentials is 401, whatever Origin, Referer or Host claim", async () => {
  mockSanity({});
  const cases: Record<string, string>[] = [
    {},
    { origin: "https://example.com" },
    { referer: "https://example.com/studio/structure" },
    { origin: "https://example.com", referer: "https://example.com/studio", "x-forwarded-host": "example.com" },
  ];

  for (const headers of cases) {
    assert.equal((await authorizeStudioRequest(request(headers), CONFIG))?.status, 401, JSON.stringify(headers));
  }

  assert.equal(sanityCalls.length, 0, "no token means no call to Sanity");
});

test("a token Sanity does not recognise is 401", async () => {
  mockSanity({});
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer made-up" }), CONFIG))?.status, 401);
});

test("a real Sanity login with no permissions on this project is 403", async () => {
  // What the Access API answers for any account outside the project: 200 and an empty permission list.
  mockSanity({ outsider: person() });
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer outsider" }), CONFIG))?.status, 403);
});

test("read-only (viewer) and drafts-only (contributor) access is 403", async () => {
  mockSanity({
    viewer: person(projectReadPermission, readPermission),
    contributor: person(projectReadPermission, draftsOnlyPermission),
  });
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer viewer" }), CONFIG))?.status, 403);
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer contributor" }), CONFIG))?.status, 403);
});

test("an API token is 403 even with publish access", async () => {
  mockSanity({
    robot: {
      me: { status: 200, body: { id: "p-robot", provider: "sanity-token" } },
      permissions: { status: 200, pages: [[projectReadPermission, publishPermission]] },
    },
  });
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer robot" }), CONFIG))?.status, 403);
});

test("a person with publish access is let through, from either permission shape", async () => {
  const customUpdate = { type: "sanity.document.filter", name: "articles-only", action: "update" };
  mockSanity({ editor: person(projectReadPermission, publishPermission), custom: person(projectReadPermission, customUpdate) });

  assert.equal(await authorizeStudioRequest(request({ authorization: "Bearer editor" }), CONFIG), null);
  assert.equal(await authorizeStudioRequest(request({ authorization: "Bearer custom" }), CONFIG), null);
});

test("it asks the documented endpoints: the Access API for permissions, the project's API version for /users/me", async () => {
  // A token no earlier test used: verdicts are cached for a minute.
  mockSanity({ "endpoint-check": person(publishPermission) });
  await authorizeStudioRequest(request({ authorization: "Bearer endpoint-check" }), CONFIG);

  assert.ok(sanityCalls.includes("https://testproj.api.sanity.io/v2099-01-31/users/me"), sanityCalls.join("\n"));
  assert.ok(
    sanityCalls.some((url) => url.startsWith("https://api.sanity.io/v2025-07-11/access/project/testproj/user-permissions/me?")),
    sanityCalls.join("\n")
  );
});

test("the /users/me API version comes from config, with or without a leading v", async () => {
  mockSanity({ "version-check": person(publishPermission) });
  await authorizeStudioRequest(request({ authorization: "Bearer version-check" }), {
    projectId: "vproj",
    apiVersion: "v2031-05-06",
  });
  assert.ok(sanityCalls.includes("https://vproj.api.sanity.io/v2031-05-06/users/me"));
});

test("permissions are read across pages", async () => {
  mockSanity({
    paged: {
      me: { status: 200, body: { id: "g-person", provider: "google" } },
      permissions: { status: 200, pages: [[projectReadPermission], [readPermission], [publishPermission]] },
    },
  });
  assert.equal(await authorizeStudioRequest(request({ authorization: "Bearer paged" }), CONFIG), null);
});

test("a verdict is cached per project, so repeated calls do not hit Sanity again", async () => {
  mockSanity({ cached: person(publishPermission) });
  await authorizeStudioRequest(request({ authorization: "Bearer cached" }), CONFIG);
  const afterFirst = sanityCalls.length;
  await authorizeStudioRequest(request({ authorization: "Bearer cached" }), CONFIG);
  assert.equal(sanityCalls.length, afterFirst);

  await authorizeStudioRequest(request({ authorization: "Bearer cached" }), { projectId: "otherproj", apiVersion: "2099-01-31" });
  assert.ok(sanityCalls.length > afterFirst, "another project asks Sanity afresh");
});

test("a Sanity outage fails closed with 503 and is not cached", async () => {
  mockSanity({ flaky: "network-error" });
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer flaky" }), CONFIG))?.status, 503);

  mockSanity({ flaky: { me: { status: 500 }, permissions: { status: 200, pages: [[publishPermission]] } } });
  assert.equal((await authorizeStudioRequest(request({ authorization: "Bearer flaky" }), CONFIG))?.status, 503);

  mockSanity({ flaky: person(publishPermission) });
  assert.equal(await authorizeStudioRequest(request({ authorization: "Bearer flaky" }), CONFIG), null);
});

test("the automation secret only opens routes that opt in, and only as x-api-secret", async () => {
  mockSanity({});
  const withSecret = request({ "x-api-secret": "automation-secret" });

  assert.equal((await authorizeStudioRequest(withSecret, CONFIG))?.status, 401);
  assert.equal(await authorizeStudioRequest(withSecret, CONFIG, { allowAutomationSecret: true }), null);
  assert.equal(
    (await authorizeStudioRequest(request({ "x-api-secret": "wrong" }), CONFIG, { allowAutomationSecret: true }))?.status,
    401
  );
  assert.equal(
    (
      await authorizeStudioRequest(request({ authorization: "Bearer automation-secret" }), CONFIG, {
        allowAutomationSecret: true,
      })
    )?.status,
    401
  );
  assert.equal(
    (
      await authorizeStudioRequest(
        withSecret,
        { projectId: "testproj", apiVersion: "2099-01-31" },
        { allowAutomationSecret: true }
      )
    )?.status,
    401,
    "an unset secret never matches"
  );
});

test("secretsMatch compares by value", async () => {
  assert.equal(await secretsMatch("abc", "abc"), true);
  assert.equal(await secretsMatch("abc", "abd"), false);
  assert.equal(await secretsMatch("", "abc"), false);
});
