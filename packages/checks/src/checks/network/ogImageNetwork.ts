import * as cheerio from "cheerio";
import { normalizeUrl } from "@auditor/crawler";
import {
  extractMetaSocial,
  firstValue,
  MAX_MEASURED_VALUE_CHARS,
  OG_IMAGE_MIN_WIDTH,
  OG_IMAGE_MIN_HEIGHT,
  OG_IMAGE_SMALL_WIDTH,
  OG_IMAGE_SMALL_HEIGHT,
  OG_IMAGE_TARGET_RATIO,
  OG_IMAGE_RATIO_MIN,
  OG_IMAGE_RATIO_MAX,
  OG_IMAGE_HEAVY_BYTES,
  OG_IMAGE_MAX_BYTES,
} from "@auditor/meta-social";
import type { IssueDraft, IssueSeverityValue, NetworkCheck } from "../../types";
import { pageFingerprint, siteFingerprint } from "../../util";
import { MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";
import { probeImages, UNVERIFIABLE_PROBE_REASONS, type ImageProbeResult } from "./imageProbe";

const CHECK_ID = "IMG-01";

const UNREACHABLE_SUBTYPE = "og-image-unreachable";
const UNVERIFIABLE_SUBTYPE = "og-image-unverifiable";
const SVG_SUBTYPE = "og-image-svg";
const NOT_IMAGE_SUBTYPE = "og-image-not-image";
const UNDETERMINED_SUBTYPE = "og-image-undetermined";
const TOO_SMALL_SUBTYPE = "og-image-too-small";
/**
 * Both dimension warnings — undersized and off-band ratio — persist the same
 * `og-image-suboptimal` fingerprint fragment, which is what Phase 32 groups by. It is
 * deliberately one fragment and not two: both are the same signal ("the image
 * loads but is not the ideal one"), and no image can hit both, because the
 * ratio is only evaluated when the size branch did not fire. A separate
 * `og-image-ratio` fragment would promise a row that never coexists with the
 * size one.
 */
const SUBOPTIMAL_SUBTYPE = "og-image-suboptimal";
const TOO_LARGE_SUBTYPE = "og-image-too-large";
const HEAVY_SUBTYPE = "og-image-heavy";
const CAPPED_SCOPE = "og-images-capped";

const UNREACHABLE_CRITERION =
  "La imagen declarada en og:image debe responder correctamente para que las plataformas puedan generar la vista previa";

const UNREACHABLE_RECOMMENDATION =
  "Corrige la URL de og:image o restaura la imagen en el servidor; una imagen que no responde deja la vista previa sin imagen al compartir la página.";

/** Separator between the diagnostic prefix (our own text) and the site-controlled URL. */
const SEPARATOR = " · ";

/**
 * Caps any fragment of site-controlled text before it reaches a persisted
 * measured value (mitigation T-31-05). The cap is the category-wide constant
 * declared in the pure engine; this file never declares one of its own, and it
 * is never applied to the fingerprint: two CDN URLs sharing their first
 * characters would collapse into a single row.
 */
const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);

/**
 * Renders a byte count as mebibytes with one decimal, **for presentation only**.
 *
 * This is a unit conversion for the text of a measured value, never a threshold:
 * no comparison in this file reads its output. See the weight block below.
 */
const toMib = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/**
 * One row-to-be, decided from the probe result alone and before knowing which
 * pages declare the image.
 *
 * The field names are the ones `IssueDraft` already uses, never translations,
 * so the emission loop is a plain copy. `subtype` is the scope fragment that
 * goes inside the fingerprint: it is what keeps two rows about the same page
 * (one about dimensions, one about weight) from colliding into one.
 */
interface ImageFinding {
  subtype: string;
  severity: IssueSeverityValue;
  title: string;
  measuredValue: string;
  criterion: string;
  recommendation: string;
}

/**
 * Classifies one probe result into zero, one or two findings.
 *
 * Exported so the nine branches can be tested without building a page context
 * for each case: the decision and the emission are deliberately separate.
 *
 * **No status carve-out.** Every 4xx and 5xx — including 401, 402, 403, 405,
 * 406, 429 and everything at or above 520 — is an unreachable image with
 * `critical` severity, exactly like a 404. `brokenExternalLinks.ts` degrades
 * those same statuses to informational for external links (TECH-12), and that
 * function is deliberately not imported, copied or rewritten here:
 * `31-CONTEXT.md` locked the opposite decision for og:image ("Error: ... o
 * imagen no alcanzable (4xx/5xx o content-type no es imagen)") and acceptance
 * criterion 2 of the ROADMAP repeats it. A wall that rejects the auditor also
 * rejects the crawlers of Facebook, X and LinkedIn.
 */
