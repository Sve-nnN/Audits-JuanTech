import * as cheerio from "cheerio";
import { normalizeUrl, sameRegistrableDomain } from "@auditor/crawler";
import type { IssueDraft, NetworkCheck } from "../../types";
import { siteFingerprint } from "../../util";
import { checkLinks, MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";

const CHECK_ID = "TECH-12";

/** TECH-12: broken external links (HEAD -> GET fallback, deduped, low concurrency). */
export const brokenExternalLinksCheck: NetworkCheck = {
  checkId: CHECK_ID,
  async run({ pages, origin }) {
    const externalLinks = new Map<string, string>(); // normalized url -> a source page url (first seen)

    for (const page of pages) {
      if (!page.html) continue;
      const baseUrl = page.finalUrl ?? page.url;
      const $ = cheerio.load(page.html);
      $("a[href]").each((_i, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const normalized = normalizeUrl(href, baseUrl);
        if (!normalized) return;
        if (sameRegistrableDomain(normalized, origin)) return;
        if (!externalLinks.has(normalized)) externalLinks.set(normalized, baseUrl);
      });
    }

    if (externalLinks.size === 0) return [];

    const allUrls = Array.from(externalLinks.keys());
    const urls = allUrls.slice(0, MAX_URLS_PER_NETWORK_CHECK);
    const results = await checkLinks(urls);

    const issues: IssueDraft[] = [];

    // No silent truncation: if we capped, say so as an informational note.
    if (allUrls.length > urls.length) {
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Verificación de enlaces externos limitada",
        severity: "ok",
        measuredValue: `Se verificaron ${urls.length} de ${allUrls.length} enlaces externos únicos`,
        source: origin,
        criterion: "En el plan gratuito se verifica una muestra de enlaces externos para acotar el tiempo de auditoría",
        recommendation: "Sin acción necesaria. El resto de los enlaces se verificarán en próximas auditorías o en un plan superior.",
        fingerprint: siteFingerprint(CHECK_ID, "external-links-capped"),
        scope: "external-links-capped",
      });
    }
    for (const result of results) {
      if (result.ok) continue;
      const sourcePage = externalLinks.get(result.url) ?? origin;
      const scope = `external-link:${result.url}`;
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Enlace externo roto",
        severity: "warning",
        measuredValue: result.status ? `HTTP ${result.status}` : result.reason,
        source: `${result.url} (enlazado desde ${sourcePage})`,
        criterion: "Los enlaces externos deben resolver correctamente (sin 4xx/5xx/timeout)",
        recommendation: "Corrige o elimina este enlace externo roto; si el recurso se movió, actualiza el href al destino correcto.",
        fingerprint: siteFingerprint(CHECK_ID, scope),
        scope,
      });
    }

    return issues;
  },
};
