import * as cheerio from "cheerio";
import { normalizeUrl } from "@auditor/crawler";
import { extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import type { IssueDraft, NetworkCheck } from "../../types";
import { pageFingerprint, siteFingerprint } from "../../util";
import { MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";
import { probeImages } from "./imageProbe";

const CHECK_ID = "IMG-01";

const UNREACHABLE_SUBTYPE = "og-image-unreachable";
const CAPPED_SCOPE = "og-images-capped";

const UNREACHABLE_CRITERION =
  "La imagen declarada en og:image debe responder correctamente para que las plataformas puedan generar la vista previa";

const UNREACHABLE_RECOMMENDATION =
  "Corrige la URL de og:image o restaura la imagen en el servidor; una imagen que no responde deja la vista previa sin imagen al compartir la página.";

/**
 * Caps any fragment of site-controlled text before it reaches a persisted
 * measured value (mitigation T-31-05). The cap is the category-wide constant
 * declared in the pure engine; this file never declares one of its own, and it
 * is never applied to the fingerprint: two CDN URLs sharing their first
 * characters would collapse into a single row.
 */
const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);

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

      if (result.ok) {
        // 31-04 agrega aquí las ramas de tipo de contenido, dimensiones y peso.
        continue;
      }

      const measuredValue = `${result.status ? `HTTP ${result.status}` : result.reason} · ${cap(entry.fetchUrl)}`;

      for (const affected of entry.pages) {
        issues.push({
          checkId: CHECK_ID,
          category: "social",
          title: "Imagen social inalcanzable",
          severity: "critical",
          measuredValue,
          source: affected.url,
          criterion: UNREACHABLE_CRITERION,
          recommendation: UNREACHABLE_RECOMMENDATION,
          fingerprint: pageFingerprint(`${CHECK_ID}:${UNREACHABLE_SUBTYPE}`, affected.url),
          pageId: affected.id,
        });
      }
    }

    return issues;
  },
};
