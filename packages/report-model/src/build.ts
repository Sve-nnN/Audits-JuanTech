import { prisma } from "@auditor/db";
import type { Category, ScoreStatus, CategoryScoreResult } from "@auditor/scoring";
import type {
  ReportModel,
  ReportIssue,
  ReportDiff,
  ReportPerf,
  ReportResolvedIssue,
  ReportSeverity,
  ReportDiffStatus,
  ArchNode,
  ArchTreeNode,
  ReportArchitecture,
  ReportStack,
  ReportStackAxis,
  SocialPreviewData,
} from "./model";
import { extractSocialPreview } from "./socialPreview";
import type { AxisResult, DetectedStack } from "@auditor/fingerprint";
import { resolveCmsRecommendation } from "@auditor/cms-adapters";
import {
  subtypeFromImgFingerprint,
  OG_IMAGE_CHECK_ID,
  OG_IMAGE_UNREACHABLE_SUBTYPE,
  OG_IMAGE_UNVERIFIABLE_SUBTYPE,
  OG_IMAGE_SVG_SUBTYPE,
  OG_IMAGE_NOT_IMAGE_SUBTYPE,
  OG_IMAGE_TOO_SMALL_SUBTYPE,
  OG_IMAGE_TOO_LARGE_SUBTYPE,
} from "@auditor/meta-social";
import { classifyTemplate, TEMPLATE_ORDER } from "./template";
import type { PageTemplate } from "./template";

/** Max priority rows the on-screen table renders (screen cap, NOT the total). */
export const MAX_PRIORITY_ROWS = 60;

export const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo", "social"];

/** Shape persisted at `Audit.scores` by the worker (Phase 6, SCORE-01..05 + DIFF-01/02). */
interface AuditScores {
  overall: number;
  status: ScoreStatus;
  byCategory: Partial<Record<Category, CategoryScoreResult>>;
  diff: {
    newCount: number;
    persistentCount: number;
    resolvedCount: number;
    resolvedFingerprints: string[];
    previousAuditId: string | null;
  };
}

/** Shape persisted at `Audit.stats` by the worker. */
interface AuditStats {
  perf?: ReportPerf;
  /**
   * Link graph persisted once per audit by the worker (Phase 16, mirrors the
   * `LinkGraph` shape from `@auditor/graph`). `edges` (`{ from, to }`, URLs
   * normalized) are consumed in Plan 22-01 to reconstruct the nested tree —
   * they were previously unused (closes the v1.3 integration-checker note).
   */
  graph?: {
    nodes: { url: string; pageId: string }[];
    edges: { from: string; to: string }[];
    depthByUrl: Record<string, number>;
    /** URLs with ≥1 internal inbound link from any page (Phase 22-04, orphan basis). Optional for pre-22-04 audits. */
    linkedUrls?: string[];
  };
}

/** Minimal Page row buildReportModel loads to build the architecture model. */
interface ArchPageRow {
  id: string;
  url: string;
  finalUrl: string | null;
  title: string | null;
  statusCode: number | null;
  error: string | null;
}

/**
 * A page that failed to download (error set) or returned a 4xx/5xx is not part
 * of the real site architecture: it must not be drawn as a legitimate node
 * (WR-02) nor mislabeled as an orphan (WR-01). Pages with no status yet are
 * treated as broken (they never resolved).
 */
function isBrokenPage(page: ArchPageRow): boolean {
  if (page.error != null) return true;
  if (page.statusCode == null) return true;
  return page.statusCode >= 400;
}

/** Minimal persisted-issue shape buildReportModel reads. */
interface IssueRow {
  id: string;
  checkId: string;
  category: string;
  title: string;
  severity: string;
  measuredValue: string | null;
  source: string | null;
  criterion: string | null;
  scope: string | null;
  recommendation: string | null;
  fingerprint: string;
  diffStatus: string | null;
  pageId: string | null;
}

/** Minimal Page row the social preview derivation loads (never the full row). */
interface SocialPageRow {
  id: string;
  url: string;
  finalUrl: string | null;
  html: string | null;
}