export function classifyImageProbe(result: ImageProbeResult): ImageFinding[] {
  const url = cap(result.url);

  if (!result.ok) {
    // Nuestra propia defensa rechazó el destino antes de abrir la conexión: no
    // hubo respuesta HTTP de ninguna clase, así que no hay 4xx ni 5xx que
    // clasificar y declarar la imagen rota sería inventar evidencia que el
    // sondeo nunca obtuvo. Va antes que la rama de inalcanzable a propósito.
    if (UNVERIFIABLE_PROBE_REASONS.includes(result.reason)) {
      return [
        {
          subtype: UNVERIFIABLE_SUBTYPE,
          severity: "warning",
          title: "Imagen social no verificable",
          measuredValue: `${result.reason}${SEPARATOR}${url}`,
          criterion:
            "El destino de la imagen no se pudo resolver a una dirección pública, así que la verificación automática no se ejecutó",
          recommendation:
            "Revisa manualmente que la imagen cargue en una ventana privada del navegador; una imagen alojada en una red interna no es accesible para los rastreadores de Facebook, X ni LinkedIn.",
        },
      ];
    }

    return [
      {
        subtype: UNREACHABLE_SUBTYPE,
        severity: "critical",
        title: "Imagen social inalcanzable",
        measuredValue: `${result.status ? `HTTP ${result.status}` : result.reason}${SEPARATOR}${url}`,
        criterion: UNREACHABLE_CRITERION,
        recommendation: UNREACHABLE_RECOMMENDATION,
      },
    ];
  }

  const contentType = result.contentType;

  // Se miran las dos señales disponibles porque un servidor puede servir el SVG
  // con tipo genérico y la lectura de dimensiones sí reconocerlo.
  if (contentType?.startsWith("image/svg") || result.dimensions?.type === "svg") {
    return [
      {
        subtype: SVG_SUBTYPE,
        severity: "critical",
        title: "Imagen social en un formato que las plataformas no renderizan",
        measuredValue: `SVG${SEPARATOR}${url}`,
        criterion: "Las plataformas sociales no generan vista previa con imágenes vectoriales",
        recommendation:
          "Exporta la imagen social a PNG o JPEG en 1200 por 630 píxeles y apunta og:image a ese archivo.",
      },
    ];
  }

  // Regla de dos señales: las DOS condiciones a la vez, nunca una sola. Muchos
  // servidores mal configurados sirven imágenes válidas con un tipo genérico o
  // vacío, y marcarlas por la cabecera convertiría una mala configuración ajena
  // en un defecto inventado del usuario. Si los bytes parsean, los bytes mandan.
  // El caso simétrico (cabecera de imagen con bytes ilegibles) sale por la rama
  // de dimensiones indeterminadas, con severidad informativa.
  if (!contentType?.startsWith("image/") && result.dimensions === null) {
    return [
      {
        subtype: NOT_IMAGE_SUBTYPE,
        severity: "critical",
        title: "La URL de og:image no devuelve una imagen",
        measuredValue: `${contentType ? cap(contentType) : "sin content-type"}${SEPARATOR}${url}`,
        criterion:
          "La URL declarada en og:image debe devolver un archivo de imagen para que las plataformas puedan mostrar la vista previa",
        recommendation:
          "Revisa que la URL de og:image apunte al archivo de imagen y no a una página HTML o a una redirección de error.",
      },
    ];
  }

  // A diferencia de las cuatro ramas de arriba, los dos bloques que siguen NO
  // cortan entre sí: una imagen puede ser chica y además pesada, y las dos
  // filas son información distinta. El máximo por página son dos filas, con
  // subtipos distintos y por lo tanto fingerprints distintos.
  const findings: ImageFinding[] = [];
  const dimensions = result.dimensions;

  if (dimensions === null) {
    // Que el fragmento pedido no alcanzara para leer el marcador es una
    // limitación de nuestro método de medición, no una falla del sitio
    // auditado: por eso es informativo y nunca un defecto. Aquí llega el caso
    // simétrico de la regla de dos señales (cabecera de imagen, bytes ilegibles).
    findings.push({
      subtype: UNDETERMINED_SUBTYPE,
      severity: "ok",
      title: "Dimensiones de la imagen social no determinadas",
      measuredValue: `dimensiones indeterminadas${SEPARATOR}${url}`,
      criterion:
        "El fragmento de imagen que se descarga para medirla no siempre contiene el marcador de dimensiones",
      recommendation:
        "Sin acción necesaria. La imagen responde correctamente; solo no se pudo medir su tamaño en píxeles sin descargarla entera.",
    });
  } else {
    const { width, height } = dimensions;
    const size = `${width}×${height}`;

    if (width < OG_IMAGE_MIN_WIDTH || height < OG_IMAGE_MIN_HEIGHT) {
      findings.push({
        subtype: TOO_SMALL_SUBTYPE,
        severity: "critical",
        title: "Imagen social por debajo del tamaño mínimo",
        measuredValue: `${size}${SEPARATOR}${url}`,
        criterion: `Por debajo de ${OG_IMAGE_MIN_WIDTH} por ${OG_IMAGE_MIN_HEIGHT} píxeles las plataformas ignoran la imagen y la vista previa queda sin imagen`,
        recommendation:
          "Reemplaza la imagen social por una de al menos 1200 por 630 píxeles, que es el tamaño recomendado por Facebook, X y LinkedIn.",
      });
    } else if (width < OG_IMAGE_SMALL_WIDTH || height < OG_IMAGE_SMALL_HEIGHT) {
      findings.push({
        subtype: SUBOPTIMAL_SUBTYPE,
        severity: "warning",
        title: "Imagen social más pequeña de lo recomendado",
        measuredValue: `${size}${SEPARATOR}${url}`,
        criterion: `Por debajo de ${OG_IMAGE_SMALL_WIDTH} por ${OG_IMAGE_SMALL_HEIGHT} píxeles la vista previa se muestra como miniatura pequeña en lugar de imagen grande`,
        recommendation:
          "Sube una imagen de 1200 por 630 píxeles para que la vista previa use el formato grande.",
      });
    } else {
      // La banda se compara contra sus dos extremos explícitos y nunca contra
      // el objetivo más o menos una tolerancia: con estrictamente menor y
      // estrictamente mayor, los dos extremos exactos pasan.
      const ratio = width / height;
      if (ratio < OG_IMAGE_RATIO_MIN || ratio > OG_IMAGE_RATIO_MAX) {
        findings.push({
          subtype: SUBOPTIMAL_SUBTYPE,
          severity: "warning",
          title: "Proporción de la imagen social lejos de la recomendada",
          measuredValue: `${size}${SEPARATOR}${ratio.toFixed(2)}${SEPARATOR}${url}`,
          criterion: `La proporción recomendada por las plataformas es ${OG_IMAGE_TARGET_RATIO} a 1; una imagen muy distinta se recorta en la vista previa`,
          recommendation:
            "Recorta o rehace la imagen social en proporción 1.91 a 1, por ejemplo 1200 por 630 píxeles.",
        });
      }
    }
  }

  // Contrato de precisión de IMG-04: las dos comparaciones se hacen sobre el
  // ENTERO de bytes con estrictamente mayor que. El redondeo a un decimal vive
  // sólo en el texto del valor medido y jamás alimenta un umbral — comparar
  // sobre el valor redondeado desplazaría el umbral real hasta medio mebibyte.
  const totalBytes = result.totalBytes;
  if (totalBytes !== null) {
    const weight = `${toMib(totalBytes)} MB${SEPARATOR}${url}`;

    if (totalBytes > OG_IMAGE_MAX_BYTES) {
      findings.push({
        subtype: TOO_LARGE_SUBTYPE,
        severity: "critical",
        title: "Imagen social demasiado pesada",
        measuredValue: weight,
        criterion:
          "Por encima de 5 MB las plataformas más estrictas rechazan la imagen y no generan vista previa",
        recommendation:
          "Comprime la imagen social o reexpórtala en JPEG de calidad alta; una imagen de 1200 por 630 píxeles no debería superar unos pocos cientos de kilobytes.",
      });
    } else if (totalBytes > OG_IMAGE_HEAVY_BYTES) {
      findings.push({
        subtype: HEAVY_SUBTYPE,
        severity: "warning",
        title: "Imagen social más pesada de lo recomendado",
        measuredValue: weight,
        criterion:
          "Una imagen social por encima de 1 MB tarda en cargar y algunas plataformas la descartan al generar la vista previa",
        recommendation:
          "Comprime la imagen social; con 1200 por 630 píxeles suele alcanzar con menos de 300 KB.",
      });
    }
  }

  return findings;
}

