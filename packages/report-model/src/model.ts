import type { Category, ScoreStatus, CategoryScoreResult } from "@auditor/scoring";
import type { Confidence } from "@auditor/fingerprint";
import type { PageTemplate } from "./template";

/**
 * Serializable report model shared by the on-screen report
 * (`apps/web/app/audits/[id]/page.tsx`) and the export serializers
 * (`@auditor/export`, Plans 02/03). Pure data — no React, no classes, no
 * Prisma models. NEVER contains PII (email / verification token); only audit
 * data (audited URL, score, categories, issues, pages).
 */

export type ReportSeverity = "critical" | "warning" | "ok";
export type ReportDiffStatus = "new" | "persistent" | "resolved";

/**
 * The subset of a persisted Issue that the report uses, plus the derived `url`
 * the issue is about (resolved exactly like the report's `issueUrl` helper).
 */
export interface ReportIssue {
  id: string;
  checkId: string;
  category: string;
  title: string;
  severity: ReportSeverity;
  measuredValue: string | null;
  source: string | null;
  criterion: string | null;
  recommendation: string | null;
  fingerprint: string;
  diffStatus: ReportDiffStatus | null;
  /** URL the issue is about, derived from `source`/`scope`. */
  url: string | null;
  /** `Page.id` the issue belongs to; `null` for site-level checks. */
  pageId: string | null;
}

/** A resolved issue carried over from the previous audit's diff. */
export interface ReportResolvedIssue {
  checkId: string;
  title: string;
  category: string;
}

export interface ReportStrategyPerf {
  avgScore: number | null;
  avgLcpMs: number | null;
  avgCls: number | null;
  avgInpMs: number | null;
  avgTtfbMs: number | null;
}

export interface ReportPerf {
  sampledPages: number;
  sampledUrls: string[];
  mobile: ReportStrategyPerf;
  desktop: ReportStrategyPerf;
  error?: string;
}

export interface ReportDiff {
  previousAuditId: string | null;
  newCount: number;
  persistentCount: number;
  resolvedCount: number;
  resolvedIssues: ReportResolvedIssue[];
}

/** Audit meta rendered in the report header. No PII. */
export interface ReportAuditMeta {
  domain: string;
  createdAt: Date | null;
  finishedAt: Date | null;
  urlLimit: number;
  /** Audit lifecycle status (always "done" for a built model). */
  status: string;
}

/**
 * A single node in the site architecture tree (Plan 20-02). Built purely from
 * the persisted link graph (`Audit.stats.graph`, Phase 16) plus the audit's
 * `Page` rows — no HTML is re-parsed (ARCH-03). `template` comes from
 * `classifyTemplate` (ARCH-04); `title` from the real `Page.title` column
 * (added in Plan 20-01), `null` when the page has no title.
 */
export interface ArchNode {
  url: string;
  title: string | null;
  /** BFS click-depth from home (`-1` sentinel for orphans with no path). */
  depth: number;
  template: PageTemplate;
  /** `depth > 3` — the "más de 3 clics" indicator (strictly greater than the "3+" bucket floor). */
  isDeep: boolean;
  /** A crawled page not present in the link graph (no reachable path from home). */
  isOrphan: boolean;
}

/**
 * A node in the reconstructed site-architecture tree (Plan 22-01, ARCH-05). It
 * carries every {@link ArchNode} signal (url/title/depth/template/isDeep/
 * isOrphan) plus its real children, so the dendrogram (Plan 22-02) can draw
 * parent→child connections. The tree is rebuilt from `graph.edges`: each node
 * hangs off the lowest-depth node that links to it.
 */
export interface ArchTreeNode extends ArchNode {
  children: ArchTreeNode[];
}

/**
 * The serializable site-architecture model the SVG tree (Plan 22-02) renders.
 * `tree` holds the real nested hierarchy reconstructed from `graph.edges`
 * (Plan 22-01, ARCH-05): its roots are normally the home page at depth 0, and
 * every node hangs off the lowest-depth node that links to it — replacing the
 * old flat depth buckets. `orphans` still holds crawled pages absent from the
 * graph (no parent link, depth `-1`).
 */
export interface ReportArchitecture {
  tree: ArchTreeNode[];
  orphans: ArchNode[];
}

/**
 * A single detected stack axis rendered in the report's tech-stack table
 * (Phase 26, STACKUI-02). Pure serializable data derived from the persisted
 * `Audit.stack` (Phase 25 `AxisResult`): it carries ONLY `value` + `confidence`
 * — the detection `signals`/`evidence` are dropped by `toReportStack` so no
 * internal detection detail (matched needles/headers) leaks to the client
 * (T-26-03-01). `value` is `null` when the axis has no detected technology.
 */
export interface ReportStackAxis {
  /** "WordPress (Elementor)", "Cloudflare", ... o `null` cuando no hay tecnología. */
  value: string | null;
  confidence: Confidence;
}

/**
 * The serializable tech-stack model the report table (Plan 26-05) renders,
 * built from `Audit.stack` by `toReportStack`. Each single-value axis is a
 * {@link ReportStackAxis}; `cms` ALREADY combines the WordPress builder into its
 * value ("WordPress (Elementor)") — there is no separate builder axis. Only
 * `analytics` is an array, because tools coexist (GA4 + GTM + Meta Pixel a la
 * vez); an empty array is the "no detectado" state the UI paints as a row.
 */
