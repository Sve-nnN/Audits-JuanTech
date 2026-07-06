import * as cheerio from "cheerio";
import { normalizeUrl } from "@auditor/crawler";
import type { IssueDraft, NetworkCheck } from "../../types";
import { siteFingerprint } from "../../util";
import { checkLinks, MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";

const CHECK_ID = "TECH-13";

const RESOURCE_SELECTORS: { selector: string; attr: string }[] = [
  { selector: "img[src]", attr: "src" },
  { selector: "script[src]", attr: "src" },
  { selector: 'link[rel="stylesheet"][href]', attr: "href" },
];

/** TECH-13: broken resources (images, CSS, JS) — HEAD -> GET fallback, deduped. */
export const brokenResourcesCheck: NetworkCheck = {
  checkId: CHECK_ID,
  async run({ pages }) {
    const resources = new Map<string, string>(); // normalized url -> source page

    for (const page of pages) {
      if (!page.html) continue;
      const baseUrl = page.finalUrl ?? page.url;
      const $ = cheerio.load(page.html);
      for (const { selector, attr } of RESOURCE_SELECTORS) {
        $(selector).each((_i, el) => {
          const value = $(el).attr(attr);
          if (!value) return;
          const normalized = normalizeUrl(value, baseUrl);
          if (!normalized) return;
          if (!resources.has(normalized)) resources.set(normalized, baseUrl);
        });
      }
    }

    if (resources.size === 0) return [];

    const allUrls = Array.from(resources.keys());
    const urls = allUrls.slice(0, MAX_URLS_PER_NETWORK_CHECK);
    const results = await checkLinks(urls);

    const issues: IssueDraft[] = [];

    if (allUrls.length > urls.length) {
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Verificación de recursos limitada",
        severity: "ok",
        measuredValue: `Se verificaron ${urls.length} de ${allUrls.length} recursos únicos`,
        source: "",
        criterion: "En el plan gratuito se verifica una muestra de recursos para acotar el tiempo de auditoría",
        recommendation: "Sin acción necesaria. El resto de los recursos se verificarán en próximas auditorías o en un plan superior.",
        fingerprint: siteFingerprint(CHECK_ID, "resources-capped"),
        scope: "resources-capped",
      });
    }
    for (const result of results) {
      if (result.ok) continue;
      const sourcePage = resources.get(result.url) ?? "";
      const scope = `resource:${result.url}`;
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Recurso roto (imagen, CSS o JS)",
        severity: "warning",
        measuredValue: result.status ? `HTTP ${result.status}` : result.reason,
        source: `${result.url} (referenciado desde ${sourcePage})`,
        criterion: "Los recursos referenciados (imágenes, CSS, JS) deben cargar correctamente",
        recommendation: "Corrige la ruta del recurso o restáuralo; un recurso roto puede afectar el renderizado, la performance o la experiencia de usuario.",
        fingerprint: siteFingerprint(CHECK_ID, scope),
        scope,
      });
    }

    return issues;
  },
};
