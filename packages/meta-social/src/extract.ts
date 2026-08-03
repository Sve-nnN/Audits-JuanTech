import type { CheerioAPI } from "cheerio";
import type { MetaSocialData } from "./types";

/**
 * Single entry point every social check uses to read meta tags.
 *
 * Why the key is the union of `property` and `name`, and never just one of
 * them: the Open Graph protocol specifies `property`, the Twitter Cards spec
 * specifies `name`, and the real emitters in the target WordPress universe
 * mix both vocabularies freely (Yoast ships `twitter:*` under `name` next to
 * `og:*` under `property`; several plugins ship `og:*` under `name` and
 * `twitter:card` under `property`). Reading a single attribute silently drops
 * whichever half the emitter chose and reports a missing tag that is right
 * there in the HTML — the exact defect the retired ONPAGE-05 carried.
 *
 * Why the accumulator is a `Map` and not an object literal: the audited site
 * controls the key text, so a key that happens to be a reserved
 * `Object.prototype` member would be a prototype write on an object literal
 * (T-30-01). A `Map` keeps it an ordinary, inert entry.
 */

/** Meta key prefixes this engine collects; everything else is dropped. */
const SOCIAL_PREFIXES = ["og:", "twitter:"] as const;

/**
 * Walks every `<meta>` tag once and returns the normalized social tag map.
 * Values keep document order, because the Open Graph protocol resolves
 * conflicts in favour of the first tag and SOCIAL-03/SOCIAL-06 need that
 * ordering intact.
 */
export function extractMetaSocial($: CheerioAPI): MetaSocialData {
  const tags = new Map<string, string[]>();

  $("meta").each((_, el) => {
    // A tag present with an empty `content` is a failure, not a pass: it
    // carries no value for the preview, so it never creates an entry.
    const content = $(el).attr("content")?.trim();
    if (!content) return;

    // Los dos atributos se leen siempre, nunca uno como respaldo del otro: una
    // sola etiqueta puede servir a los dos vocabularios a la vez y quedarse con
    // el primero perdería la mitad de la declaración.
    const seen = new Set<string>();
    for (const rawKey of [$(el).attr("property"), $(el).attr("name")]) {
      if (!rawKey) continue;

      const key = rawKey.trim().toLowerCase();
      if (!SOCIAL_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;

      // La misma clave en los dos atributos es una única declaración, no dos:
      // contarla dos veces la volvería un duplicado inventado para SOCIAL-06.
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = tags.get(key);
      if (existing) existing.push(content);
      else tags.set(key, [content]);
    }
  });

  return { tags };
}

/**
 * Reads the first declared value for a key — the only way single-valued
 * checks read the data. Returns `undefined` when the key was never declared
 * with a non-empty content.
 */
export function firstValue(data: MetaSocialData, key: string): string | undefined {
  return data.tags.get(key)?.[0];
}
