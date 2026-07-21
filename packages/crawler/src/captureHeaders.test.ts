import { describe, it, expect } from "vitest";
import { curateHeaders, parseCookieNames, CURATED_HEADER_KEYS } from "./captureHeaders";

describe("curateHeaders", () => {
  it("keeps only allowlisted keys present in the input, dropping the rest", () => {
    const out = curateHeaders({ server: "cloudflare", "cf-ray": "abc", "x-irrelevante": "z" });
    expect(out).toEqual({ server: "cloudflare", "cf-ray": "abc" });
    expect(out).not.toHaveProperty("x-irrelevante");
  });

  it("joins array header values with \", \" and omits absent/undefined keys", () => {
    const out = curateHeaders({ via: ["1.1 a", "1.1 b"], server: undefined });
    expect(out).toEqual({ via: "1.1 a, 1.1 b" });
    expect(out).not.toHaveProperty("server");
  });

  it("iterates over the allowlist, never over caller-controlled keys (no prototype pollution)", () => {
    const out = curateHeaders({ __proto__: "polluted", constructor: "x", server: "nginx" } as never);
    expect(out).toEqual({ server: "nginx" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Every emitted key must belong to the curated allowlist.
    for (const k of Object.keys(out)) {
      expect(CURATED_HEADER_KEYS).toContain(k);
    }
  });
});

describe("parseCookieNames", () => {
  it("extracts only cookie names (no values, no attributes) from a string[]", () => {
    const names = parseCookieNames(["session=abc; Path=/; HttpOnly", "wordpress_logged_in_x=y"]);
    expect(names).toEqual(["session", "wordpress_logged_in_x"]);
  });

  it("tolerates a single string (not an array) and returns the same shape", () => {
    expect(parseCookieNames("session=abc; Path=/; HttpOnly")).toEqual(["session"]);
  });

  it("deduplicates repeated names within the same page", () => {
    expect(parseCookieNames(["session=a", "session=b", "csrf=c"])).toEqual(["session", "csrf"]);
  });

  it("returns [] for undefined", () => {
    expect(parseCookieNames(undefined)).toEqual([]);
  });
});
