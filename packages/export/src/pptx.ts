import PptxGenJS from "pptxgenjs";
import type { ReportModel, ReportIssue } from "@auditor/report-model";
import type { Category } from "@auditor/scoring";
import { prioritizeIssues } from "./priority";
import {
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  STATUS_LABEL,
  SEVERITY_LABEL,
} from "./labels";

/**
 * PPTX serializer (EXPORT-03). Pure JS via `pptxgenjs` — no headless-browser
 * engine of any kind (per CLAUDE.md "What NOT to Use"); this module imports only
 * `pptxgenjs` and the local report model.
 *
 * Slide-count guarantee — ALWAYS in [7, 12], even for sparse audits:
 *
 *   total = BASE_SLIDES (7, fixed) + issueSlides (0..MAX_ISSUE_SLIDES=5)
 *
 * BASE_SLIDES (always present, regardless of issue count):
 *   1  Portada        — dominio + score general + status
 *   2  Resumen        — score general destacado + status
 *   3..7 Categorías   — una slide por cada CATEGORY_ORDER (tech, perf, onpage,
 *                       schema, aeo); "sin datos" cuando la categoría no puntúa.
 * This guarantees the floor of 7 even with zero issues.
 *
 * issueSlides (0..5): the prioritized issues (shared cap over
 * `model.priorityCandidates`) paginated into at most 5 slides. Zero issues ->
 * zero extra slides -> total 7. The "mostrando N de M" note (when capped) goes
 * on the footer of the last issue slide, or the Resumen slide if none.
 */

/** Fixed base slides: portada + resumen + 5 categorías. */
const BASE_SLIDES = 7;
/** Cap on prioritized-issue slides so total never exceeds 12. */
const MAX_ISSUE_SLIDES = 5;
/** How many issues to render per issue slide. */
const ISSUES_PER_SLIDE = 10;

export interface PptxDeck {
  pptx: PptxGenJS;
  /** Number of slides added (always in [7, 12]). */
  slideCount: number;
}

function scoreText(score: number | null | undefined): string {
  return score === null || score === undefined ? "no disponible" : `${score} / 100`;
}

/**
 * Build the PptxGenJS deck (slides added, not yet serialized). Exposed so tests
 * can assert the slide count via the pptxgenjs API before `write`.
 */
export function buildPptxDeck(model: ReportModel): PptxDeck {
  const pptx = new PptxGenJS();
  pptx.author = "juan-tech.com";
  pptx.company = "juan-tech.com";
  pptx.title = `Auditoría web — ${model.audit.domain}`;

  let slideCount = 0;
  const addSlide = () => {
    slideCount += 1;
    return pptx.addSlide();
  };

  const prioritized = prioritizeIssues(model.priorityCandidates);
  const capNote = prioritized.note;

  // --- Slide 1: Portada ---
  const cover = addSlide();
  cover.addText("Auditoría web", { x: 0.5, y: 0.6, w: 9, h: 0.8, fontSize: 32, bold: true });
  cover.addText(model.audit.domain, { x: 0.5, y: 1.6, w: 9, h: 0.6, fontSize: 24 });
  cover.addText(
    `Score general: ${scoreText(model.overall)}  ·  ${STATUS_LABEL[model.status]}`,
    { x: 0.5, y: 2.4, w: 9, h: 0.6, fontSize: 18 }
  );

  // --- Slide 2: Resumen ---
  const summary = addSlide();
  summary.addText("Resumen", { x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 28, bold: true });
  summary.addText(scoreText(model.overall), {
    x: 0.5,
    y: 1.4,
    w: 9,
    h: 1.5,
    fontSize: 60,
    bold: true,
    align: "center",
  });
  summary.addText(STATUS_LABEL[model.status], {
    x: 0.5,
    y: 3.0,
    w: 9,
    h: 0.6,
    fontSize: 20,
    align: "center",
  });

  // --- Slides 3..7: una por categoría (piso garantizado) ---
  for (const category of CATEGORY_ORDER) {
    const slide = addSlide();
    const result = model.byCategory[category as Category];
    slide.addText(CATEGORY_LABEL[category], {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.7,
      fontSize: 26,
      bold: true,
    });
    if (result) {
      slide.addText(scoreText(result.score), {
        x: 0.5,
        y: 1.4,
        w: 9,
        h: 1.2,
        fontSize: 48,
        bold: true,
        align: "center",
      });
      slide.addText(STATUS_LABEL[result.status], {
        x: 0.5,
        y: 2.7,
        w: 9,
        h: 0.6,
        fontSize: 18,
        align: "center",
      });
    } else {
      slide.addText("sin datos", {
        x: 0.5,
        y: 1.6,
        w: 9,
        h: 1.0,
        fontSize: 28,
        align: "center",
        color: "888888",
      });
    }
  }

  // --- Slides adicionales: issues priorizados (0..MAX_ISSUE_SLIDES) ---
  const issues = prioritized.issues;
  const neededSlides = Math.ceil(issues.length / ISSUES_PER_SLIDE);
  const issueSlideCount = Math.min(neededSlides, MAX_ISSUE_SLIDES);

  for (let s = 0; s < issueSlideCount; s += 1) {
    const slide = addSlide();
    const chunk = issues.slice(s * ISSUES_PER_SLIDE, (s + 1) * ISSUES_PER_SLIDE);
    slide.addText(`Issues priorizados (${s + 1}/${issueSlideCount})`, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 22,
      bold: true,
    });
    const body = chunk.map((issue: ReportIssue) => {
      const label = SEVERITY_LABEL[issue.severity] ?? issue.severity;
      const where = issue.url ?? issue.source ?? "—";
      const reco = issue.recommendation ?? "";
      return {
        text: `[${issue.checkId}] ${issue.title} (${label}) — ${where}${reco ? `: ${reco}` : ""}`,
        options: { fontSize: 12, bullet: true, breakLine: true },
      };
    });
    slide.addText(body, { x: 0.5, y: 1.0, w: 9, h: 4.0, valign: "top" });

    // Cap note on the footer of the LAST issue slide.
    if (capNote && s === issueSlideCount - 1) {
      slide.addText(capNote, { x: 0.5, y: 5.1, w: 9, h: 0.4, fontSize: 11, italic: true });
    }
  }

  // If there are no issue slides but the set was capped (edge), surface the note
  // on the Resumen slide.
  if (capNote && issueSlideCount === 0) {
    summary.addText(capNote, { x: 0.5, y: 5.1, w: 9, h: 0.4, fontSize: 11, italic: true });
  }

  return { pptx, slideCount };
}

/**
 * Serialize a ReportModel to a PPTX binary (Uint8Array) fully in memory — no
 * disk I/O, apt for a Node route. Always 7-12 slides. NO PII (only ReportModel
 * data reaches this function). Accents/ñ preserved via UTF-8.
 */
export async function toPptx(model: ReportModel): Promise<Uint8Array> {
  const { pptx } = buildPptxDeck(model);
  const out = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
  return out;
}
