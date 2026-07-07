import { describe, expect, it } from "vitest";
import { canonicalDeep } from "./canonicalDeep";
import { makePage } from "../../testUtils";

const ORIGIN = "https://example.com";

function withCanonical(href: string, opts?: { noindex?: boolean }): string {
  const robots = opts?.noindex ? '<meta name="robots" content="noindex">' : "";
  return `<html><head>${robots}<link rel="canonical" href="${href}"></head><body><p>contenido</p></body></html>`;
}

function run(pages: ReturnType<typeof makePage>[]) {
  return canonicalDeep.run({ pages, origin: ORIGIN, sitemapUrls: [] });
}

/** Finds issues emitted for a given page url. */
function forPage(issues: ReturnType<typeof run>, url: string) {
  return issues.filter((i) => i.source === url);
}

describe("canonicalDeep (TECH-04 deep)", () => {
  it("TECH-04:multiple-conflicting — >1 canonical con hrefs distintos (WARNING)", () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/a"><link rel="canonical" href="https://example.com/b"></head><body>x</body></html>`;
    const p = makePage({ url: "https://example.com/p", html });
    const issues = run([p]);
    const hit = issues.find((i) => i.fingerprint.includes("TECH-04:multiple-conflicting"));
    expect(hit?.severity).toBe("warning");
  });

  it("TECH-04:relative — href no absoluto (WARNING)", () => {
    const p = makePage({ url: "https://example.com/p", html: withCanonical("/relativa") });
    const issues = run([p]);
    const hit = issues.find((i) => i.fingerprint.includes("TECH-04:relative"));
    expect(hit?.severity).toBe("warning");
  });

  it("TECH-04:noindex-conflict — canonical + noindex en la misma página (CRITICAL)", () => {
    const p = makePage({
      url: "https://example.com/p",
      html: withCanonical("https://example.com/p", { noindex: true }),
    });
    const issues = run([p]);
    const hit = issues.find((i) => i.fingerprint.includes("TECH-04:noindex-conflict"));
    expect(hit?.severity).toBe("critical");
  });

  it("TECH-04:noindex-target — destino en el set con noindex (CRITICAL)", () => {
    const src = makePage({ url: "https://example.com/src", html: withCanonical("https://example.com/dst") });
    const dst = makePage({
      url: "https://example.com/dst",
      html: withCanonical("https://example.com/dst", { noindex: true }),
    });
    const issues = run([src, dst]);
    const hit = forPage(issues, "https://example.com/src").find((i) =>
      i.fingerprint.includes("TECH-04:noindex-target")
    );
    expect(hit?.severity).toBe("critical");
  });

  it("TECH-04:redirect-target — destino con statusCode 3xx (CRITICAL)", () => {
    const src = makePage({ url: "https://example.com/src", html: withCanonical("https://example.com/dst") });
    const dst = makePage({
      url: "https://example.com/dst",
      html: withCanonical("https://example.com/dst"),
      statusCode: 301,
    });
    const issues = run([src, dst]);
    const hit = forPage(issues, "https://example.com/src").find((i) =>
      i.fingerprint.includes("TECH-04:redirect-target")
    );
    expect(hit?.severity).toBe("critical");
  });

  it("TECH-04:http-error-target — destino con statusCode 4xx/5xx (CRITICAL)", () => {
    const src = makePage({ url: "https://example.com/src", html: withCanonical("https://example.com/dst") });
    const dst = makePage({
      url: "https://example.com/dst",
      html: withCanonical("https://example.com/dst"),
      statusCode: 404,
    });
    const issues = run([src, dst]);
    const hit = forPage(issues, "https://example.com/src").find((i) =>
      i.fingerprint.includes("TECH-04:http-error-target")
    );
    expect(hit?.severity).toBe("critical");
  });

  it("TECH-04:chain — destino declara a su vez otra canonical distinta (CRITICAL)", () => {
    const src = makePage({ url: "https://example.com/src", html: withCanonical("https://example.com/dst") });
    const dst = makePage({
      url: "https://example.com/dst",
      html: withCanonical("https://example.com/third"),
    });
    const issues = run([src, dst]);
    const hit = forPage(issues, "https://example.com/src").find((i) => i.fingerprint.includes("TECH-04:chain"));
    expect(hit?.severity).toBe("critical");
  });

  it("TECH-04:final-url-mismatch — el destino resuelve a otra finalUrl (WARNING)", () => {
    const src = makePage({ url: "https://example.com/src", html: withCanonical("https://example.com/old") });
    const dst = makePage({
      url: "https://example.com/old",
      finalUrl: "https://example.com/new",
      html: withCanonical("https://example.com/new"),
    });
    const issues = run([src, dst]);
    const hit = forPage(issues, "https://example.com/src").find((i) =>
      i.fingerprint.includes("TECH-04:final-url-mismatch")
    );
    expect(hit?.severity).toBe("warning");
  });

  it("TECH-04:cross-domain — host del destino distinto del de la página (WARNING)", () => {
    const p = makePage({ url: "https://example.com/p", html: withCanonical("https://otro-dominio.com/x") });
    const issues = run([p]);
    const hit = issues.find((i) => i.fingerprint.includes("TECH-04:cross-domain"));
    expect(hit?.severity).toBe("warning");
  });

  it("skip silencioso — destino same-domain ausente del set no genera issue", () => {
    const p = makePage({ url: "https://example.com/p", html: withCanonical("https://example.com/no-existe") });
    const issues = run([p]);
    expect(issues.length).toBe(0);
  });

  it("no-colapso — dos subtipos en una página producen fingerprints distintos", () => {
    // Página con noindex propio (noindex-conflict) + canonical a destino 3xx (redirect-target).
    const src = makePage({
      url: "https://example.com/src",
      html: withCanonical("https://example.com/dst", { noindex: true }),
    });
    const dst = makePage({
      url: "https://example.com/dst",
      html: withCanonical("https://example.com/dst"),
      statusCode: 302,
    });
    const issues = forPage(run([src, dst]), "https://example.com/src");
    expect(issues.length).toBeGreaterThanOrEqual(2);
    const fingerprints = issues.map((i) => i.fingerprint);
    expect(new Set(fingerprints).size).toBe(issues.length);
  });
});
