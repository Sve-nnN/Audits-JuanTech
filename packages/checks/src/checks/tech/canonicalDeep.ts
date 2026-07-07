import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Page } from "@auditor/db";
import type { IssueDraft, SiteCheck } from "../../types";
import { pageFingerprint } from "../../util";
import { normalizeUrl, sameRegistrableDomain } from "@auditor/crawler";

const CHECK_ID = "TECH-04";

/** Reads meta robots noindex the same way as indexability.ts (TECH-05). */
function hasNoindex($: CheerioAPI): boolean {
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  return /noindex/.test(robotsMeta);
}

/** First canonical href (trimmed) declared in the document, if any. */
function firstCanonicalHref($: CheerioAPI): string | undefined {
  return $('link[rel="canonical"]').first().attr("href")?.trim() || undefined;
}

/** Safe host extraction — malformed URLs never throw (see threat T-11-01). */
function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/**
 * TECH-04 (deep): resolves the state of the canonical *target* against the
 * already-crawled page set — no network calls. The page-level `canonicalCheck`
 * still handles presence / single / self-consistency; this SiteCheck covers the
 * cases that need the whole set (target indexability / HTTP status / chains /
 * domain / shape). Every finding uses a sub-typed fingerprint so multiple
 * findings on the same page never collapse into one diff row.
 */