export interface ReportStack {
  /** Ya combina builder → "WordPress (Elementor)" (confianza = la del CMS). */
  cms: ReportStackAxis;
  cdn: ReportStackAxis;
  hosting: ReportStackAxis;
  jsFramework: ReportStackAxis;
  /** ARRAY: coexistencia GA4/GTM/Meta Pixel; `[]` → fila "no detectado" en la UI. */
  analytics: ReportStackAxis[];
}

/**
 * Verdict on the declared `og:image` for the preview panel (Phase 32).
 * `"none"` — no image declared; `"unavailable"` — IMG-01 (Phase 31) proved the
 * image unusable, so the panel renders the placeholder and NEVER requests it;
 * `"ok"` — the image may be rendered through the same-origin proxy.
 */
export type SocialImageStatus = "ok" | "unavailable" | "none";

/**
 * Everything the social preview panel (PREVIEW-01..04) paints for ONE page,
 * derived server-side from the persisted `Page.html` — the client never
 * re-parses HTML. Every field is a primitive so the object survives the
 * server→client props boundary (no Map/Set/function anywhere).
 *
 * `title`/`description` already resolve the OG→native fallback; the
 * `*Declared` flags say whether the Open Graph tag itself was present, which is
 * what the fix snippet needs to know (a page rendering fine via `<title>` still
 * lacks `og:title`).
 */
export interface SocialPreviewData {
  pageId: string;
  /** Real crawled URL of the page — never the declared `og:url` (SOCIAL-04 audits that separately). */
  pageUrl: string;
  /** Hostname of `pageUrl`; `""` when the URL does not parse. */
  domain: string;
  title: string | null;
  ogTitleDeclared: boolean;
  description: string | null;
  ogDescriptionDeclared: boolean;
  ogImage: string | null;
  imageStatus: SocialImageStatus;
  ogUrlDeclared: boolean;
  ogTypeDeclared: boolean;
  /** Raw declared `twitter:card` value, `null` when absent. */
  twitterCardDeclared: string | null;
  /** Layout X actually renders: only an explicit, admitted `summary_large_image` widens the card. */
  twitterCardVariant: "summary" | "summary_large_image";
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  /**
   * Verdict for `twitterImage`'s own reachability (CR-01 fix). IMG-01 only
   * network-checks `og:image`, so this can't reuse `imageStatus` blindly: when
   * `twitterImage` is the SAME URL as `ogImage`, IMG-01's verdict genuinely
   * applies and is copied here; when the page declares a distinct
   * `twitter:image`, there is no network check for it (out of scope for this
   * phase), so it defaults to `"ok"` (fail-open) and the client-side `onError`
   * fallback in `PreviewImage` is the real source of truth for it, same as any
   * other image that slips past a network probe.
   */
  twitterImageStatus: SocialImageStatus;
  /** Ready-to-paste `<meta>` block for the missing tags (Plan 32-03). */
  fixSnippet: string | null;
}

export interface ReportModel {
  audit: ReportAuditMeta;
  /** Whether the audit persisted a scoring snapshot (drives the status badge). */
  hasScores: boolean;
  overall: number | null;
  /** Overall score status (defaults to "critical" when no scores were persisted). */
  status: ScoreStatus;
  byCategory: Partial<Record<Category, CategoryScoreResult>>;
  diff: ReportDiff;
  /**
   * ALL critical+warning issues, ordered by severity (critical < warning) then
   * category, WITHOUT truncation. This is the "M" (total) source for the
   * "mostrando N de M" note in the report and exports.
   */
  priorityCandidates: ReportIssue[];
  /** First `MAX_PRIORITY_ROWS` of `priorityCandidates` — what the on-screen table shows. */
  priorityIssues: ReportIssue[];
  /** `priorityCandidates.length` — the "M" in "mostrando N de M". */
  totalPriorityCandidates: number;
  /** Every persisted issue grouped by category (includes Phase 11/12 checks). */
  issuesByCategory: Record<Category, ReportIssue[]>;
  /**
   * Every persisted issue with a resolvable URL, grouped by page template
   * (TEMPLATE-01/02). Issues with `url === null` are omitted here but remain
   * present in `issuesByCategory` (no regression to the existing axis).
   */
  issuesByTemplate: Record<PageTemplate, ReportIssue[]>;
  perf?: ReportPerf;
  /**
   * Site architecture built from the persisted link graph (`Audit.stats.graph`,
   * Phase 16). `undefined` for audits with no persisted graph (pre-Phase-16) —
   * the UI hides the whole architecture section when absent (degradation-safe).
   */
  architecture?: ReportArchitecture;
  /**
   * Detected tech stack built from the persisted `Audit.stack` (Phase 25/26,
   * FPRINT-09). `undefined` when `Audit.stack` is null (audits pre-v1.5) — the
   * UI hides the whole stack section, never renders an empty table. Mismo patrón
   * degradation-safe que `perf?`/`architecture?`.
   */
  stack?: ReportStack;
  /**
   * Social share previews keyed by `Page.id`, derived from `Page.html` for the
   * pages carrying a critical/warning issue of the `social` category (PREVIEW-01).
   * `undefined` when the audit has no such page — the UI never renders an empty
   * panel. Mismo patrón degradation-safe que `perf?`/`architecture?`/`stack?`.
   */
  socialPreviews?: Record<string, SocialPreviewData>;
}
