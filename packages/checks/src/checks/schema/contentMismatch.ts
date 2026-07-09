import * as cheerio from "cheerio";
import type { IssueDraft, SiteCheck } from "../../types";
import { extractVisibleText, pageFingerprint } from "../../util";
import { extractJsonLdBlocks, flattenNodes, typesOf, hasProp } from "./extract";

const CHECK_ID = "SD-06";

/**
 * Fraction of FAQPage/HowTo signals that must appear as visible-text
 * substrings to NOT flag a mismatch — half is enough to tolerate partial
 * rendering/truncation without demanding an exact full-text match.
 */
const MATCH_THRESHOLD = 0.5;

/**
 * Visible-rating heuristic for Product+AggregateRating and Review: a numeric
 * rating co-located with rating vocabulary. Tolerant of theme-specific
 * formatting — does not require the exact `ratingValue` number to appear,
 * since themes often round/reformat it. Bounded, non-nested quantifiers only
 * (no catastrophic-backtracking risk).
 */
const RATING_VISIBLE_PATTERN = /\d(\.\d)?\s*(\/\s*5|de\s*5|estrell|star|★|valoraci|reseñ)/i;

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** A 40-char normalized prefix probe tolerates minor whitespace/casing
 * differences between the JSON-LD string and its rendered HTML counterpart
 * without requiring exact equality. */
function signalSnippet(s: string): string {
  return normalizeText(s).slice(0, 40);
}

function faqSignals(data: Record<string, unknown>): string[] {
  const mainEntity = data.mainEntity;
  if (!Array.isArray(mainEntity)) return [];
  const signals: string[] = [];
  for (const item of mainEntity) {
    if (typeof item !== "object" || item === null) continue;
    const name = (item as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) signals.push(name);
  }
  return signals;
}

function howToSignals(data: Record<string, unknown>): string[] {
  const step = data.step;
  if (!Array.isArray(step)) return [];
  const signals: string[] = [];
  for (const item of step) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name.trim().length > 0) {
      signals.push(obj.name);
    } else if (typeof obj.text === "string" && obj.text.trim().length > 0) {
      signals.push(obj.text);
    }
  }
  return signals;
}

function reviewSignal(data: Record<string, unknown>): string | undefined {
  if (typeof data.reviewBody === "string" && data.reviewBody.trim().length > 0) {
    return data.reviewBody;
  }
  if (typeof data.name === "string" && data.name.trim().length > 0) {
    return data.name;
  }
  return undefined;
}

function hasVisibleTextMatch(signals: string[], visibleTextNormalized: string): boolean {
  if (signals.length === 0) return true;
  const matched = signals.filter((s) => visibleTextNormalized.includes(signalSnippet(s))).length;
  return matched / signals.length >= MATCH_THRESHOLD;
}

/**
 * SD-06 (site-level): flags pages declaring high-risk JSON-LD types
 * (FAQPage, HowTo, Product+AggregateRating, Review) without a matching
 * visible-content signal in the raw HTML — the risk of a Google manual
 * action for "misleading structured data". Always emits severity "warning"
 * (never critical — this is a heuristic, false-positive risk acknowledged
 * per SCHEMA-07), and suppresses on pages the v1.2 render sample confirmed
 * as CSR (`renderVerdictByPageId[page.id] === "csr"`).
 */
export const schemaContentMismatchCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ pages, renderVerdictByPageId }) {
    const issues: IssueDraft[] = [];

    for (const page of pages) {
      if (!page.html) continue;
      const $ = cheerio.load(page.html);
      const nodes = flattenNodes(extractJsonLdBlocks($));
      if (nodes.length === 0) continue;

      const visibleText = extractVisibleText($);
      const visibleTextNormalized = normalizeText(visibleText);
      const mismatched = new Set<string>();

      for (const node of nodes) {
        const types = typesOf(node.data);

        if (types.includes("FAQPage")) {
          const signals = faqSignals(node.data);
          if (!hasVisibleTextMatch(signals, visibleTextNormalized)) mismatched.add("FAQPage");
        }

        if (types.includes("HowTo")) {
          const signals = howToSignals(node.data);
          if (!hasVisibleTextMatch(signals, visibleTextNormalized)) mismatched.add("HowTo");
        }

        if (types.includes("Product") && hasProp(node.data, "aggregateRating")) {
          if (!RATING_VISIBLE_PATTERN.test(visibleText)) mismatched.add("Product+AggregateRating");
        }

        if (types.includes("Review")) {
          const signal = reviewSignal(node.data);
          if (signal !== undefined) {
            const matches =
              visibleTextNormalized.includes(signalSnippet(signal)) || RATING_VISIBLE_PATTERN.test(visibleText);
            if (!matches) mismatched.add("Review");
          }
        }
      }

      if (mismatched.size === 0) continue;
      if (renderVerdictByPageId?.[page.id] === "csr") continue;

      const url = page.finalUrl ?? page.url;
      const tipos = Array.from(mismatched).join(", ");
      issues.push({
        checkId: CHECK_ID,
        category: "schema",
        title: "Datos estructurados sin contenido visible correspondiente",
        severity: "warning",
        measuredValue: `Tipos afectados: ${tipos}`,
        source: url,
        criterion:
          "El contenido declarado en JSON-LD (preguntas, pasos, valoración) debería tener un equivalente visible en el HTML para evitar riesgo de acción manual por datos estructurados engañosos",
        recommendation: `Asegúrate de que el contenido declarado en los bloques ${tipos} (preguntas/respuestas, pasos, valoración) sea visible para los usuarios en la página, no solo dentro del JSON-LD`,
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      });
    }

    return issues;
  },
};