/**
 * Los subtipos de IMG-01 que prueban que la imagen declarada NO se puede pintar:
 * o no responde, o no se pudo verificar, o el formato/tamaño la vuelve
 * inutilizable para una vista previa. El resto de subtipos (subóptima, pesada,
 * indeterminada) describen una imagen que igual carga, así que el panel la
 * muestra.
 */
const UNUSABLE_IMAGE_SUBTYPES: readonly string[] = [
  OG_IMAGE_UNREACHABLE_SUBTYPE,
  OG_IMAGE_UNVERIFIABLE_SUBTYPE,
  OG_IMAGE_SVG_SUBTYPE,
  OG_IMAGE_NOT_IMAGE_SUBTYPE,
  OG_IMAGE_TOO_SMALL_SUBTYPE,
  OG_IMAGE_TOO_LARGE_SUBTYPE,
];

/**
 * Verdict the preview panel needs about the declared `og:image`: whether it can
 * be rendered at all. Sin imagen declarada es `"none"`; con una imagen que
 * IMG-01 (Phase 31) probó inutilizable es `"unavailable"`; en cualquier otro
 * caso — incluidos los avisos que no impiden la carga y la ausencia total de
 * filas IMG-01 — es `"ok"`. Un fingerprint con forma inesperada devuelve `null`
 * al parsearse y cae en la rama `"ok"`: degradado, nunca inseguro (T-32-04).
 */
export function resolveImageStatus(
  ogImage: string | null,
  imgIssues: { fingerprint: string }[]
): "ok" | "unavailable" | "none" {
  if (ogImage == null) return "none";
  for (const issue of imgIssues) {
    const subtype = subtypeFromImgFingerprint(issue.fingerprint);
    if (subtype != null && UNUSABLE_IMAGE_SUBTYPES.includes(subtype)) return "unavailable";
  }
  return "ok";
}

/**
 * The URL an issue is about. Page-level checks put the page URL in `source`;
 * some checks append " (enlazado desde X)" — keep just the leading URL. Falls
 * back to `scope`. Mirrors the report's `issueUrl` helper verbatim to keep the
 * rendered output identical.
 */
function issueUrl(issue: { source: string | null; scope: string | null }): string | null {
  const raw = issue.source ?? issue.scope ?? null;
  if (!raw) return null;
  const firstToken = raw.split(" ")[0] ?? raw;
  return firstToken;
}

/**
 * Map a persisted `IssueRow` to the serializable `ReportIssue`, resolving the
 * CMS-specific recommendation at read time (CMSFIX-05) — nothing is persisted.
 *
 * The `stack` argument is the RAW `DetectedStack` (`rawStack`, not the merged
 * `ReportStack`): `resolveCmsRecommendation` needs the separate `builder` axis
 * and the unfolded `cms.value`/`cms.confidence` to match builder + label
 * (design_resolution 27-03). A check outside the 10 supported ids resolves to
 * `null` inside the engine and the generic is returned byte-identical (CMSFIX-04).
 *
 * Guard (Pitfall 1): issues with severity `ok` are correct-by-definition — their
 * recommendation ("Sin acción necesaria.") is kept verbatim and NEVER routed
 * through the engine, so we never show a "fix" on a passing check.
 */
function toReportIssue(issue: IssueRow, stack: DetectedStack | null): ReportIssue {
  const recommendation =
    issue.severity === "ok"
      ? issue.recommendation
      : resolveCmsRecommendation(stack, issue.checkId, issue.recommendation);
  return {
    id: issue.id,
    checkId: issue.checkId,
    category: issue.category,
    title: issue.title,
    severity: issue.severity as ReportSeverity,
    measuredValue: issue.measuredValue,
    source: issue.source,
    criterion: issue.criterion,
    recommendation,
    fingerprint: issue.fingerprint,
    diffStatus: (issue.diffStatus as ReportDiffStatus | null) ?? null,
    url: issueUrl({ source: issue.source, scope: issue.scope }),
    pageId: issue.pageId ?? null,
  };
}

/**
 * Map a detection `AxisResult` to a serializable `ReportStackAxis`, keeping ONLY
 * `value` + `confidence`. The `signals`/`evidence` (matched needles, headers)
 * are dropped so no internal detection detail reaches the client (T-26-03-01).
 */
function toReportStackAxis(axis: AxisResult): ReportStackAxis {
  return { value: axis.value, confidence: axis.confidence };
}

