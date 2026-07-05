import type { Page } from "@auditor/db";

/** Builds a minimal fake `Page` row for unit tests (only fields checks read are required). */
export function makePage(overrides: Partial<Page> & { url: string }): Page {
  return {
    id: overrides.id ?? `page-${overrides.url}`,
    auditId: overrides.auditId ?? "audit-1",
    url: overrides.url,
    statusCode: overrides.statusCode ?? 200,
    html: overrides.html ?? null,
    finalUrl: overrides.finalUrl ?? overrides.url,
    redirectChain: overrides.redirectChain ?? null,
    contentType: overrides.contentType ?? "text/html",
    depth: overrides.depth ?? 0,
    fromSitemap: overrides.fromSitemap ?? true,
    fetchedAt: overrides.fetchedAt ?? new Date(),
    error: overrides.error ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  } as Page;
}