interface ImageEntry {
  /** URL actually requested: the unnormalized absolute form (see below). */
  fetchUrl: string;
  /** Every page that declares this image, in crawl order. */
  pages: { id: string; url: string }[];
}

/**
 * IMG-01: network validation of the declared og:image.
 *
 * Two independent decisions, deliberately separated:
 * - the **fetch** is deduped by normalized URL, so one unique image costs one
 *   request no matter how many pages declare it (IMG-01, threat T-31-04);
 * - the **emission** fans out, one row per affected page, each with its own
 *   `pageId` and its own fingerprint (`emision-por-pagina`, resolved at the
 *   Task 1 checkpoint of 31-01). A single site-level row would move the social
 *   score by less than a hundredth of a point and would not land on the
 *   per-page view of the report, which is where the user looks for it.
 *
 * A page with no og:image, or with one whose scheme is neither http nor https,
 * produces no row and no request: SOCIAL-03 already reports that absence and
 * duplicating the signal degrades both the report and the score.
 */
export const ogImageNetworkCheck: NetworkCheck = {
  checkId: CHECK_ID,
  async run({ pages, origin }) {
    const images = new Map<string, ImageEntry>();

    for (const page of pages) {
      if (!page.html) continue;
      const baseUrl = page.finalUrl ?? page.url;
      const $ = cheerio.load(page.html);

      // La lectura sale del extractor de la categoría social, que ya une los
      // atributos property y name; un selector propio dentro del check
      // reintroduciría el defecto por el que se retiró ONPAGE-05.
      const value = firstValue(extractMetaSocial($), "og:image");
      if (!value) continue;

      // Devuelve nulo tanto para lo no parseable como para todo esquema
      // distinto de http y https: los dos casos ya los reporta SOCIAL-03.
      const key = normalizeUrl(value, baseUrl);
      if (!key) continue;

      // La URL de la petición se calcula aparte, SIN normalizar: la
      // normalización reordena los parámetros de query y eso invalida las
      // firmas de los CDN que firman por query. La normalizada sólo sirve
      // como clave de dedupe.
      let fetchUrl: string;
      try {
        fetchUrl = new URL(value, baseUrl).toString();
      } catch {
        continue;
      }

      const existing = images.get(key);
      if (existing) {
        existing.pages.push({ id: page.id, url: baseUrl });
      } else {
        images.set(key, { fetchUrl, pages: [{ id: page.id, url: baseUrl }] });
      }
    }

    if (images.size === 0) return [];

    const allEntries = Array.from(images.values());
    const entries = allEntries.slice(0, MAX_URLS_PER_NETWORK_CHECK);
    const results = await probeImages(entries.map((entry) => entry.fetchUrl));

    const issues: IssueDraft[] = [];

    if (allEntries.length > entries.length) {
      issues.push({
        checkId: CHECK_ID,
        category: "social",
        title: "Verificación de imágenes sociales limitada",
        severity: "ok",
        measuredValue: `Se verificaron ${entries.length} de ${allEntries.length} imágenes únicas`,
        source: origin,
        criterion:
          "En el plan gratuito se verifica una muestra de imágenes sociales para acotar el tiempo de auditoría",
        recommendation:
          "Sin acción necesaria. El resto de las imágenes se verificarán en próximas auditorías o en un plan superior.",
        fingerprint: siteFingerprint(CHECK_ID, CAPPED_SCOPE),
        scope: CAPPED_SCOPE,
      });
    }

    // El orden que preserva el runner de concurrencia es lo que permite
    // emparejar results[i] con entries[i], y de ahí con sus páginas.
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const result = results[i];
      if (!entry || !result) continue;

      // La decisión se toma una vez por imagen; el fan-out la repite por cada
      // página que la declara, con su propio pageId y su propio fingerprint. El
      // ámbito (`source`) y el fingerprint llevan la URL de la página COMPLETA:
      // el recorte es sólo para el valor medido, y aplicarlo a la clave de
      // identidad colapsaría en una sola fila dos destinos de prefijo común.
      for (const finding of classifyImageProbe(result)) {
        for (const affected of entry.pages) {
          issues.push({
            checkId: CHECK_ID,
            category: "social",
            title: finding.title,
            severity: finding.severity,
            measuredValue: finding.measuredValue,
            source: affected.url,
            criterion: finding.criterion,
            recommendation: finding.recommendation,
            fingerprint: pageFingerprint(`${CHECK_ID}:${finding.subtype}`, affected.url),
            pageId: affected.id,
          });
        }
      }
    }

    return issues;
  },
};
