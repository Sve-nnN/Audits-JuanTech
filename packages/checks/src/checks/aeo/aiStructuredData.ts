import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes, hasProp, typesOf } from "../schema/extract";

const CHECK_ID = "AEO-03";

/** AEO-03: AI-answer-oriented structured data — FAQPage, Article/BlogPosting fields, Organization/Person sameAs. */
export const aiStructuredDataCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const nodes = flattenNodes(extractJsonLdBlocks($));
    if (nodes.length === 0) return [];

    const signals: string[] = [];
    const gaps: string[] = [];

    for (const node of nodes) {
      const types = typesOf(node.data);

      if (types.includes("FAQPage")) {
        if (hasProp(node.data, "mainEntity")) signals.push("FAQPage con preguntas");
        else gaps.push("FAQPage sin mainEntity");
      }

      const articleType = types.find((t) => t === "Article" || t === "BlogPosting");
      if (articleType) {
        const missing = ["headline", "author", "datePublished"].filter((p) => !hasProp(node.data, p));
        if (missing.length === 0) signals.push(`${articleType} con campos completos`);
        else gaps.push(`${articleType} sin ${missing.join(", ")}`);
      }

      const entityType = types.find((t) => t === "Organization" || t === "Person");
      if (entityType) {
        if (hasProp(node.data, "sameAs")) signals.push(`${entityType} con sameAs`);
        else gaps.push(`${entityType} sin sameAs`);
      }
    }

    if (signals.length === 0 && gaps.length === 0) return [];

    const severity = gaps.length > 0 ? "warning" : "ok";

    return [
      {
        checkId: CHECK_ID,
        category: "aeo",
        title: "Datos estructurados orientados a IA",
        severity,
        measuredValue: [...signals, ...gaps].join("; "),
        source: url,
        criterion:
          "FAQPage, Article/BlogPosting con campos completos y Organization/Person con sameAs mejoran la elegibilidad en respuestas de motores de IA",
        recommendation:
          gaps.length > 0
            ? `Completa los campos faltantes para maximizar la elegibilidad ante motores de IA: ${gaps.join("; ")}.`
            : "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
