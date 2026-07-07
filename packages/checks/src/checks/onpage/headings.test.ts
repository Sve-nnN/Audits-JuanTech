import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { headingsCheck } from "./headings";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return headingsCheck.run({ page, $ });
}

function fp(issues: ReturnType<typeof run>, subtype: string) {
  return issues.find((i) => i.fingerprint.includes(`ONPAGE-08:${subtype}`));
}

describe("headingsCheck (ONPAGE-08)", () => {
  it("flags a level skip (H1→H3 sin H2) as warning", () => {
    const issues = run("<html><body><h1>Uno</h1><h3>Tres</h3></body></html>");
    const skip = fp(issues, "skip");
    expect(skip?.severity).toBe("warning");
    expect(skip?.fingerprint).toContain("ONPAGE-08:skip");
  });

  it("flags an empty heading as warning", () => {
    const issues = run("<html><body><h1>Uno</h1><h2></h2></body></html>");
    const empty = fp(issues, "empty");
    expect(empty?.severity).toBe("warning");
    expect(empty?.fingerprint).toContain("ONPAGE-08:empty");
  });

  it("flags out-of-order headings (first not H1) as warning", () => {
    const issues = run("<html><body><h2>Dos</h2><h3>Tres</h3></body></html>");
    const order = fp(issues, "order");
    expect(order?.severity).toBe("warning");
    expect(order?.fingerprint).toContain("ONPAGE-08:order");
  });

  it("flags an H1 that duplicates the title as warning", () => {
    const issues = run(
      "<html><head><title>Mi Página</title></head><body><h1>Mi Página</h1><h2>Sub</h2></body></html>",
    );
    const dup = fp(issues, "h1-dup-title");
    expect(dup?.severity).toBe("warning");
    expect(dup?.fingerprint).toContain("ONPAGE-08:h1-dup-title");
  });

  it("does NOT collapse simultaneous subtypes: distinct fingerprints per subtype", () => {
    // skip (H2→H4) + empty (H2 vacío) + order (empieza en H2)
    const issues = run(
      "<html><body><h2></h2><h4>Cuatro</h4></body></html>",
    );
    const fingerprints = issues.map((i) => i.fingerprint);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fingerprints).size).toBe(issues.length);
    expect(fp(issues, "skip")).toBeDefined();
    expect(fp(issues, "empty")).toBeDefined();
    expect(fp(issues, "order")).toBeDefined();
  });

  it("emits nothing for a clean hierarchy (H1→H2→H3, sin vacíos, H1 ≠ title)", () => {
    const issues = run(
      "<html><head><title>Título distinto</title></head><body><h1>Tema principal</h1><h2>Sección</h2><h3>Detalle</h3></body></html>",
    );
    expect(issues).toEqual([]);
  });

  it("emits nothing for a page without headings (ONPAGE-03 cubre el H1 faltante)", () => {
    const issues = run("<html><body><p>sin encabezados</p></body></html>");
    expect(issues).toEqual([]);
  });
});
