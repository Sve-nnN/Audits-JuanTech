import type { CheerioAPI } from "cheerio";

/**
 * Los seis ejes de stack que el motor resuelve de forma independiente
 * (nunca winner-take-all). `analytics` es el único que puede tener varios
 * valores simultáneos (ver `DetectedStack.analytics`).
 */
export type Axis =
  | "cms"
  | "builder"
  | "cdn"
  | "hosting"
  | "jsFramework"
  | "analytics";

/**
 * Confianza derivada por reglas explícitas (no puntaje 0-100):
 * - `alto`: 2+ señales fuertes coincidentes, o 1 señal inequívoca de plataforma.
 * - `medio`: 1 señal fuerte sola.
 * - `bajo`: solo señal(es) débil(es)/indirecta(s).
 * - `no-detectado`: 0 señales — el motor NUNCA fuerza una respuesta (FPRINT-08).
 *
 * `no-detectado` es un estado de primera clase, no la ausencia de un campo.
 */
export type Confidence = "alto" | "medio" | "bajo" | "no-detectado";

/** Fuerza de una señal individual: `fuerte` (inequívoca/directa) o `debil` (indirecta). */
export type SignalStrength = "fuerte" | "debil";

/**
 * Una señal que matcheó para un eje, con evidencia legible para debug y para
 * la UI de reporte (Phase 26).
 */
export interface Signal {
  /** id de la firma (`Signature.id`) que produjo esta señal. */
  id: string;
  axis: Axis;
  strength: SignalStrength;
  /** Qué marcó exactamente, p.ej. "header cf-ray present". */
  evidence: string;
  /**
   * Marca señales inequívocas de plataforma (p.ej. cookie `_shopify_s`,
   * header `x-shopify-stage`). Habilita la regla "1 señal inequívoca -> alto"
   * del resolvedor de confianza.
   */
  unequivocal?: boolean;
}

/**
 * Resultado resuelto de un eje: el valor detectado (o `null` si no-detectado),
 * su confianza y las señales que lo soportan.
 */
export interface AxisResult {
  /** "WordPress", "Cloudflare", ... o `null` cuando no hay señal suficiente. */
  value: string | null;
  confidence: Confidence;
  /** Señales que soportan este `value` (vacío cuando `no-detectado`). */
  signals: Signal[];
}

/**
 * Stack detectado del sitio: un `AxisResult` por eje, salvo `analytics`, que es
 * un array porque varias herramientas coexisten (GA4 + GTM + Meta Pixel a la vez).
 */
export interface DetectedStack {
  cms: AxisResult;
  /** Relevante solo si `cms.value === "WordPress"`; si no, `no-detectado`. */
  builder: AxisResult;
  cdn: AxisResult;
  hosting: AxisResult;
  jsFramework: AxisResult;
  /** ARRAY: coexisten GA4 + GTM + Meta Pixel — nunca se colapsa a un valor único. */
  analytics: AxisResult[];
}

/**
 * Forma mínima de página que consume el motor — desacoplada a propósito del
 * tipo `Page` de `@auditor/db` para que `@auditor/fingerprint` siga siendo un
 * paquete puro sin dependencia runtime de Prisma/DB/crawler (mismo patrón que
 * `GraphPage` en `@auditor/graph`). El worker (Phase 26) mapea `Page[]` a
 * `PageFingerprintInput[]` en su borde.
 *
 * Nota de seguridad (T-25-01): `cookieNames` transporta SOLO nombres de cookie,
 * nunca valores/atributos — no existe campo para valores por construcción del tipo.
 */
export interface PageFingerprintInput {
  url: string;
  /** El worker marca la home (o la primera URL del sitemap) para elegir el HTML base. */
  isHome: boolean;
  html: string | null;
  /** Headers HTTP curados, keys en minúscula. */
  responseHeaders: Record<string, string>;
  /** Solo nombres de cookie (FPRINT-01), nunca valores. */
  cookieNames: string[];
}

/**
 * Input agregado y normalizado que recibe `Signature.test`: unifica todas las
 * páginas del audit en una vista lista para matchear firmas.
 * - `responseHeaders`: headers curados de todas las páginas, keys en minúscula,
 *   agregados en un único mapa.
 * - `cookieNames`: unión (dedup) de nombres de cookie de todas las páginas.
 * - `html`: el HTML elegido (home primero, fallback a cualquier página con HTML).
 * - `$`: instancia cheerio ya cargada con `html` para selectores robustos.
 */
export interface AggregatedInput {
  responseHeaders: Record<string, string>;
  cookieNames: string[];
  html: string | null;
  $: CheerioAPI;
}

/**
 * Firma declarativa de detección para un eje. `test` recibe el input agregado y
 * devuelve el CONTEO de marcadores que matchearon (0 = no match), no un boolean:
 * el conteo permite el desempate entre builders (gana el de mayor conteo).
 */
export interface Signature {
  id: string;
  axis: Axis;
  /** Qué tecnología representa esta firma (p.ej. "Elementor"). */
  value: string;
  strength: SignalStrength;
  /**
   * Marca la firma como inequívoca de plataforma para la regla
   * "1 señal inequívoca -> alto" del resolvedor de confianza.
   */
  unequivocal?: boolean;
  /** Devuelve el número de marcadores/páginas que matchean (0 = sin match). */
  test(ctx: AggregatedInput): number;
}
