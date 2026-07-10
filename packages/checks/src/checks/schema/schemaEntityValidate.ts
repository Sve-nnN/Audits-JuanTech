import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes } from "./extract";
import { validateEntities } from "./validateEntities";

const CHECK_ID = "SD-07";

/**
 * SD-07: envuelve el motor puro `validateEntities` para el pipeline de scoring.
 *
 * Reemplaza la validación por-propiedad de SD-04 (que emitía `critical`) SIN
 * poder tumbar duro el score: cualquier hallazgo del motor (entidad en "error"
 * o "warning") se mapea a `warning`; si todas las entidades quedan "ok" (o no
 * hay tipos conocidos), emite un único `ok`. Nunca emite `critical` (decisión
 * de la fase: schema no debe destruir el score; warning = 0.5 de health).
 */
export const schemaEntityValidateCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const nodes = flattenNodes(extractJsonLdBlocks($));
    if (nodes.length === 0) return [];

    const results = validateEntities(nodes.map((n) => n.data));
    const flagged = results.filter((r) => r.status !== "ok");

    if (flagged.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "schema",
          title: "Entidades JSON-LD válidas por propiedad",
          severity: "ok",
          measuredValue: `${results.length} entidad(es) sin propiedades requeridas/recomendadas faltantes`,
          source: url,
          criterion: "Cada entidad de tipo conocido incluye sus propiedades requeridas y recomendadas",
          recommendation: "Sin acción necesaria.",
          fingerprint: pageFingerprint(CHECK_ID, `${url}:ok`),
          pageId: page.id,
        },
      ];
    }

    const tipos = flagged.map((r) => r.type).filter(Boolean).join(", ");
    const totalObservaciones = flagged.reduce((sum, r) => sum + r.issues.length, 0);
    const detalle = flagged
      .flatMap((r) => r.issues.map((i) => `${r.type}: ${i.message}`))
      .join(" | ");

    return [
      {
        checkId: CHECK_ID,
        category: "schema",
        title: "Entidades JSON-LD con propiedades faltantes o incompletas",
        severity: "warning",
        measuredValue: `${flagged.length} entidad(es) con observaciones (${totalObservaciones}) en: ${tipos}`,
        source: url,
        criterion: "Cada entidad debería incluir sus propiedades requeridas y recomendadas según schema.org",
        recommendation: `Revisa y completa las propiedades señaladas: ${detalle}`,
        fingerprint: pageFingerprint(CHECK_ID, `${url}:warning`),
        pageId: page.id,
      },
    ];
  },
};
