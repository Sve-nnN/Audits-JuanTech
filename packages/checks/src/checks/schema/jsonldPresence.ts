import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks } from "./extract";

const CHECK_ID = "SD-01";

/** SD-01: presence of JSON-LD (`<script type="application/ld+json">`) blocks. */
export const jsonldPresenceCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const blocks = extractJsonLdBlocks($);

    if (blocks.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "schema",
          title: "Sin datos estructurados (JSON-LD)",
          severity: "warning",
          measuredValue: "0 bloques",
          source: url,
          criterion: "La página debería incluir al menos un bloque JSON-LD (schema.org)",
          recommendation:
            "Agrega datos estructurados JSON-LD relevantes para esta página (por ejemplo Organization, WebPage o el tipo que corresponda al contenido) para mejorar la comprensión por buscadores y motores de IA.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "schema",
        title: "Datos estructurados presentes",
        severity: "ok",
        measuredValue: `${blocks.length} bloque(s) JSON-LD`,
        source: url,
        criterion: "La página debería incluir al menos un bloque JSON-LD (schema.org)",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
