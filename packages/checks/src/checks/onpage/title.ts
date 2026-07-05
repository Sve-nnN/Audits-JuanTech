import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-01";
const MIN_LENGTH = 30;
const MAX_LENGTH = 60;

/** Generic/placeholder titles that carry no real keyword signal. */
const GENERIC_TITLES = new Set([
  "home",
  "inicio",
  "untitled",
  "untitled document",
  "documento sin título",
  "new page",
  "página nueva",
  "index",
  "document",
]);

/** ONPAGE-01: title tag presence, length (30-60 chars) and generic-word quality. */
export const titleCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const raw = $("title").first().text().trim();
    const url = page.finalUrl ?? page.url;

    if (!raw) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Falta la etiqueta title",
          severity: "critical",
          measuredValue: "sin title",
          source: url,
          criterion: "Toda página indexable debe tener un <title> único y descriptivo",
          recommendation:
            "Agrega una etiqueta <title> de entre 30 y 60 caracteres que describa el contenido principal de la página e incluya la palabra clave objetivo.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const length = raw.length;
    const normalized = raw.toLowerCase();

    if (GENERIC_TITLES.has(normalized)) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Title genérico o de plantilla",
          severity: "warning",
          measuredValue: raw,
          source: url,
          criterion: "El title no debe ser un valor genérico sin señal de keyword",
          recommendation:
            "Reemplaza el title genérico por uno específico de esta página, con la palabra clave principal y entre 30 y 60 caracteres.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    if (length < MIN_LENGTH || length > MAX_LENGTH) {
      const tooShort = length < MIN_LENGTH;
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: tooShort ? "Title demasiado corto" : "Title demasiado largo",
          severity: "warning",
          measuredValue: `${length} caracteres`,
          source: url,
          criterion: `Longitud recomendada: ${MIN_LENGTH}-${MAX_LENGTH} caracteres`,
          recommendation: tooShort
            ? "Amplía el title para aprovechar mejor el espacio en resultados de búsqueda, manteniéndolo entre 30 y 60 caracteres."
            : "Acorta el title para que no se corte en los resultados de búsqueda, manteniéndolo entre 30 y 60 caracteres.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Title correcto",
        severity: "ok",
        measuredValue: `${length} caracteres`,
        source: url,
        criterion: `Longitud recomendada: ${MIN_LENGTH}-${MAX_LENGTH} caracteres`,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
