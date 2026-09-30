import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { hasCookie, setCookie } from "./cookies";

// `document.cookie` is a browser API; these stand in for the two things the helper reads from it.
// Cast through `unknown`: under Node there is no DOM to intersect these shapes with.
type CookieGlobals = { document?: { cookie: string }; window?: { location: { protocol: string } } };

const globals = globalThis as unknown as CookieGlobals;

function stub({ protocol = "https:", jar = "" } = {}) {
  globals.document = { cookie: jar };
  globals.window = { location: { protocol } };
}

beforeEach(() => stub());

afterEach(() => {
  globals.document = undefined;
  globals.window = undefined;
});

describe("setCookie", () => {
  it("scopes to the site, expires, and defends against cross-site sends", () => {
    setCookie("dismissed", "1", 60);

    assert.equal(globals.document?.cookie, "dismissed=1; Path=/; Max-Age=60; SameSite=Lax; Secure");
  });

  it("drops Secure over http, which the browser would reject", () => {
    stub({ protocol: "http:" });
    setCookie("dismissed", "1", 60);

    assert.equal(globals.document?.cookie, "dismissed=1; Path=/; Max-Age=60; SameSite=Lax");
  });
});

describe("hasCookie", () => {
  it("finds the cookie first, last, or between others", () => {
    for (const jar of ["dismissed=1", "dismissed=1; other=1", "other=1; dismissed=1", "a=1; dismissed=1; b=2"]) {
      stub({ jar });

      assert.equal(hasCookie("dismissed"), true, jar);
    }
  });

  it("is false when the jar is empty or holds only other cookies", () => {
    for (const jar of ["", "other=1", "other=1; another=2"]) {
      stub({ jar });

      assert.equal(hasCookie("dismissed"), false, jar);
    }
  });

  it("does not match a cookie whose name merely starts with the one asked for", () => {
    stub({ jar: "dismissed_guess=1" });

    assert.equal(hasCookie("dismissed"), false);
  });
});