/**
 * Transform the persisted `DetectedStack` (Phase 25) into the serializable
 * `ReportStack` the report table renders (STACKUI-02). Pure — no re-detection.
 * The WordPress builder is folded into the CMS axis as a combined label
 * ("WordPress (Elementor)"); the confidence shown is the CMS one (the builder is
 * a refinement, not a separate axis). `analytics` stays an ordered array so the
 * GA4 + GTM + Meta Pixel coexistence survives. Debug `signals` are discarded.
 */
export function toReportStack(rawStack: DetectedStack): ReportStack {
  const cms = toReportStackAxis(rawStack.cms);
  // Fold the builder into the CMS label only for WordPress: "WordPress (Elementor)".
  // Guard on a truthy value (not just `!= null`) so an empty builder value never
  // yields "WordPress ()" (IN-01).
  if (rawStack.cms.value === "WordPress" && rawStack.builder.value) {
    cms.value = `${rawStack.cms.value} (${rawStack.builder.value})`;
  }
  return {
    cms,
    cdn: toReportStackAxis(rawStack.cdn),
    hosting: toReportStackAxis(rawStack.hosting),
    jsFramework: toReportStackAxis(rawStack.jsFramework),
    analytics: rawStack.analytics.map(toReportStackAxis),
  };
}

/**
 * Assemble the shared, serializable `ReportModel` for an audit from persisted
 * data only (Audit.scores/stats, Issue rows) — no checks are recomputed. Returns
 * `null` when the audit does not exist or is not yet `done`; the caller handles
 * notFound()/progress.
 */