export const canonicalDeep: SiteCheck = {
  checkId: CHECK_ID,
  run({ pages }): IssueDraft[] {
    const issues: IssueDraft[] = [];

    // Index every page by its normalized url AND normalized finalUrl so a
    // canonical pointing at either the requested or the resolved URL resolves.
    const index = new Map<string, Page>();
    for (const page of pages) {
      const keys = [normalizeUrl(page.url), normalizeUrl(page.finalUrl ?? page.url)];
      for (const key of keys) {
        if (key && !index.has(key)) index.set(key, page);
      }
    }

    for (const page of pages) {
      if (!page.html) continue;
      const $ = cheerio.load(page.html);

      const canonicalTags = $('link[rel="canonical"]');
      if (canonicalTags.length === 0) continue;

      const hrefs: string[] = [];
      canonicalTags.each((_i, el) => {
        const h = $(el).attr("href")?.trim();
        if (h) hrefs.push(h);
      });
      if (hrefs.length === 0) continue;

      const url = page.finalUrl ?? page.url;
      const fp = (subtype: string) => pageFingerprint(`${CHECK_ID}:${subtype}`, url);

      // TECH-04:multiple-conflicting (WARNING) — >1 tag con destinos distintos.
      // Normaliza cada href (resuelto contra la URL de la página) antes de
      // deduplicar: el mismo destino escrito como relativo+absoluto o con/sin
      // barra final NO debe contar como conflicto.
      const distinctHrefs = new Set(hrefs.map((h) => normalizeUrl(h, url) ?? h));
      if (distinctHrefs.size > 1) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Múltiples canonical conflictivas",
          severity: "warning",
          measuredValue: `${distinctHrefs.size} destinos canonical distintos`,
          source: url,
          criterion: "Debe existir una única URL canonical por página",
          recommendation:
            "Deja una sola etiqueta canonical; múltiples destinos distintos generan señales contradictorias para el buscador.",
          fingerprint: fp("multiple-conflicting"),
          pageId: page.id,
        });
      }

      const primary = hrefs[0]!;
      const isAbsolute = /^https?:\/\//i.test(primary);

      // TECH-04:relative (WARNING) — href presente que no es absoluto.
      if (!isAbsolute) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Canonical relativa (no absoluta)",
          severity: "warning",
          measuredValue: primary,
          source: url,
          criterion: "La canonical debe declararse como URL absoluta",
          recommendation: "Usa una URL absoluta (https://...) en el href de la canonical para evitar ambigüedad.",
          fingerprint: fp("relative"),
          pageId: page.id,
        });
      }

      // TECH-04:noindex-conflict (CRITICAL) — la propia página tiene canonical y noindex.
      if (hasNoindex($)) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Conflicto canonical + noindex",
          severity: "critical",
          measuredValue: "canonical presente y meta robots noindex",
          source: url,
          criterion: "Una página con canonical no debería marcarse noindex a la vez",
          recommendation:
            "Elige una sola señal: si la página debe indexarse quita el noindex; si no debe indexarse, quita la canonical y deja el noindex.",
          fingerprint: fp("noindex-conflict"),
          pageId: page.id,
        });
      }

      // Target-based checks only run for an absolute canonical distinct from self.
      if (!isAbsolute) continue;

      const canonicalUrl = normalizeUrl(primary, url) ?? primary;
      const selfUrl = normalizeUrl(url) ?? url;

      // TECH-04:cross-domain (WARNING) — destino en OTRO dominio registrable.
      // Compara por dominio registrable (no host exacto) para no marcar como
      // cross-domain la canonicalización legítima www↔no-www ni entre
      // subdominios del mismo sitio (blog.example.com → example.com).
      const targetHost = safeHost(canonicalUrl);
      const pageHost = safeHost(selfUrl);
      if (targetHost && pageHost && !sameRegistrableDomain(canonicalUrl, selfUrl)) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Canonical cross-domain",
          severity: "warning",
          measuredValue: canonicalUrl,
          source: url,
          criterion: "La canonical suele apuntar al mismo dominio de la página",
          recommendation:
            "Confirma si la canonical cross-domain es intencional (contenido sindicado); si no, apunta la canonical al dominio propio.",
          fingerprint: fp("cross-domain"),
          pageId: page.id,
        });
      }

      if (canonicalUrl === selfUrl) continue;

      const target = index.get(canonicalUrl);
      // Destino same-domain ausente del set → skip silencioso (cero falso positivo).
      if (!target) continue;

      // Estado del destino frente al set crawleado.
      if (target.html) {
        const $t = cheerio.load(target.html);

        // TECH-04:noindex-target (CRITICAL).
        if (hasNoindex($t)) {
          issues.push({
            checkId: CHECK_ID,
            category: "tech",
            title: "Canonical apunta a página noindex",
            severity: "critical",
            measuredValue: canonicalUrl,
            source: url,
            criterion: "El destino de la canonical debe ser indexable",
            recommendation:
              "La página destino tiene noindex: apunta la canonical a una URL indexable o retira el noindex del destino.",
            fingerprint: fp("noindex-target"),
            pageId: page.id,
          });
        }

        // TECH-04:chain (CRITICAL) — el destino declara a su vez otra canonical.
        const targetHref = firstCanonicalHref($t);
        if (targetHref) {
          const targetSelf = normalizeUrl(target.finalUrl ?? target.url) ?? (target.finalUrl ?? target.url);
          const targetCanonical = normalizeUrl(targetHref, target.finalUrl ?? target.url) ?? targetHref;
          if (targetCanonical !== targetSelf) {
            issues.push({
              checkId: CHECK_ID,
              category: "tech",
              title: "Cadena de canonicals (canonical→canonical)",
              severity: "critical",
              measuredValue: `${canonicalUrl} → ${targetCanonical}`,
              source: url,
              criterion: "La canonical debe apuntar a una URL final, no a otra que a su vez tenga canonical distinta",
              recommendation:
                "Apunta la canonical directamente a la URL final; las cadenas de canonicals diluyen la señal de indexación.",
              fingerprint: fp("chain"),
              pageId: page.id,
            });
          }
        }
      }

      const targetStatus = target.statusCode ?? 0;

      // TECH-04:redirect-target (CRITICAL) — destino 3xx.
      if (targetStatus >= 300 && targetStatus < 400) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Canonical apunta a una redirección",
          severity: "critical",
          measuredValue: `${canonicalUrl} (HTTP ${targetStatus})`,
          source: url,
          criterion: "El destino de la canonical debe responder 200, no una redirección",
          recommendation: "Apunta la canonical a la URL final (200) en lugar de a una que devuelve 3xx.",
          fingerprint: fp("redirect-target"),
          pageId: page.id,
        });
      }

      // TECH-04:http-error-target (CRITICAL) — destino 4xx/5xx.
      if (targetStatus >= 400 && targetStatus < 600) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Canonical apunta a una página con error HTTP",
          severity: "critical",
          measuredValue: `${canonicalUrl} (HTTP ${targetStatus})`,
          source: url,
          criterion: "El destino de la canonical debe responder 200",
          recommendation: `El destino devuelve HTTP ${targetStatus}: apunta la canonical a una URL válida (200).`,
          fingerprint: fp("http-error-target"),
          pageId: page.id,
        });
      }

      // TECH-04:final-url-mismatch (WARNING) — el destino redirige a otra finalUrl.
      const targetFinal = normalizeUrl(target.finalUrl ?? target.url) ?? (target.finalUrl ?? target.url);
      if (targetFinal !== canonicalUrl) {
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Canonical difiere de la URL final del destino",
          severity: "warning",
          measuredValue: `${canonicalUrl} → ${targetFinal}`,
          source: url,
          criterion: "La canonical debería coincidir con la URL final resuelta del destino",
          recommendation: "Actualiza la canonical para que apunte directamente a la URL final resuelta del destino.",
          fingerprint: fp("final-url-mismatch"),
          pageId: page.id,
        });
      }
    }

    return issues;
  },
};
