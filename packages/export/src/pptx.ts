import PptxGenJS from "pptxgenjs";
import type { ReportModel, ReportIssue } from "@auditor/report-model";
import type { Category, ScoreStatus } from "@auditor/scoring";
import { prioritizeIssues } from "./priority";
import { CATEGORY_ORDER, CATEGORY_LABEL, STATUS_LABEL } from "./labels";

/**
 * PPTX serializer (EXPORT-03) — a CURATED, BRANDED deck with NATIVE charts.
 *
 * Pure `pptxgenjs` (v4.0.1). NO headless-browser engine of any kind (per
 * CLAUDE.md "What NOT to Use"); this module imports only `pptxgenjs` and the
 * local report model. Page screenshots are OUT OF SCOPE (deferred phase).
 *
 * Slide-count guarantee — ALWAYS in [7, 12]:
 *
 *   total = BASE_SLIDES (6, fixed) + issueSlides (1..MAX_ISSUE_SLIDES=6)
 *
 * BASE_SLIDES (always present):
 *   1  Portada             — dominio + fecha + score general + pill de estado
 *   2  Resumen ejecutivo   — doughnut del score + tiles (críticos/adv/páginas)
 *   3  Scores por categoría — bar chart horizontal de las categorías con score medido
 *      (hasta 6; una categoría sin datos aún, como social antes de v1.6 Phase 30, se
 *      excluye del gráfico y se lista en una nota al pie en vez de graficarse en 0)
 *   4  Desglose de severidad — doughnut de conteos por severidad
 *   5  Metodología         — qué mide la auditoría (copy curada)
 *   6  Próximos pasos      — CTA + recomendaciones priorizadas
 *
 * issueSlides (1..6): issues priorizados de `prioritizeIssues`, paginados en
 * tarjetas (máx. 4 por slide). Con CERO issues se emite UNA slide celebratoria,
 * garantizando el piso de 7. El tope de 6 slides de issues garantiza el techo de
 * 12. La nota "mostrando N de M" va en el footer de la última slide de issues.
 */

/** Fixed base slides: portada + resumen + categorías + severidad + metodología + cierre. */
const BASE_SLIDES = 6;
/** Cap on prioritized-issue slides so total never exceeds 12. */
const MAX_ISSUE_SLIDES = 6;
/** How many issue cards to render per issue slide. */
const ISSUES_PER_SLIDE = 4;

// --- Brand palette (juan-tech dark theme). pptxgenjs wants hex without '#'. ---
const INK = "0A0B0F"; // background
const SURFACE = "11131A"; // card
const RAISED = "161922"; // raised
const BORDER = "1E293B"; // border
const TEXT = "F1F5F9"; // primary text
const TEXT2 = "94A3B8"; // secondary text
const MUTED = "64748B"; // muted text
const LIME = "C3F53C"; // brand accent
const LIME2 = "D4F97A"; // accent hover
const CRIT = "EF4444"; // critical
const WARN = "F59E0B"; // warning
const OK = "22C55E"; // success

const HEAD = "Khand"; // headings font (graceful fallback if not installed)
const BODY = "Geist Sans"; // body font (graceful fallback)

// Wide 16:9 canvas (inches).
const W = 13.33;
const H = 7.5;
const MARGIN = 0.7;
const ACCENT_BAR_W = 0.16;

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface PptxDeck {
  pptx: PptxGenJS;
  /** Number of slides added (always in [7, 12]). */
  slideCount: number;
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;

function statusColor(status: ScoreStatus): string {
  if (status === "good") return OK;
  if (status === "needs_improvement") return WARN;
  return CRIT;
}

function severityColor(severity: string): string {
  if (severity === "critical") return CRIT;
  if (severity === "warning") return WARN;
  return OK;
}

function formatDate(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/**
 * Every slide's brand chrome: dark background, a thin lime accent bar on the
 * left edge, and a branded footer (lime divider + left tagline + slide number).
 */
function decorate(pptx: PptxGenJS, slide: Slide, pageNum: number): void {
  slide.background = { color: INK };
  // Left lime accent bar (brand motif).
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: ACCENT_BAR_W,
    h: H,
    fill: { color: LIME },
  });
  // Footer lime divider.
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: H - 0.55,
    w: W - 2 * MARGIN,
    h: 0.014,
    fill: { color: LIME },
  });
  slide.addText("juan-tech.com · Auditoría SEO/Técnica", {
    x: MARGIN,
    y: H - 0.5,
    w: 9,
    h: 0.35,
    fontSize: 9,
    color: TEXT2,
    fontFace: BODY,
    align: "left",
    valign: "middle",
  });
  slide.addText(String(pageNum), {
    x: W - MARGIN - 1,
    y: H - 0.5,
    w: 1,
    h: 0.35,
    fontSize: 9,
    color: TEXT2,
    fontFace: BODY,
    align: "right",
    valign: "middle",
  });
}