export async function buildReportModel(auditId: string): Promise<ReportModel | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { site: true },
  });

  if (!audit || audit.status !== "done") return null;

  const scores = audit.scores as unknown as AuditScores | null;
  const stats = audit.stats as unknown as AuditStats | null;
  const perf = stats?.perf;

  // Read the persisted scalar Json field `Audit.stack` — it already comes from
  // the findUnique above (no parallel query, no re-detection: FPRINT-09). Null
  // for pre-v1.5 audits → model.stack stays undefined and the UI hides the
  // section entirely.
  const rawStack = audit.stack as unknown as DetectedStack | null;
  const stack: ReportStack | undefined = rawStack ? toReportStack(rawStack) : undefined;
  const graph = stats?.graph;
  const hasGraph = !!graph && graph.nodes.length > 0;

  const [priorityCandidatesRaw, issuesForDetail, resolvedRaw, pagesRaw] = await Promise.all([
    // ALL critical+warning issues, no take — single source for both the full
    // candidate set (M) and the screen-capped slice (N).
    prisma.issue.findMany({
      where: { auditId, severity: { in: ["critical", "warning"] } },
      orderBy: [{ severity: "asc" }, { category: "asc" }],
    }),
    // Every persisted issue, for the per-category detail accordion.
    prisma.issue.findMany({
      where: { auditId },
      orderBy: [{ category: "asc" }, { severity: "asc" }, { checkId: "asc" }],
    }),
    scores?.diff.previousAuditId && scores.diff.resolvedFingerprints.length > 0
      ? prisma.issue.findMany({
          where: {
            auditId: scores.diff.previousAuditId,
            fingerprint: { in: scores.diff.resolvedFingerprints },
          },
          select: { checkId: true, title: true, category: true },
        })
      : Promise.resolve([]),
    // SINGLE additional query, only when a graph exists — same round-trip as the
    // issue reads. `title` is a real column (Plan 20-01), so this select typechecks.
    hasGraph
      ? prisma.page.findMany({
          where: { auditId },
          select: { id: true, url: true, finalUrl: true, title: true, statusCode: true, error: true },
        })
      : Promise.resolve([]),
  ]);

  const priorityCandidates = (priorityCandidatesRaw as unknown as IssueRow[]).map((i) =>
    toReportIssue(i, rawStack)
  );
  const priorityIssues = priorityCandidates.slice(0, MAX_PRIORITY_ROWS);
  const totalPriorityCandidates = priorityCandidates.length;

  const issuesByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, [] as ReportIssue[]])
  ) as Record<Category, ReportIssue[]>;
  for (const issue of issuesForDetail as unknown as IssueRow[]) {
    const bucket = issuesByCategory[issue.category as Category];
    if (bucket) bucket.push(toReportIssue(issue, rawStack));
  }

  const issuesByTemplate = Object.fromEntries(
    TEMPLATE_ORDER.map((t) => [t, [] as ReportIssue[]])
  ) as Record<PageTemplate, ReportIssue[]>;
  for (const issue of issuesForDetail as unknown as IssueRow[]) {
    const reportIssue = toReportIssue(issue, rawStack);
    if (reportIssue.url != null) {
      issuesByTemplate[classifyTemplate(reportIssue.url)].push(reportIssue);
    }
  }

  // Social share previews (PREVIEW-01): only the pages that actually carry a
  // critical/warning social issue are loaded and parsed — a page with nothing to
  // fix never reaches the preview panel, and never costs an HTML read.
  const socialProblemPageIds = new Set<string>();
  for (const issue of issuesForDetail as unknown as IssueRow[]) {
    if (issue.category !== "social") continue;
    if (issue.severity !== "critical" && issue.severity !== "warning") continue;
    if (issue.pageId) socialProblemPageIds.add(issue.pageId);
  }

  let socialPreviews: Record<string, SocialPreviewData> | undefined;
  if (socialProblemPageIds.size > 0) {
    // Deliberately NOT inside the Promise.all above: that call order is what the
    // architecture tests mock with `pageFindMany.mockResolvedValueOnce`.
    // `select` is narrowed to the four columns the derivation reads (T-32-03).
    const socialPagesRaw = await prisma.page.findMany({
      where: { id: { in: [...socialProblemPageIds] } },
      select: { id: true, url: true, finalUrl: true, html: true },
    });
    const imgIssuesByPage = new Map<string, IssueRow[]>();
    for (const issue of issuesForDetail as unknown as IssueRow[]) {
      if (issue.checkId !== OG_IMAGE_CHECK_ID || !issue.pageId) continue;
      const bucket = imgIssuesByPage.get(issue.pageId);
      if (bucket) bucket.push(issue);
      else imgIssuesByPage.set(issue.pageId, [issue]);
    }

    const entries: Record<string, SocialPreviewData> = {};
    for (const page of socialPagesRaw as unknown as SocialPageRow[]) {
      const extracted = extractSocialPreview(page.html ?? "", page.finalUrl ?? page.url);
      const imageStatus = resolveImageStatus(
        extracted.ogImage,
        imgIssuesByPage.get(page.id) ?? []
      );
      entries[page.id] = {
        ...extracted,
        pageId: page.id,
        imageStatus,
        // CR-01: IMG-01 only network-checks `og:image`. Only carry its verdict
        // over to `twitterImage` when it's literally the same declared URL —
        // an explicit, distinct `twitter:image` has no network check in this
        // phase, so it fails open to "ok" instead of inheriting a verdict
        // about a different URL (see `twitterImageStatus` doc in model.ts).
        twitterImageStatus: extracted.twitterImage === extracted.ogImage ? imageStatus : "ok",
      };
    }
    socialPreviews = entries;
  }

  const resolvedIssues: ReportResolvedIssue[] = (
    resolvedRaw as unknown as ReportResolvedIssue[]
  ).map((r) => ({ checkId: r.checkId, title: r.title, category: r.category }));

  // Site architecture from the persisted link graph + the single Page-rows load.
  // Undefined for graphless (pre-Phase-16) audits — the UI hides the section.
  let architecture: ReportArchitecture | undefined;
  if (hasGraph && graph) {
    const pages = pagesRaw as unknown as ArchPageRow[];
    const pagesById = new Map(pages.map((p) => [p.id, p]));
    const nodePageIds = new Set(graph.nodes.map((n) => n.pageId));
    const brokenPageIds = new Set(pages.filter(isBrokenPage).map((p) => p.id));

    // Build every valid tree node in stable graph.nodes order, keyed by URL.
    // Broken pages (WR-02) are skipped so 4xx/5xx error pages that carried HTML
    // into the persisted graph aren't drawn as real architecture nodes.
    const archByUrl = new Map<string, ArchTreeNode>();
    for (const node of graph.nodes) {
      if (brokenPageIds.has(node.pageId)) continue;
      if (archByUrl.has(node.url)) continue; // WR-02: dedupe repeated URLs
      const depth = graph.depthByUrl[node.url];
      if (depth === undefined) continue; // WR-03: only place BFS-reachable nodes
      archByUrl.set(node.url, {
        url: node.url,
        title: pagesById.get(node.pageId)?.title ?? null,
        depth,
        template: classifyTemplate(node.url),
        isDeep: depth > 3,
        isOrphan: false,
        children: [],
      });
    }

    // Parent of a node = the VALID linker of strictly lower depth (depth < child)
    // that links to it via graph.edges. This keeps the tree acyclic by
    // construction (T-22-01) and is the safe reading of "lowest-depth node that
    // links to it". Ties at the minimum qualifying depth keep the first linker
    // seen in stable edge order. Self-loops (from===to) are ignored.
    const parentUrlByChild = new Map<string, string>();
    for (const edge of graph.edges) {
      if (edge.from === edge.to) continue;
      const parent = archByUrl.get(edge.from);
      const child = archByUrl.get(edge.to);
      if (!parent || !child) continue;
      if (parent.depth >= child.depth) continue;
      const current = parentUrlByChild.get(child.url);
      // Keep the lower-depth candidate; on a tie, keep the first (don't
      // overwrite) to respect stable order.
      if (current == null || parent.depth < archByUrl.get(current)!.depth) {
        parentUrlByChild.set(child.url, parent.url);
      }
    }

    // Attach children / collect roots. Iterate archByUrl (already deduped by
    // URL, insertion order = stable graph.nodes order) so a repeated URL can't
    // push the same node object twice (WR-02).
    const roots: ArchTreeNode[] = [];
    for (const archNode of archByUrl.values()) {
      const parentUrl = parentUrlByChild.get(archNode.url);
      if (parentUrl != null) {
        archByUrl.get(parentUrl)!.children.push(archNode);
      } else {
        roots.push(archNode);
      }
    }
    const tree = roots;

    // A true orphan (SEO sense) = a crawled page with ZERO internal inbound
    // links from ANY page, not merely one unreachable from home. `linkedUrls`
    // (Phase 22-04) holds every URL that receives an inlink anywhere on the
    // site; a page present there has inlinks and is NOT an orphan even if it's
    // off the home-reachable tree. Falls back to the old "not in graph" notion
    // for pre-22-04 audits that never persisted linkedUrls.
    const linkedSet = new Set(graph.linkedUrls ?? []);
    const orphans: ArchNode[] = [];
    for (const page of pages) {
      if (nodePageIds.has(page.id)) continue;
      // A page that failed to download or returned 4xx/5xx is broken, not an
      // orphan — don't mislabel it as unreachable-but-valid structure.
      if (isBrokenPage(page)) continue;
      // Has an internal inlink from somewhere → not an orphan (Juan's fix).
      const hasInlink =
        linkedSet.has(page.url) || (page.finalUrl != null && linkedSet.has(page.finalUrl));
      if (hasInlink) continue;
      orphans.push({
        url: page.url,
        title: page.title ?? null,
        depth: -1,
        template: classifyTemplate(page.url),
        isDeep: false,
        isOrphan: true,
      });
    }

    architecture = { tree, orphans };
  }

  const diff: ReportDiff = {
    previousAuditId: scores?.diff.previousAuditId ?? null,
    newCount: scores?.diff.newCount ?? 0,
    persistentCount: scores?.diff.persistentCount ?? 0,
    resolvedCount: scores?.diff.resolvedCount ?? 0,
    resolvedIssues,
  };

  return {
    audit: {
      domain: audit.site.domain,
      createdAt: audit.createdAt,
      finishedAt: audit.finishedAt,
      urlLimit: audit.urlLimit,
      status: audit.status,
    },
    hasScores: scores != null,
    overall: scores?.overall ?? null,
    status: scores?.status ?? "critical",
    byCategory: scores?.byCategory ?? {},
    diff,
    priorityCandidates,
    priorityIssues,
    totalPriorityCandidates,
    issuesByCategory,
    issuesByTemplate,
    perf,
    architecture,
    stack,
    socialPreviews,
  };
}
