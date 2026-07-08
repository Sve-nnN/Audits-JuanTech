import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReportModel } from "@auditor/report-model";

// Mock the shared model builder so the route can be exercised without Postgres.
// The serializers (@auditor/export) run for real — they are pure JS, no browser.
vi.mock("@auditor/report-model", () => ({
  buildReportModel: vi.fn(),
}));

import { buildReportModel } from "@auditor/report-model";
import { GET } from "./route";

const mockedBuild = vi.mocked(buildReportModel);

// PII that would live in the database but must NEVER reach an export response.
// Held in ADJACENT scope only — deliberately absent from the ReportModel.
const FIXTURE_EMAIL = "fixture@example.com";
const FIXTURE_TOKEN = "tok_secret_do_not_leak_1234567890";
const ACCENTS = "áéíóúñ¿¡";

/** Minimal but complete ReportModel fixture (zero PII by construction). */
function fixtureModel(): ReportModel {
  const issue = {
    id: "issue-1",
    checkId: "TECH-01",
    category: "tech",
    title: `Canónico ${ACCENTS}`,
    severity: "critical" as const,
    measuredValue: ACCENTS,
    source: "https://example.com/página",
    criterion: `Criterio ${ACCENTS}`,
    recommendation: `Recomendación ${ACCENTS}`,
    fingerprint: "fp-1",
    diffStatus: "new" as const,
    url: "https://example.com/página",
  };
  const emptyByCat = {
    tech: [issue],
    perf: [],
    onpage: [],
    schema: [],
    aeo: [],
  };
  return {
    audit: {
      domain: "example.com",
      createdAt: new Date("2026-07-01T00:00:00Z"),
      finishedAt: new Date("2026-07-01T00:10:00Z"),
      urlLimit: 500,
      status: "done",
    },
    hasScores: true,
    overall: 72,
    status: "needs_improvement",
    byCategory: {
      tech: { score: 40, status: "critical" },
      perf: { score: 80, status: "needs_improvement" },
      onpage: { score: 90, status: "good" },
      schema: { score: 75, status: "needs_improvement" },
      aeo: { score: 60, status: "needs_improvement" },
    },
    diff: {
      previousAuditId: null,
      newCount: 1,
      persistentCount: 0,
      resolvedCount: 0,
      resolvedIssues: [],
    },
    priorityCandidates: [issue],
    priorityIssues: [issue],
    totalPriorityCandidates: 1,
    issuesByCategory: emptyByCat,
  };
}

/** Build a GET request/ctx pair for the route. */
function invoke(id: string, format: string | null) {
  const qs = format === null ? "" : `?format=${encodeURIComponent(format)}`;
  const request = new Request(`http://localhost/api/audits/${id}/export${qs}`);
  return GET(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  mockedBuild.mockReset();
});

describe("GET /api/audits/[id]/export", () => {
  it("returns a PDF (200, application/pdf, %PDF body) as an attachment", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const res = await invoke("abc123", "pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("auditoria-example.com-abc123.pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    // %PDF signature
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("returns Markdown (200, text/markdown, non-empty body) as an attachment", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const res = await invoke("abc123", "md");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("auditoria-example.com-abc123.md");
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    // Structured Markdown carries the domain header + accents intact.
    expect(text).toContain("example.com");
    expect(text).toContain(ACCENTS);
  });

  it("returns a PPTX (200, presentationml, PK zip body) as an attachment", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const res = await invoke("abc123", "pptx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("auditoria-example.com-abc123.pptx");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    // PK zip signature (PPTX is an OOXML zip container).
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe("PK");
  });

  it("returns 400 for an invalid format", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const res = await invoke("abc123", "docx");
    expect(res.status).toBe(400);
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("returns 400 when format is missing", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const res = await invoke("abc123", null);
    expect(res.status).toBe(400);
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("returns 404 when the audit does not exist", async () => {
    mockedBuild.mockResolvedValue(null);
    const res = await invoke("missing", "md");
    expect(res.status).toBe(404);
  });

  it("never leaks PII (email/token) into the Markdown body", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const res = await invoke("abc123", "md");
    const text = await res.text();
    expect(text).not.toContain(FIXTURE_EMAIL);
    expect(text).not.toContain(FIXTURE_TOKEN);
  });
});
