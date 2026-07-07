import { describe, it, expect } from "vitest";
import { toMarkdown } from "./markdown";
import { EXPORT_TOP_N } from "./priority";
import { buildModel, makeCandidates, makeIssue } from "./test-fixtures";

describe("toMarkdown", () => {
  it("includes domain, overall score and per-category scores", () => {
    const md = toMarkdown(buildModel({ overall: 72 }));
    expect(md).toContain("example.com");
    expect(md).toContain("72");
    // all five categories present in CATEGORY_ORDER
    expect(md).toContain("SEO Técnico");
    expect(md).toContain("Rendimiento / CWV");
    expect(md).toContain("On-Page");
    expect(md).toContain("Datos Estructurados");
    expect(md).toContain("AEO");
  });

  it("emits the 5 issue lines in fixed order: checkId -> page -> value -> criterion -> recommendation", () => {
    const issue = makeIssue({
      checkId: "ORDER-01",
      url: "https://example.com/ordenada",
      measuredValue: "MEDIDO-XYZ",
      criterion: "CRITERIO-XYZ",
      recommendation: "RECO-XYZ",
    });
    const md = toMarkdown(buildModel({ candidates: [issue] }));
    const posCheck = md.indexOf("ORDER-01");
    const posPage = md.indexOf("https://example.com/ordenada");
    const posValue = md.indexOf("MEDIDO-XYZ");
    const posCriterion = md.indexOf("CRITERIO-XYZ");
    const posReco = md.indexOf("RECO-XYZ");
    expect(posCheck).toBeGreaterThanOrEqual(0);
    expect(posCheck).toBeLessThan(posPage);
    expect(posPage).toBeLessThan(posValue);
    expect(posValue).toBeLessThan(posCriterion);
    expect(posCriterion).toBeLessThan(posReco);
  });

  it("feeds priorityCandidates (not priorityIssues) to the cap: 70 candidates / 60 priorityIssues -> nota '50 de 70'", () => {
    const model = buildModel({ candidatesCount: 70, priorityIssuesCount: 60 });
    // sanity: priorityIssues is the 60-row screen cap, distinct from candidates
    expect(model.priorityIssues).toHaveLength(60);
    expect(model.priorityCandidates).toHaveLength(70);
    const md = toMarkdown(model);
    expect(md).toContain("50");
    expect(md).toContain("70");
    expect(md).not.toContain("60 de");
  });

  it("does not emit a cap note when candidates <= N", () => {
    const md = toMarkdown(buildModel({ candidatesCount: 10 }));
    expect(md).not.toMatch(/Mostrando \d+ de \d+/);
  });

  it("preserves accents and ñ verbatim", () => {
    const issue = makeIssue({ title: "áéíóúñ¿¡", recommendation: "áéíóúñ¿¡" });
    const md = toMarkdown(buildModel({ candidates: [issue] }));
    expect(md).toContain("áéíóúñ¿¡");
  });

  it("emits at most EXPORT_TOP_N issue sections", () => {
    const md = toMarkdown(buildModel({ candidates: makeCandidates(80) }));
    const sections = md.match(/CHECK-\d{3}/g) ?? [];
    expect(sections.length).toBeLessThanOrEqual(EXPORT_TOP_N);
  });
});
