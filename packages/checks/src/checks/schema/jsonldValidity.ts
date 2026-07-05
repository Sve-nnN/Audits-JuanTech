import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks } from "./extract";

const CHECK_ID = "SD-02";

/** SD-02: every JSON-LD block must be syntactically valid JSON; reports invalid blocks with their parse error. */
export const jsonldValidityCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const blocks = extractJsonLdBlocks($);

    // SD-01 already reports absence; nothing to validate here.
    if (blocks.length === 0) return [];

    const invalid = blocks.filter((b) => b.error !== undefined);

    if (invalid.length > 0) {
      const details = invalid.map((b) => `bloque #${b.index + 1}: ${b.error}`).join("; ");
      return [
        {
          checkId: CHECK_ID,
          category: "schema",
          title: "Bloques JSON-LD con JSON inválido",
          severity: "critical",
          measuredValue: `${invalid.length}/${blocks.length} bloque(s) inválido(s) — ${details}`,
          source: url,
          criterion: "Todo bloque JSON-LD debe ser JSON sintácticamente válido",
          recommendation:
            "Corrige la sintaxis JSON de los bloques marcados (comas, comillas, llaves) para que los buscadores y motores de IA puedan interpretarlos.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "schema",
        title: "Todos los bloques JSON-LD son válidos",
        severity: "ok",
        measuredValue: `${blocks.length}/${blocks.length} bloque(s) válido(s)`,
        source: url,
        criterion: "Todo bloque JSON-LD debe ser JSON sintácticamente válido",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
