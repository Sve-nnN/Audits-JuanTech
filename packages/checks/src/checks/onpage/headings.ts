import type { IssueDraft, PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-08";

interface Heading {
  level: number;
  text: string;
}

/** Normaliza texto de heading/title para comparaciones: colapsa espacios, minúsculas. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * ONPAGE-08: jerarquía de encabezados.
 *
 * Emite un IssueDraft POR subtipo detectado (nunca agregados), cada uno con su
 * fingerprint sub-tipado para que el diff no colapse múltiples hallazgos por página:
 *   - ONPAGE-08:skip         salto de nivel descendente > 1 (p. ej. H1→H3 sin H2)
 *   - ONPAGE-08:empty        algún heading H1–H6 con texto vacío
 *   - ONPAGE-08:order        secuencia fuera de orden (el primer heading no es H1)
 *   - ONPAGE-08:h1-dup-title un único H1 cuyo texto duplica el <title>
 *
 * El conteo/unicidad de H1 lo mantiene ONPAGE-03 (h1.ts), intacto.
 */
export const headingsCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;

    // Recolecta en orden de documento todos los h1..h6 con nivel numérico y texto trim.
    const headings: Heading[] = $("h1, h2, h3, h4, h5, h6")
      .map((_i, el) => {
        const tag = (el as { tagName?: string; name?: string }).tagName ??
          (el as { name?: string }).name ??
          "";
        const level = Number.parseInt(tag.slice(1), 10);
        return { level, text: $(el).text().trim() };
      })
      .get()
      .filter((h) => Number.isFinite(h.level) && h.level >= 1 && h.level <= 6);

    // Página sin headings → no aplica ONPAGE-08 (el faltante de H1 lo cubre ONPAGE-03).
    if (headings.length === 0) return [];

    const issues: IssueDraft[] = [];
    const push = (subtype: string, title: string, criterion: string, recommendation: string, measuredValue?: string) => {
      issues.push({
        checkId: CHECK_ID,
        category: "onpage",
        title,
        severity: "warning",
        measuredValue,
        source: url,
        criterion,
        recommendation,
        fingerprint: pageFingerprint(`${CHECK_ID}:${subtype}`, url),
        pageId: page.id,
      });
    };

    // ONPAGE-08:skip — salto de nivel descendente > 1 respecto al heading previo.
    let hasSkip = false;
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const cur = headings[i];
      if (prev && cur && cur.level - prev.level > 1) {
        hasSkip = true;
        break;
      }
    }
    if (hasSkip) {
      push(
        "skip",
        "Salto de nivel en los encabezados",
        "La jerarquía de encabezados no debe saltar niveles (p. ej. H1→H3 sin H2)",
        "No saltes niveles de encabezado: usa H2 antes de H3, H3 antes de H4, etc.",
      );
    }

    // ONPAGE-08:empty — algún heading H1–H6 vacío tras trim.
    if (headings.some((h) => h.text.length === 0)) {
      push(
        "empty",
        "Encabezado vacío",
        "Ningún encabezado H1–H6 debe estar vacío",
        "Elimina los encabezados vacíos o dales un texto descriptivo.",
      );
    }

    // ONPAGE-08:order — secuencia fuera de orden: el primer heading no es H1.
    const first = headings[0];
    if (first && first.level !== 1) {
      push(
        "order",
        "Encabezados fuera de orden",
        "El primer encabezado de la página debe ser un H1",
        `Comienza la jerarquía con un H1; el primer encabezado es H${first.level}.`,
        `H${first.level}`,
      );
    }

    // ONPAGE-08:h1-dup-title — un único H1 cuyo texto duplica el <title>.
    const h1s = headings.filter((h) => h.level === 1);
    const soleH1 = h1s.length === 1 ? h1s[0] : undefined;
    if (soleH1) {
      const titleText = normalize($("title").text());
      if (titleText.length > 0 && normalize(soleH1.text) === titleText) {
        push(
          "h1-dup-title",
          "El H1 duplica el título de la página",
          "El H1 debe aportar contexto y no ser una copia literal del <title>",
          "Diferencia el H1 del <title> para evitar redundancia y aprovechar ambos espacios.",
          soleH1.text,
        );
      }
    }

    return issues;
  },
};
