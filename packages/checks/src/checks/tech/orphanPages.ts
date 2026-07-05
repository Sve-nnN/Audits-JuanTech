import * as cheerio from "cheerio";
import { normalizeUrl, sameRegistrableDomain } from "@auditor/crawler";
import type { IssueDraft, SiteCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "TECH-09";

/**
 * TECH-09: orphan pages — URLs declared in the sitemap that are never linked
 * to from any other crawled page's HTML (no internal inlinks found).
 *
 * We parse every crawled page's stored HTML for internal <a href> links
 * (rather than relying on crawl-time link discovery, which is skipped when
 * seeding from a sitemap — see crawl.ts) so this check works regardless of
 * how the crawl was seeded.
 */
export const orphanPagesCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ pages, origin, sitemapUrls }) {
    if (sitemapUrls.length === 0) return [];

    const homepage = normalizeUrl(origin) ?? origin;
    const linkedUrls = new Set<string>();

    for (const page of pages) {
      if (!page.html) continue;
      const baseUrl = page.finalUrl ?? page.url;
      const $ = cheerio.load(page.html);
      $("a[href]").each((_i, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const normalized = normalizeUrl(href, baseUrl);
        if (!normalized) return;
        if (!sameRegistrableDomain(normalized, origin)) return;
        linkedUrls.add(normalized);
      });
    }

    const orphans: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const normalized = normalizeUrl(sitemapUrl) ?? sitemapUrl;
      if (normalized === homepage) continue; // the homepage is an entry point, not an orphan
      if (!linkedUrls.has(normalized)) orphans.push(normalized);
    }

    if (orphans.length === 0) return [];

    const issues: IssueDraft[] = orphans.map((url) => {
      const scope = `orphan:${url}`;
      return {
        checkId: CHECK_ID,
        category: "tech",
        title: "Página huérfana (sin enlaces internos)",
        severity: "warning",
        measuredValue: "0 enlaces internos entrantes detectados",
        source: url,
        criterion: "Toda URL en el sitemap debería ser alcanzable mediante enlaces internos",
        recommendation: "Enlaza esta página desde algún lugar relevante del sitio (menú, contenido relacionado) para que sea descubrible sin depender sólo del sitemap.",
        fingerprint: siteFingerprint(CHECK_ID, scope),
        scope,
      };
    });

    return issues;
  },
};