/** Slide title with a short lime underline accent. */
function slideHeader(pptx: PptxGenJS, slide: Slide, title: string): void {
  slide.addText(title, {
    x: MARGIN,
    y: 0.4,
    w: W - 2 * MARGIN,
    h: 0.7,
    fontSize: 30,
    bold: true,
    color: TEXT,
    fontFace: HEAD,
    valign: "middle",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 1.12,
    w: 1.6,
    h: 0.045,
    fill: { color: LIME },
  });
}

/** A colored status/severity pill (rounded rect + centered dark label). */
function pill(
  pptx: PptxGenJS,
  slide: Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: string
): void {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: h / 2,
    fill: { color },
  });
  slide.addText(label, {
    x,
    y,
    w,
    h,
    fontSize: 13,
    bold: true,
    color: INK,
    fontFace: BODY,
    align: "center",
    valign: "middle",
  });
}

/** A stat tile card (big value + small label) for the resumen slide. */
function statTile(
  pptx: PptxGenJS,
  slide: Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number | string,
  label: string,
  valueColor: string
): void {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: SURFACE },
    line: { color: BORDER, width: 1 },
  });
  slide.addText(String(value), {
    x,
    y: y + 0.18,
    w,
    h: h * 0.52,
    fontSize: 40,
    bold: true,
    color: valueColor,
    fontFace: HEAD,
    align: "center",
    valign: "middle",
  });
  slide.addText(label, {
    x: x + 0.1,
    y: y + h * 0.62,
    w: w - 0.2,
    h: h * 0.32,
    fontSize: 12,
    color: TEXT2,
    fontFace: BODY,
    align: "center",
    valign: "top",
  });
}

/** A prioritized-issue card: severity dot + checkId/title + url + recommendation. */
function issueCard(
  pptx: PptxGenJS,
  slide: Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  issue: ReportIssue
): void {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: SURFACE },
    line: { color: BORDER, width: 1 },
  });
  // Severity color dot.
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.22,
    y: y + 0.26,
    w: 0.18,
    h: 0.18,
    fill: { color: severityColor(issue.severity) },
  });
  // checkId (lime) + title (white), Khand.
  slide.addText(
    [
      { text: `[${issue.checkId}] `, options: { color: LIME } },
      { text: issue.title, options: { color: TEXT } },
    ],
    {
      x: x + 0.55,
      y: y + 0.14,
      w: w - 0.75,
      h: 0.38,
      fontSize: 15,
      bold: true,
      fontFace: HEAD,
      valign: "middle",
    }
  );
  // Page URL (secondary).
  slide.addText(issue.url ?? issue.source ?? "—", {
    x: x + 0.55,
    y: y + 0.52,
    w: w - 0.75,
    h: 0.3,
    fontSize: 10,
    color: TEXT2,
    fontFace: BODY,
    valign: "middle",
  });
  // Recommendation (body).
  slide.addText(issue.recommendation ?? "", {
    x: x + 0.55,
    y: y + 0.82,
    w: w - 0.75,
    h: h - 0.92,
    fontSize: 11,
    color: TEXT,
    fontFace: BODY,
    valign: "top",
  });
}

/**
 * Build the PptxGenJS deck (slides added, not yet serialized). Exposed so tests
 * can assert the slide count via the pptxgenjs API before `write`.
 */
