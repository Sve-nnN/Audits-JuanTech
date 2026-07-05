import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "TECH-03";

/** TECH-03: HTTP status code per page; flags internal 4xx/5xx. */
export const httpStatusCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page }) {
    const url = page.finalUrl ?? page.url;
    const status = page.statusCode;

    if (status === null || status === undefined) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Página no respondió (error de red)",
          severity: "critical",
          measuredValue: page.error ?? "sin respuesta",
          source: url,
          criterion: "Toda página interna debe responder con un código HTTP",
          recommendation: "Investiga por qué esta URL no respondió (timeout, DNS, conexión rechazada) y corrige el acceso al recurso.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    if (status >= 500) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Página interna con error de servidor",
          severity: "critical",
          measuredValue: `HTTP ${status}`,
          source: url,
          criterion: "Las páginas internas deben responder 2xx (o 3xx controlado)",
          recommendation: "Revisa el servidor/aplicación: esta URL está devolviendo un error 5xx a los visitantes y a los buscadores.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    if (status >= 400) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Página interna rota (404 u otro 4xx)",
          severity: "critical",
          measuredValue: `HTTP ${status}`,
          source: url,
          criterion: "Las páginas internas enlazadas no deben devolver 4xx",
          recommendation: "Corrige o elimina los enlaces internos hacia esta URL, o restaura el contenido si debería existir.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "Código HTTP correcto",
        severity: "ok",
        measuredValue: `HTTP ${status}`,
        source: url,
        criterion: "Las páginas internas deben responder 2xx (o 3xx controlado)",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
