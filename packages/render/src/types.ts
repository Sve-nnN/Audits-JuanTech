/**
 * Contracts for the worker-only `@auditor/render` package.
 *
 * These types are kept LOCAL (no dependency on `@auditor/checks`) so the
 * render package stays decoupled — the same pattern `@auditor/psi` follows
 * with its own `PerfIssueDraft`. `RenderIssueDraft` is structurally identical
 * to `@auditor/checks` `IssueDraft`, so the worker can persist it as an
 * `Issue` row without any adapter.
 */

/** Verdict for how a page delivers its key content. */
export type RenderVerdict = "ssr" | "csr" | "undetermined";

export type RenderSeverityValue = "critical" | "warning" | "ok";

/**
 * Rendered DOM snapshot produced by the Playwright side (plan 12-02).
 * Values are already `textContent`-normalized by the browser before they
 * reach the pure `detectRenderVerdict` comparison.
 */
export interface RenderedSnapshot {
  title: string;
  h1: string;
  text: string;
}

/**
 * A single render finding, ready to persist as an `Issue` row
 * (minus `id`/`auditId`/`createdAt`, which the worker fills in).
 *
 * Structurally identical to `@auditor/checks` `IssueDraft` — do NOT import
 * that type here; keep the render package free of the checks dependency.
 */
export interface RenderIssueDraft {
  checkId: string;
  category: string;
  title: string;
  severity: RenderSeverityValue;
  /**
   * Explicit verdict this draft was derived from — lets the worker build a
   * per-page verdict lookup (renderVerdictByPageId) without re-parsing
   * title/fingerprint strings.
   */
  verdict: RenderVerdict;
  measuredValue?: string;
  source?: string;
  criterion?: string;
  recommendation?: string;
  fingerprint: string;
  /** Page-level issues attach to a specific crawled page. */
  pageId?: string;
}
