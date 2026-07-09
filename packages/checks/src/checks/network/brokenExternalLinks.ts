import * as cheerio from "cheerio";
import { normalizeUrl, sameRegistrableDomain } from "@auditor/crawler";
import type { IssueDraft, NetworkCheck } from "../../types";
import { siteFingerprint } from "../../util";
import { checkLinks, MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";

const CHECK_ID = "TECH-12";

/**
 * HTTP statuses that mean "we couldn't verify this link" rather than "this link
 * is broken": anti-bot blocks, auth walls and paywalls. Many legitimate targets
 * return these to any non-browser client — LinkedIn answers `999` to every bot,
 * Kajabi/checkout pages answer `402`/`403`, auth-gated pages answer `401`.
 * Flagging them as broken is a false positive, so they get an informational
 * "no verificable" note instead of a "roto" warning.
 */
function isBlockedStatus(status: number | null): boolean {
  if (status === null) return false;
  // 401 auth, 402 payment, 403 forbidden, 405 method-not-allowed (rejects
  // HEAD/GET probes), 406 not-acceptable, 429 rate-limited.
  if (status === 401 || status === 402 || status === 403) return true;
  if (status === 405 || status === 406 || status === 429) return true;
  // Non-standard vendor codes (LinkedIn's 999, Cloudflare-ish >= 520, anything
  // outside the real HTTP range): treat as "couldn't verify", not "broken".
  if (status >= 520) return true;
  return false;
}

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

      // Anti-bot / auth / paywall responses are not broken links — report them
      // as an informational "no verificable" note so they don't pollute the
      // real broken-link warnings.
      if (isBlockedStatus(result.status)) {
        const scope = `external-link-unverifiable:${result.url}`;
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Enlace externo no verificable",
          severity: "ok",
          measuredValue: `HTTP ${result.status}`,
          source: `${result.url} (enlazado desde ${sourcePage})`,
          criterion: "Algunos destinos bloquean bots o requieren autenticación/pago y no se pueden verificar automáticamente",
          recommendation: "No requiere acción: el destino responde a navegadores pero rechaza verificaciones automáticas (bloqueo anti-bot, login o pago). Confirmá el enlace manualmente si tenés dudas.",
          fingerprint: siteFingerprint(CHECK_ID, scope),
          scope,
        });
        continue;
      }

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
