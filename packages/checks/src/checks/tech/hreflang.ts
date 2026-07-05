import * as cheerio from "cheerio";
import { normalizeUrl } from "@auditor/crawler";
import type { IssueDraft, SiteCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "TECH-10";

interface PageHreflangInfo {
  url: string;
  canonical: string | null;
  alternates: { lang: string; href: string }[];
}

function extractInfo(html: string, pageUrl: string): PageHreflangInfo {
  const $ = cheerio.load(html);
  const canonicalHref = $('link[rel="canonical"]').first().attr("href")?.trim();
  const canonical = canonicalHref ? normalizeUrl(canonicalHref, pageUrl) : null;

  const alternates: { lang: string; href: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_i, el) => {
    const lang = $(el).attr("hreflang")?.trim();
    const href = $(el).attr("href")?.trim();
    if (!lang || !href) return;
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized) alternates.push({ lang, href: normalized });
  });

  return { url: normalizeUrl(pageUrl) ?? pageUrl, canonical, alternates };
}

/**
 * TECH-10: hreflang reciprocity (return links) across the crawled set, and
 * canonical/hreflang conflicts — mirrors the reference report semantics:
 * "declares hreflang to X but X has no return link".
 *
 * Scope: only validated across pages actually in the crawled set (no
 * cross-domain hreflang validation — deferred to v2 per 03-CONTEXT.md).
 */
export const hreflangCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ pages }) {
    const infos: PageHreflangInfo[] = [];
    for (const page of pages) {
      if (!page.html) continue;
      infos.push(extractInfo(page.html, page.finalUrl ?? page.url));
    }

    const byUrl = new Map(infos.map((info) => [info.url, info]));
    const issues: IssueDraft[] = [];
    const reportedMissingReciprocity = new Set<string>();
    const reportedCanonicalConflicts = new Set<string>();

    for (const info of infos) {
      if (info.alternates.length === 0) continue;

      for (const alt of info.alternates) {
        const target = byUrl.get(alt.href);

        // Only check reciprocity for targets that are part of the crawled set.
        if (target) {
          const hasReturnLink = target.alternates.some((targetAlt) => targetAlt.href === info.url);
          if (!hasReturnLink) {
            const pairKey = `${info.url}->${alt.href}`;
            if (!reportedMissingReciprocity.has(pairKey)) {
              reportedMissingReciprocity.add(pairKey);
              const scope = `reciprocity:${pairKey}`;
              issues.push({
                checkId: CHECK_ID,
                category: "tech",
                title: "hreflang sin enlace de retorno (reciprocidad rota)",
                severity: "warning",
                measuredValue: `${info.url} declara hreflang="${alt.lang}" hacia ${alt.href}, pero ${alt.href} no enlaza de vuelta`,
                source: info.url,
                criterion: "Cada hreflang debe ser recíproco: si A declara alternate hacia B, B debe declarar alternate hacia A",
                recommendation: `Agrega en ${alt.href} un <link rel="alternate" hreflang> de retorno hacia ${info.url} para que la reciprocidad sea válida.`,
                fingerprint: siteFingerprint(CHECK_ID, scope),
                scope,
              });
            }
          }

          // Canonical-hreflang conflict: the target page's canonical points
          // somewhere other than itself, meaning the hreflang alternate is
          // referencing a non-canonical URL.
          if (target.canonical && target.canonical !== target.url) {
            const conflictKey = `${info.url}->${alt.href}`;
            if (!reportedCanonicalConflicts.has(conflictKey)) {
              reportedCanonicalConflicts.add(conflictKey);
              const scope = `canonical-conflict:${conflictKey}`;
              issues.push({
                checkId: CHECK_ID,
                category: "tech",
                title: "Conflicto entre hreflang y canonical",
                severity: "warning",
                measuredValue: `${info.url} declara hreflang hacia ${alt.href}, pero esa URL tiene canonical hacia ${target.canonical}`,
                source: info.url,
                criterion: "El hreflang debe apuntar a la versión canonical de cada idioma, no a una URL que a su vez es canonicalizada hacia otra",
                recommendation: `Actualiza el hreflang en ${info.url} para que apunte directamente a ${target.canonical} en lugar de ${alt.href}.`,
                fingerprint: siteFingerprint(CHECK_ID, scope),
                scope,
              });
            }
          }
        }
      }
    }

    return issues;
  },
};
