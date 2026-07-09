/**
 * Helpers de URL para la tabla de issues. Funciones puras,
 * server/client-agnósticas (sin "use client"). Extraídas verbatim desde
 * audits/[id]/page.tsx para reutilizarlas en IssuesTable.
 */

/**
 * The URL an issue is about. Page-level checks put the page URL in `source`;
 * some checks append " (enlazado desde X)" — keep just the leading URL. Falls
 * back to `scope`. Returned as a compact path for the table.
 */
export function issueUrl(issue: { source: string | null; scope: string | null }): string | null {
  const raw = issue.source ?? issue.scope ?? null;
  if (!raw) return null;
  const firstToken = raw.split(" ")[0] ?? raw;
  return firstToken;
}

/**
 * Compact display for a URL cell. Internal links (same host as the audited
 * site) show just the path — the host is redundant. External links show
 * `host + path` so they're not misread as internal paths (e.g. a LinkedIn
 * link must read `www.linkedin.com/in/juan`, not a bare `/in/juan`). Pass
 * `siteHost` (the audited domain) to enable the internal/external distinction;
 * without it, every URL shows `host + path`.
 */
export function shortUrl(url: string | null, siteHost?: string | null): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    const path = (u.pathname + u.search) || "/";
    const host = u.host.replace(/^www\./i, "");
    const site = siteHost ? siteHost.replace(/^www\./i, "").toLowerCase() : null;
    const isInternal = site !== null && host.toLowerCase() === site;
    return isInternal ? path : `${host}${path === "/" ? "" : path}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}
