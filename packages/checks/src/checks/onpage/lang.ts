import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-07";

/** ONPAGE-07: <html lang> attribute presence and basic validity. */
export const langCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const lang = $("html").first().attr("lang")?.trim() ?? "";

    if (!lang) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Falta el atributo lang en <html>",
          severity: "warning",
          measuredValue: "sin lang",
          source: url,
          criterion: "El elemento <html> debe declarar el idioma de la página",
          recommendation:
            'Agrega el atributo lang al elemento <html> (por ejemplo lang="es") para que buscadores y lectores de pantalla identifiquen el idioma correctamente.',
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    const validFormat = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/i.test(lang);
    if (!validFormat) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Atributo lang con formato inválido",
          severity: "warning",
          measuredValue: lang,
          source: url,
          criterion: "El atributo lang debe seguir el formato BCP 47 (ej. es, es-MX, en-US)",
          recommendation: "Corrige el valor del atributo lang para que siga el formato BCP 47 (ej. es, es-MX, en-US).",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Atributo lang correcto",
        severity: "ok",
        measuredValue: lang,
        source: url,
        criterion: "El elemento <html> debe declarar el idioma de la página",
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