export function buildPptxDeck(model: ReportModel): PptxDeck {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.author = "juan-tech.com";
  pptx.company = "juan-tech.com";
  pptx.title = `Auditoría web — ${model.audit.domain}`;

  let slideCount = 0;
  const addSlide = (): Slide => {
    slideCount += 1;
    const slide = pptx.addSlide();
    decorate(pptx, slide, slideCount);
    return slide;
  };

  // Aggregate issue stats from the FULL persisted set (includes "ok" checks).
  const allIssues: ReportIssue[] = Object.values(model.issuesByCategory).flat();
  const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const okCount = allIssues.filter((i) => i.severity === "ok").length;
  const pagesWithIssues = new Set(
    allIssues
      .filter((i) => i.severity !== "ok")
      .map((i) => i.url ?? i.source)
      .filter((u): u is string => Boolean(u))
  ).size;

  const overall = model.overall ?? 0;
  const overallLabel = model.overall === null ? "N/D" : String(model.overall);

  const prioritized = prioritizeIssues(model.priorityCandidates);
  const issues = prioritized.issues;

  // === Slide 1: Portada ===
  {
    const s = addSlide();
    s.addText("Auditoría web", {
      x: MARGIN,
      y: 1.35,
      w: 8.4,
      h: 1.3,
      fontSize: 60,
      bold: true,
      color: LIME,
      fontFace: HEAD,
      align: "left",
      valign: "middle",
    });
    s.addText(model.audit.domain, {
      x: MARGIN,
      y: 2.75,
      w: 8.4,
      h: 0.6,
      fontSize: 26,
      color: TEXT,
      fontFace: BODY,
    });
    const when = model.audit.finishedAt ?? model.audit.createdAt;
    if (when) {
      s.addText(`Auditada el ${formatDate(when)}`, {
        x: MARGIN,
        y: 3.4,
        w: 8.4,
        h: 0.45,
        fontSize: 15,
        color: TEXT2,
        fontFace: BODY,
      });
    }
    // Large overall score (lime) on the right.
    s.addText(overallLabel, {
      x: 8.6,
      y: 1.9,
      w: 4.0,
      h: 2.4,
      fontSize: 130,
      bold: true,
      color: LIME,
      fontFace: HEAD,
      align: "center",
      valign: "middle",
    });
    s.addText("Score general / 100", {
      x: 8.6,
      y: 4.25,
      w: 4.0,
      h: 0.4,
      fontSize: 13,
      color: TEXT2,
      fontFace: BODY,
      align: "center",
    });
    // Status pill under the score.
    pill(pptx, s, 9.65, 4.75, 1.9, 0.5, STATUS_LABEL[model.status], statusColor(model.status));
  }

  // === Slide 2: Resumen ejecutivo ===
  {
    const s = addSlide();
    slideHeader(pptx, s, "Resumen ejecutivo");
    // Doughnut of the overall score.
    s.addChart(
      pptx.ChartType.doughnut,
      [{ name: "Score", labels: ["Score", "Resto"], values: [overall, Math.max(0, 100 - overall)] }],
      {
        x: 0.9,
        y: 1.5,
        w: 4.2,
        h: 4.2,
        holeSize: 70,
        chartColors: [LIME, BORDER],
        showLegend: false,
        showValue: false,
        showTitle: false,
        dataBorder: { pt: 2, color: INK },
      }
    );
    // Numeric score overlaid on the hole.
    s.addText(overallLabel, {
      x: 0.9,
      y: 3.0,
      w: 4.2,
      h: 1.0,
      fontSize: 48,
      bold: true,
      color: LIME,
      fontFace: HEAD,
      align: "center",
      valign: "middle",
    });
    s.addText("/ 100", {
      x: 0.9,
      y: 3.95,
      w: 4.2,
      h: 0.35,
      fontSize: 13,
      color: TEXT2,
      fontFace: BODY,
      align: "center",
    });
    // Quick stat tiles (right column).
    const tileX = 6.0;
    const tileW = 6.6;
    const tileH = 1.15;
    const gap = 0.28;
    let ty = 1.75;
    statTile(pptx, s, tileX, ty, tileW, tileH, criticalCount, "Issues críticos", CRIT);
    ty += tileH + gap;
    statTile(pptx, s, tileX, ty, tileW, tileH, warningCount, "Advertencias", WARN);
    ty += tileH + gap;
    statTile(pptx, s, tileX, ty, tileW, tileH, pagesWithIssues, "Páginas con issues", LIME);
  }

  // === Slide 3: Scores por categoría ===
  {
    const s = addSlide();
    slideHeader(pptx, s, "Scores por categoría");
    // Only chart categories with an actual measured score (EXPORT/W-05):
    // plotting an unmeasured category as a 0-value bar with showValue: true
    // reads as "this scored zero", not "not measured yet".
    const measuredCategories = CATEGORY_ORDER.filter((c) => model.byCategory[c as Category] !== undefined);
    const labels = measuredCategories.map((c) => CATEGORY_LABEL[c]);
    const values = measuredCategories.map((c) => model.byCategory[c as Category]!.score);
    s.addChart(pptx.ChartType.bar, [{ name: "Score", labels, values }], {
      x: 0.9,
      y: 1.45,
      w: 11.6,
      h: 4.2,
      barDir: "bar", // horizontal bars
      chartColors: [LIME],
      showLegend: false,
      showValue: true,
      dataLabelColor: TEXT,
      dataLabelFontFace: BODY,
      dataLabelFontSize: 11,
      valAxisMinVal: 0,
      valAxisMaxVal: 100,
      catAxisLabelColor: TEXT,
      catAxisLabelFontFace: BODY,
      catAxisLabelFontSize: 11,
      valAxisLabelColor: TEXT2,
      valAxisLabelFontFace: BODY,
      valAxisLabelFontSize: 10,
      valGridLine: { color: BORDER, size: 1 },
      catGridLine: { style: "none" },
    });
    // "sin datos" note for categories excluded from the chart above (not plotted as 0).
    const missing = CATEGORY_ORDER.filter((c) => model.byCategory[c as Category] === undefined);
    if (missing.length > 0) {
      const names = missing.map((c) => CATEGORY_LABEL[c]).join(", ");
      s.addText(`Sin datos todavía (no incluidas arriba): ${names}.`, {
        x: MARGIN,
        y: 5.8,
        w: W - 2 * MARGIN,
        h: 0.4,
        fontSize: 11,
        italic: true,
        color: MUTED,
        fontFace: BODY,
      });
    }
  }

  // === Slide 4: Desglose de severidad ===
  {
    const s = addSlide();
    slideHeader(pptx, s, "Desglose de severidad");
    const total = criticalCount + warningCount + okCount;
    if (total === 0) {
      s.addText("No hay checks registrados para desglosar por severidad.", {
        x: MARGIN,
        y: 3.0,
        w: W - 2 * MARGIN,
        h: 0.6,
        fontSize: 18,
        color: TEXT2,
        fontFace: BODY,
        align: "center",
      });
    } else {
      s.addChart(
        pptx.ChartType.doughnut,
        [
          {
            name: "Severidad",
            labels: ["Críticos", "Advertencias", "Correctos"],
            values: [criticalCount, warningCount, okCount],
          },
        ],
        {
          x: 1.2,
          y: 1.5,
          w: 6.5,
          h: 4.3,
          holeSize: 55,
          chartColors: [CRIT, WARN, OK],
          showLegend: true,
          legendPos: "r",
          legendColor: TEXT,
          legendFontFace: BODY,
          legendFontSize: 13,
          showValue: true,
          dataLabelColor: INK,
          dataLabelFontFace: BODY,
          dataLabelFontSize: 12,
          dataBorder: { pt: 2, color: INK },
          showTitle: false,
        }
      );
    }
  }

  // === Slide 5: Metodología ===
  {
    const s = addSlide();
    slideHeader(pptx, s, "Metodología");
    s.addText(
      "La auditoría rastrea el sitio a partir del sitemap y evalúa cada página en seis frentes complementarios:",
      {
        x: MARGIN,
        y: 1.4,
        w: W - 2 * MARGIN,
        h: 0.6,
        fontSize: 15,
        color: TEXT2,
        fontFace: BODY,
        valign: "top",
      }
    );
    const bullets: Array<{ text: string; options: object }> = [
      "SEO técnico: indexabilidad, robots.txt, sitemap, canónicas y estado HTTP.",
      "On-page: títulos, meta descripciones, encabezados y contenido.",
      "Datos estructurados: JSON-LD y esquemas schema.org válidos.",
      "Rendimiento / CWV: Core Web Vitals de laboratorio y campo (Lighthouse).",
      "AEO (visibilidad en IA): directivas para crawlers de IA y legibilidad para modelos.",
      "Render CSR/SSR: diferencias entre el HTML crudo y el DOM renderizado.",
    ].map((t) => ({
      text: t,
      options: {
        fontSize: 14,
        color: TEXT,
        fontFace: BODY,
        bullet: { code: "2022", color: LIME },
        breakLine: true,
        paraSpaceAfter: 10,
      },
    }));
    s.addText(bullets, {
      x: MARGIN + 0.1,
      y: 2.1,
      w: W - 2 * MARGIN - 0.2,
      h: 4.2,
      valign: "top",
    });
  }

  // === Slide 6: Próximos pasos ===
  {
    const s = addSlide();
    slideHeader(pptx, s, "Próximos pasos");
    const recos = issues.slice(0, 3).map((i, idx) => {
      const reco = i.recommendation ?? i.title;
      return {
        text: `${idx + 1}. ${reco}`,
        options: {
          fontSize: 15,
          color: TEXT,
          fontFace: BODY,
          bullet: false,
          breakLine: true,
          paraSpaceAfter: 14,
        },
      };
    });
    if (recos.length === 0) {
      s.addText(
        "La web superó los checks principales. Mantén el monitoreo periódico para conservar el resultado.",
        {
          x: MARGIN,
          y: 1.6,
          w: W - 2 * MARGIN,
          h: 1.0,
          fontSize: 16,
          color: TEXT,
          fontFace: BODY,
          valign: "top",
        }
      );
    } else {
      s.addText("Recomendaciones prioritarias:", {
        x: MARGIN,
        y: 1.45,
        w: W - 2 * MARGIN,
        h: 0.5,
        fontSize: 16,
        bold: true,
        color: LIME,
        fontFace: HEAD,
      });
      s.addText(recos, {
        x: MARGIN + 0.1,
        y: 2.05,
        w: W - 2 * MARGIN - 0.2,
        h: 3.0,
        valign: "top",
      });
    }
    // Branded CTA line.
    s.addShape(pptx.ShapeType.roundRect, {
      x: MARGIN,
      y: 5.55,
      w: W - 2 * MARGIN,
      h: 0.85,
      rectRadius: 0.1,
      fill: { color: RAISED },
      line: { color: LIME, width: 1 },
    });
    s.addText(
      [
        { text: "¿Quieres ayuda para resolverlos?  ", options: { color: TEXT } },
        { text: "Escríbenos en juan-tech.com", options: { color: LIME, bold: true } },
      ],
      {
        x: MARGIN,
        y: 5.55,
        w: W - 2 * MARGIN,
        h: 0.85,
        fontSize: 16,
        fontFace: BODY,
        align: "center",
        valign: "middle",
      }
    );
  }

  // === Issue slides (1..MAX_ISSUE_SLIDES) or ONE celebration slide ===
  let displayed = 0;
  if (issues.length === 0) {
    // Celebratory slide guarantees the floor of 7.
    const s = addSlide();
    slideHeader(pptx, s, "Sin issues prioritarios");
    s.addShape(pptx.ShapeType.ellipse, {
      x: W / 2 - 0.6,
      y: 2.0,
      w: 1.2,
      h: 1.2,
      fill: { color: OK },
    });
    s.addText("✓", {
      x: W / 2 - 0.6,
      y: 2.0,
      w: 1.2,
      h: 1.2,
      fontSize: 44,
      bold: true,
      color: INK,
      fontFace: HEAD,
      align: "center",
      valign: "middle",
    });
    s.addText("La web pasó los checks principales", {
      x: MARGIN,
      y: 3.5,
      w: W - 2 * MARGIN,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: TEXT,
      fontFace: HEAD,
      align: "center",
    });
    s.addText("No se detectaron issues críticos ni advertencias prioritarias en esta auditoría.", {
      x: MARGIN,
      y: 4.3,
      w: W - 2 * MARGIN,
      h: 0.6,
      fontSize: 14,
      color: TEXT2,
      fontFace: BODY,
      align: "center",
    });
  } else {
    const neededSlides = Math.ceil(issues.length / ISSUES_PER_SLIDE);
    const issueSlideCount = Math.min(neededSlides, MAX_ISSUE_SLIDES);
    const cardX = MARGIN;
    const cardW = W - 2 * MARGIN;
    const cardH = 1.18;
    const cardGap = 0.16;
    const startY = 1.35;

    for (let sIdx = 0; sIdx < issueSlideCount; sIdx += 1) {
      const s = addSlide();
      const chunk = issues.slice(sIdx * ISSUES_PER_SLIDE, (sIdx + 1) * ISSUES_PER_SLIDE);
      slideHeader(
        pptx,
        s,
        issueSlideCount > 1
          ? `Issues priorizados (${sIdx + 1}/${issueSlideCount})`
          : "Issues priorizados"
      );
      chunk.forEach((issue, i) => {
        issueCard(pptx, s, cardX, startY + i * (cardH + cardGap), cardW, cardH, issue);
        displayed += 1;
      });

      // "mostrando N de M" note on the footer of the LAST issue slide, when the
      // deck shows fewer cards than the total candidate set.
      if (sIdx === issueSlideCount - 1 && displayed < prioritized.total) {
        s.addText(`Mostrando ${displayed} de ${prioritized.total} issues`, {
          x: MARGIN,
          y: H - 0.9,
          w: W - 2 * MARGIN,
          h: 0.35,
          fontSize: 11,
          italic: true,
          color: MUTED,
          fontFace: BODY,
          align: "right",
        });
      }
    }
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
