import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { RenderVerdict, RenderedSnapshot, RenderIssueDraft } from "./types";

/** Single render check id. Fingerprints are sub-typed by verdict. */
export const RENDER_CHECK_ID = "RENDER-01";

/**
 * Tunable CSR threshold: if the raw-vs-rendered visible-text ratio falls below
 * this, the page is treated as CSR/risk (key content only appears after JS).
 */
export const RENDER_CSR_RATIO = 0.6;

/**
 * Extracts visible body text from raw HTML, mirroring
 * `@auditor/checks` `extractVisibleText`: strip script/style/noscript/template,
 * collapse whitespace. Kept local so this package does not depend on checks.
 */
function extractRawText($: CheerioAPI): string {
  const $body = $("body").clone();
  $body.find("script, style, noscript, template").remove();
  return $body.text().replace(/\s+/g, " ").trim();
}

interface DetectInput {
  url: string;
  pageId: string;
  /** Raw HTML already stored in `Page.html`; null when unavailable. */
  rawHtml: string | null;
  rendered: RenderedSnapshot;
}

function fingerprint(verdict: RenderVerdict, url: string): string {
  return `${RENDER_CHECK_ID}:${verdict}:${url}`;
}

/**
 * Pure raw-vs-rendered comparison. Emits a single per-page render verdict as an
 * `IssueDraft`-shaped object (`category: "aeo"`).
 *
 * Classification (RENDER-01 signal + RENDER-02 severity framing):
 *   - CSR if a key field (title / H1 / visible text) is empty in the RAW HTML
 *     while the rendered snapshot has it, OR if the raw/rendered text ratio is
 *     below `RENDER_CSR_RATIO`.
 *   - SSR otherwise.
 *
 * Severity: SSR → "ok", CSR → "warning". NEVER "critical" — CSR is a soft SEO/AEO
 * risk (warning = partial credit), not a hard score failure (out of scope).
 */
export function detectRenderVerdict(input: DetectInput): RenderIssueDraft {
  const { url, pageId, rawHtml, rendered } = input;

  // T-12-01: parse only, never execute. cheerio does not run scripts.
  // T-12-01: null rawHtml → empty raw side (a CSR candidate), no throw.
  const $ = cheerio.load(rawHtml ?? "");

  const rawTitle = $("title").text().trim();
  const rawH1 = $("h1").first().text().trim();
  const rawText = extractRawText($);

  const renderedTitle = rendered.title.trim();
  const renderedH1 = rendered.h1.trim();
  const renderedText = rendered.text.trim();

  // Key content that exists after render but is missing in the raw HTML.
  const missingKeyContent =
    (rawTitle.length === 0 && renderedTitle.length > 0) ||
    (rawH1.length === 0 && renderedH1.length > 0) ||
    (rawText.length === 0 && renderedText.length > 0);

  const ratio =
    renderedText.length > 0 ? rawText.length / renderedText.length : 1;
  const belowRatio = renderedText.length > 0 && ratio < RENDER_CSR_RATIO;

  const verdict: RenderVerdict =
    missingKeyContent || belowRatio ? "csr" : "ssr";

  const measuredValue = `raw/render texto = ${(ratio * 100).toFixed(0)}% (${rawText.length}/${renderedText.length} chars)`;

  if (verdict === "csr") {
    return {
      checkId: RENDER_CHECK_ID,
      category: "aeo",
      title: "Contenido clave solo visible tras render JS (CSR)",
      severity: "warning",
      verdict: "csr",
      measuredValue,
      source: url,
      criterion:
        "El contenido clave (título, H1 y texto principal) debe estar presente en el HTML inicial, no solo tras ejecutar JavaScript.",
      recommendation:
        "Renderiza el contenido principal en el servidor (SSR/SSG) o prerenderiza las rutas críticas para que buscadores y motores de IA lo lean sin ejecutar JavaScript.",
      fingerprint: fingerprint("csr", url),
      pageId,
    };
  }

  return {
    checkId: RENDER_CHECK_ID,
    category: "aeo",
    title: "Renderizado server-side (SSR)",
    severity: "ok",
    verdict: "ssr",
    measuredValue,
    source: url,
    criterion:
      "El contenido clave está presente en el HTML inicial sin depender de JavaScript.",
    recommendation:
      "La página entrega su contenido en el HTML inicial; mantén este comportamiento para máxima visibilidad en buscadores e IA.",
    fingerprint: fingerprint("ssr", url),
    pageId,
  };
}

/**
 * Degradation path (consumed by 12-02): when the render fails, times out, or is
 * blocked, emit an "undetermined" verdict with severity "ok" so the audit
 * completes without penalizing the page.
 */
export function undeterminedVerdict(
  url: string,
  pageId: string,
): RenderIssueDraft {
  return {
    checkId: RENDER_CHECK_ID,
    category: "aeo",
    title: "Renderizado no determinado",
    severity: "ok",
    verdict: "undetermined",
    source: url,
    criterion:
      "No fue posible comparar el HTML crudo con el DOM renderizado para esta página.",
    recommendation:
      "No se pudo determinar el tipo de renderizado (fallo, bloqueo o timeout del render). No afecta el score; se puede reintentar en una próxima auditoría.",
    fingerprint: fingerprint("undetermined", url),
    pageId,
  };
}
