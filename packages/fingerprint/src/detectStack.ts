import * as cheerio from "cheerio";
import { registry } from "./signatures/registry";
import type {
  AggregatedInput,
  Axis,
  AxisResult,
  Confidence,
  DetectedStack,
  PageFingerprintInput,
  Signal,
  Signature,
} from "./types";

/**
 * `detectStack` — función PURA orquestadora del fingerprint de stack técnico.
 *
 * Agrega el input de todas las páginas del audit (headers lowercased, unión de
 * cookieNames, HTML home→fallback truncado), corre el registry de firmas por eje
 * y resuelve cada eje de forma INDEPENDIENTE (nunca winner-take-all): un sitio
 * puede ser WordPress + Cloudflare + Next.js a la vez. Cuando no hay señal
 * suficiente, el eje queda `no-detectado` (FPRINT-08) — el motor NUNCA fuerza
 * una respuesta.
 *
 * Sin I/O: el worker (Phase 26) la invoca una vez por auditoría con el input ya
 * mapeado desde `Page[]`.
 */

/**
 * Tope de bytes de HTML que se cargan en cheerio por página elegida. Trunca
 * ANTES de parsear para acotar memoria y superficie de matching sobre HTML
 * adversario (T-25-07 / T-25-08). ~256 KB alcanza de sobra para las firmas
 * (paths, meta, clases, scripts embebidos viven al inicio del documento).
 */
export const MAX_HTML_BYTES = 256 * 1024;

/** Trunca el HTML a `MAX_HTML_BYTES` bytes UTF-8 (defensa DoS previa a cheerio). */
function truncateHtml(html: string): string {
  const buf = Buffer.from(html, "utf8");
  if (buf.byteLength <= MAX_HTML_BYTES) return html;
  return buf.subarray(0, MAX_HTML_BYTES).toString("utf8");
}

/**
 * Construye el `AggregatedInput`:
 * - headers: keys en minúscula sobre un objeto SIN prototipo heredado
 *   (`Object.create(null)`), de modo que keys hostiles del sitio (`__proto__`,
 *   `constructor`) queden como propiedades propias inertes y nunca contaminen el
 *   prototipo (T-25-09). Páginas posteriores completan headers ausentes sin
 *   pisar el primer valor visto.
 * - cookieNames: unión dedup de todas las páginas.
 * - html: la home con html no vacío; si no, la primera página con html no vacío
 *   (Pitfall 4). Se trunca antes de cargar cheerio (T-25-07/08).
 */
function aggregate(pages: PageFingerprintInput[]): AggregatedInput {
  const responseHeaders: Record<string, string> = Object.create(null);
  const cookieSet = new Set<string>();

  for (const page of pages) {
    for (const [key, value] of Object.entries(page.responseHeaders ?? {})) {
      const lower = key.toLowerCase();
      // Primera aparición gana; no sobreescribir con páginas posteriores.
      if (responseHeaders[lower] === undefined) responseHeaders[lower] = value;
    }
    for (const name of page.cookieNames ?? []) cookieSet.add(name);
  }

  const homePage = pages.find((p) => p.isHome && p.html != null && p.html !== "");
  const fallbackPage = pages.find((p) => p.html != null && p.html !== "");
  const chosen = homePage ?? fallbackPage;
  const html = chosen?.html != null ? truncateHtml(chosen.html) : null;

  return {
    responseHeaders,
    cookieNames: [...cookieSet],
    html,
    $: cheerio.load(html ?? ""),
  };
}

/** Eje sin señal suficiente: estado `no-detectado` de primera clase (FPRINT-08). */
function emptyAxis(): AxisResult {
  return { value: null, confidence: "no-detectado", signals: [] };
}

/**
 * Confianza por reglas EXPLÍCITAS (sin puntaje numérico):
 * - 2+ señales fuertes -> `alto`.
 * - 1 señal fuerte inequívoca -> `alto`.
 * - 1 señal fuerte no inequívoca -> `medio`.
 * - solo señal(es) débil(es) -> `bajo`.
 * - 0 señales -> `no-detectado`.
 */
function resolveConfidence(signals: Signal[]): Confidence {
  const strong = signals.filter((s) => s.strength === "fuerte");
  if (strong.length >= 2) return "alto";
  if (strong.length === 1) return strong[0]?.unequivocal ? "alto" : "medio";
  if (signals.length >= 1) return "bajo";
  return "no-detectado";
}

