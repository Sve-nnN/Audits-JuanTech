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

export function shortUrl(url: string | null): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}
