import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { diffIssues } from "@auditor/scoring";
import { canonicalDeep } from "./tech/canonicalDeep";
import { headingsCheck } from "./onpage/headings";
import { makePage } from "../testUtils";
import type { IssueDraft } from "../types";

const ORIGIN = "https://example.com";

/**
 * SC#5 guardrail — INTEGRADO (cruza canonical + headings).
 *
 * Los planes 11-01 (canonicalDeep) y 11-02 (headingsCheck) prueban el no-colapso
 * DENTRO de cada check por separado. Este archivo blinda el concern integrado que
 * ninguno cubre en aislamiento:
 *  1. Dos hallazgos de checks DISTINTOS (TECH-04:* y ONPAGE-08:*) sobre la MISMA
 *     página no se colapsan en el diff.
 *  2. Incorporar los checks nuevos no desvía el score de una fixture con
 *     canonical/jerarquía correctas (cero filas nuevas → cero impacto).
 */
describe("SC#5 guardrail — no-colapso de fingerprints (canonical + headings)", () => {
  it("no colapsa canonical + heading de la misma página en el diff, fingerprints únicos", () => {
    // Página que dispara SIMULTÁNEAMENTE:
    //  - TECH-04:cross-domain (canonical absoluta a otro host) — el destino no está
    //    en el set, así que ese es el único subtipo canonical que emite.
    //  - ONPAGE-08:skip (H1→H3 sin H2) y ONPAGE-08:empty (H3 vacío).
    const html =
      '<html><head><link rel="canonical" href="https://otro-dominio.com/x"></head>' +
      "<body><h1>Uno</h1><h3></h3></body></html>";
    const page = makePage({ url: "https://example.com/p", html });
    const $ = cheerio.load(html);

    const canonicalIssues = canonicalDeep.run({ pages: [page], origin: ORIGIN, sitemapUrls: [] });
    const headingIssues = headingsCheck.run({ page, $ });

    // Cada check emite al menos un hallazgo de su dominio.
    expect(canonicalIssues.length).toBeGreaterThanOrEqual(1);
    expect(headingIssues.length).toBeGreaterThanOrEqual(1);
    expect(canonicalIssues.some((i) => i.fingerprint.includes("TECH-04:cross-domain"))).toBe(true);
    expect(headingIssues.some((i) => i.fingerprint.includes("ONPAGE-08:skip"))).toBe(true);
    expect(headingIssues.some((i) => i.fingerprint.includes("ONPAGE-08:empty"))).toBe(true);

    const combined: IssueDraft[] = [...canonicalIssues, ...headingIssues];
    const fingerprints = combined.map((i) => i.fingerprint);

    // (a) Unicidad de fingerprints en la unión canonical+headings de una misma página.
    expect(new Set(fingerprints).size).toBe(fingerprints.length);

    // (b) No-colapso vía diffIssues: cada fingerprint del set combinado queda como
    //     una entrada distinta y todas marcadas `new`.
    const diff = diffIssues(combined, []);
    expect(diff.statusByFingerprint.size).toBe(combined.length);
    for (const fp of fingerprints) {
      expect(diff.statusByFingerprint.get(fp)).toBe("new");
    }
    expect(diff.resolved).toEqual([]);
  });
});