/** Convierte una firma que matcheó (`count > 0`) en su `Signal`. */
function toSignal(sig: Signature, count: number): Signal {
  return {
    id: sig.id,
    axis: sig.axis,
    strength: sig.strength,
    evidence: `${sig.id} x${count}`,
    unequivocal: sig.unequivocal,
  };
}

/**
 * Resolvedor genérico para cms/cdn/hosting/jsFramework: corre las firmas del eje,
 * agrupa las señales por `value` candidato y elige el value con más señales
 * fuertes (desempate: más señales totales; luego orden de registry). Sin señal
 * -> `emptyAxis()`. La confianza se resuelve SOLO sobre las señales del value
 * ganador.
 */
function resolveAxis(axis: Axis, agg: AggregatedInput): AxisResult {
  const byValue = new Map<string, Signal[]>();

  for (const sig of registry[axis]) {
    const count = sig.test(agg);
    if (count > 0) {
      const list = byValue.get(sig.value) ?? [];
      list.push(toSignal(sig, count));
      byValue.set(sig.value, list);
    }
  }

  if (byValue.size === 0) return emptyAxis();

  let bestValue: string | null = null;
  let bestSignals: Signal[] = [];
  let bestStrong = -1;
  for (const [value, signals] of byValue) {
    const strong = signals.filter((s) => s.strength === "fuerte").length;
    const isBetter =
      strong > bestStrong ||
      (strong === bestStrong && signals.length > bestSignals.length);
    if (isBetter) {
      bestValue = value;
      bestSignals = signals;
      bestStrong = strong;
    }
  }

  return {
    value: bestValue,
    confidence: resolveConfidence(bestSignals),
    signals: bestSignals,
  };
}

/**
 * Builder (solo relevante bajo WordPress): cada firma devuelve un CONTEO de
 * marcadores; gana el builder con mayor conteo (>0). Empate real del conteo
 * máximo entre dos builders -> `no-detectado` (no prioridad arbitraria). Ningún
 * builder matchea -> `no-detectado` (NUNCA Gutenberg por default).
 */
function resolveBuilder(agg: AggregatedInput): AxisResult {
  const matches: { sig: Signature; count: number }[] = [];
  for (const sig of registry.builder) {
    const count = sig.test(agg);
    if (count > 0) matches.push({ sig, count });
  }

  if (matches.length === 0) return emptyAxis();

  const maxCount = Math.max(...matches.map((m) => m.count));
  const winners = matches.filter((m) => m.count === maxCount);
  if (winners.length !== 1 || !winners[0]) return emptyAxis(); // empate real -> no-detectado

  const { sig, count } = winners[0];
  const signal = toSignal(sig, count);
  return {
    value: sig.value,
    confidence: resolveConfidence([signal]),
    signals: [signal],
  };
}

/**
 * Analytics: ARRAY de `AxisResult`, uno por herramienta matcheada (GA4 + GTM +
 * Meta Pixel coexisten). Ninguna matchea -> `[]`.
 */
function resolveAnalytics(agg: AggregatedInput): AxisResult[] {
  const results: AxisResult[] = [];
  for (const sig of registry.analytics) {
    const count = sig.test(agg);
    if (count > 0) {
      const signal = toSignal(sig, count);
      results.push({
        value: sig.value,
        confidence: resolveConfidence([signal]),
        signals: [signal],
      });
    }
  }
  return results;
}

/**
 * API pública del paquete: resuelve el `DetectedStack` de un audit a partir de
 * las páginas rastreadas. `builder` se resuelve solo cuando el CMS es WordPress;
 * en cualquier otro caso queda `no-detectado`.
 */
export function detectStack(input: { pages: PageFingerprintInput[] }): DetectedStack {
  const agg = aggregate(input.pages);

  const cms = resolveAxis("cms", agg);
  const builder = cms.value === "WordPress" ? resolveBuilder(agg) : emptyAxis();

  return {
    cms,
    builder,
    cdn: resolveAxis("cdn", agg),
    hosting: resolveAxis("hosting", agg),
    jsFramework: resolveAxis("jsFramework", agg),
    analytics: resolveAnalytics(agg),
  };
}
