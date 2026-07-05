import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "AEO-04";

const QUESTION_WORDS =
  /^(qué|que|cómo|como|cuándo|cuando|dónde|donde|por qué|por que|cuál|cual|quién|quien|cuánto|cuanto|para qué|para que|is|what|how|why|when|where|which|who|does|can|should)\b/i;

function isQuestionHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.endsWith("?")) return true;
  return QUESTION_WORDS.test(trimmed);
}

/** AEO-04: content format for AI extraction — question-phrased headings, lists/tables, average paragraph length. */
export const contentFormatCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;

    const headings = $("h2, h3")
      .toArray()
      .map((el) => $(el).text());
    const questionHeadings = headings.filter(isQuestionHeading);
    const lists = $("ul, ol").length;
    const tables = $("table").length;

    const paragraphs = $("p")
      .toArray()
      .map((el) => $(el).text().trim())
      .filter((t) => t.length > 0);
    const avgParagraphWords =
      paragraphs.length > 0
        ? Math.round(
            paragraphs.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0) /
              paragraphs.length
          )
        : 0;

    const measuredValue = `${questionHeadings.length}/${headings.length} encabezados como pregunta, ${lists} lista(s), ${tables} tabla(s), ${avgParagraphWords} palabras/párrafo (promedio)`;

    const hasExtractableFormat = questionHeadings.length > 0 || lists > 0 || tables > 0;
    const goodParagraphs = paragraphs.length === 0 || avgParagraphWords <= 150;
    const goodFormat = hasExtractableFormat && goodParagraphs;

    return [
      {
        checkId: CHECK_ID,
        category: "aeo",
        title: "Formato de contenido para extracción por IA",
        severity: goodFormat ? "ok" : "warning",
        measuredValue,
        source: url,
        criterion:
          "Encabezados en formato de pregunta, listas/tablas y párrafos concisos facilitan la extracción de respuestas por motores de IA",
        recommendation: goodFormat
          ? "Sin acción necesaria."
          : "Estructura el contenido con encabezados en forma de pregunta, listas o tablas cuando aplique, y párrafos concisos (idealmente bajo 150 palabras) para facilitar la extracción por motores de IA.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
