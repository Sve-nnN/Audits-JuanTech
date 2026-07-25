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

  it("keeps the Hostinger origin headers that pass through a fronting CDN (platform, panel)", () => {
    // Regresión (fingerprint-cms-not-detected): ariannalupi.com sirve detrás de
    // Cloudflare pero deja pasar `platform: hostinger` / `panel: hpanel`. Sin
    // capturarlos, la signature hosting.hostinger nunca los ve y el eje hosting
    // queda no-detectado pese a haber señal.
    const out = curateHeaders({
      server: "cloudflare",
      "cf-ray": "a20c7d15aa6b6d1d-AMS",
      platform: "hostinger",
      panel: "hpanel",
    });
    expect(out).toMatchObject({ platform: "hostinger", panel: "hpanel" });
  });

  it("keeps the Vercel/Netlify/WP Engine origin headers that fingerprint signatures read", () => {
    // Regresión (fingerprint-hosting-headers-dropped): estas signatures de hosting
    // referencian headers que el allowlist NO capturaba => código muerto. Invariante:
    // el allowlist es superset de todo header que una signature lee. aprendoclub.com
    // (Vercel tras Cloudflare) quedaba hosting=no-detectado por esto.
    const out = curateHeaders({
      server: "cloudflare",
      "x-vercel-id": "fra1::abc",
      "x-vercel-cache": "HIT",
      "x-nf-request-id": "nf-123",
      "x-wpe-loopback-upstream-addr": "10.0.0.1",
      "x-wpengine-lb": "lb-1",
    });
    expect(out).toMatchObject({
      "x-vercel-id": "fra1::abc",
      "x-vercel-cache": "HIT",
      "x-nf-request-id": "nf-123",
      "x-wpe-loopback-upstream-addr": "10.0.0.1",
      "x-wpengine-lb": "lb-1",
    });
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
