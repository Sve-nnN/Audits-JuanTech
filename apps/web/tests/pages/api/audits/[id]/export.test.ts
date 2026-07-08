import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import type { ReportModel } from "@auditor/report-model";

// Mock the shared model builder so the handler can be exercised without
// Postgres. The serializers (@auditor/export) run for real — they are pure
// JS, no browser — this is exactly the assertion this migration must prove:
// @react-pdf/renderer renders correctly under the Pages Router (no
// react-server export condition).
vi.mock("@auditor/report-model", () => ({
  buildReportModel: vi.fn(),
}));

import { buildReportModel } from "@auditor/report-model";
import handler from "../../../../../pages/api/audits/[id]/export";

const mockedBuild = vi.mocked(buildReportModel);

// PII that would live in the database but must NEVER reach an export response.
const PII_CANARY_EMAIL = "pii-leak-canary@example.com";
const PII_CANARY_TOKEN = "SECRET_TOKEN_CANARY";
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

/**
 * `fixtureModel()` with adjacent PII columns (email / emailId / token /
 * verificationToken) attached to `audit` and every issue — the shape a DB row
 * would have if the whitelist slipped. The response must strip all of them.
 */
function leakyModel(): ReportModel {
  const model = fixtureModel();
  const inject = (target: object): void => {
    const rec = target as Record<string, unknown>;
    rec.email = PII_CANARY_EMAIL;
    rec.emailId = "email-1";
    rec.token = PII_CANARY_TOKEN;
    rec.verificationToken = PII_CANARY_TOKEN;
  };
  inject(model.audit);
  for (const issue of model.priorityCandidates) inject(issue);
  for (const list of Object.values(model.issuesByCategory)) {
    for (const issue of list) inject(issue);
  }
  return model;
}

/** Minimal mock of NextApiResponse that records status/headers/body. */
function mockRes() {
  const state: {
    statusCode: number | null;
    headers: Record<string, string>;
    jsonBody: unknown;
    sentBody: unknown;
    ended: boolean;
  } = {
    statusCode: null,
    headers: {},
    jsonBody: undefined,
    sentBody: undefined,
    ended: false,
  };

  const res = {
    status: vi.fn((code: number) => {
      state.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      state.jsonBody = body;
      state.ended = true;
      return res;
    }),
    send: vi.fn((body: unknown) => {
      state.sentBody = body;
      state.ended = true;
      return res;
    }),
    setHeader: vi.fn((key: string, value: string) => {
      state.headers[key.toLowerCase()] = value;
      return res;
    }),
    end: vi.fn(() => {
      state.ended = true;
      return res;
    }),
  } as unknown as NextApiResponse;

  return { res, state };
}

/** Build a NextApiRequest-shaped query object for the handler. */
function mockReq(id: string, format: string | null): NextApiRequest {
  const query: Record<string, string> = { id };
  if (format !== null) query.format = format;
  return { query } as unknown as NextApiRequest;
}

beforeEach(() => {
  mockedBuild.mockReset();
});

describe("GET /api/audits/[id]/export (Pages Router)", () => {
  it("returns a PDF (200, application/pdf, %PDF body) as an attachment", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const { res, state } = mockRes();
    await handler(mockReq("abc123", "pdf"), res);

    expect(state.statusCode).toBe(200);
    expect(state.headers["content-type"]).toBe("application/pdf");
    expect(state.headers["content-disposition"]).toContain("attachment");
    expect(state.headers["content-disposition"]).toContain(
      "auditoria-example.com-abc123.pdf"
    );
    const buf = state.sentBody as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("returns Markdown (200, text/markdown, non-empty body) as an attachment", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const { res, state } = mockRes();
    await handler(mockReq("abc123", "md"), res);

    expect(state.statusCode).toBe(200);
    expect(state.headers["content-type"]).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(state.headers["content-disposition"]).toContain("attachment");
    expect(state.headers["content-disposition"]).toContain(
      "auditoria-example.com-abc123.md"
    );
    const text = state.sentBody as string;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("example.com");
    expect(text).toContain(ACCENTS);
  });

  it("returns a PPTX (200, presentationml, PK zip body) as an attachment", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const { res, state } = mockRes();
    await handler(mockReq("abc123", "pptx"), res);

    expect(state.statusCode).toBe(200);
    expect(state.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    expect(state.headers["content-disposition"]).toContain("attachment");
    expect(state.headers["content-disposition"]).toContain(
      "auditoria-example.com-abc123.pptx"
    );
    const buf = state.sentBody as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString("ascii")).toBe("PK");
  });

  it("returns 400 for an invalid format without calling buildReportModel", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const { res, state } = mockRes();
    await handler(mockReq("abc123", "docx"), res);

    expect(state.statusCode).toBe(400);
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("returns 400 when format is missing, without calling buildReportModel", async () => {
    mockedBuild.mockResolvedValue(fixtureModel());
    const { res, state } = mockRes();
    await handler(mockReq("abc123", null), res);

    expect(state.statusCode).toBe(400);
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it("returns 404 when the audit does not exist", async () => {
    mockedBuild.mockResolvedValue(null);
    const { res, state } = mockRes();
    await handler(mockReq("missing", "md"), res);

    expect(state.statusCode).toBe(404);
  });

  it("strips adjacent PII (email/token) from the Markdown response body", async () => {
    mockedBuild.mockResolvedValue(leakyModel());
    const { res, state } = mockRes();
    await handler(mockReq("abc123", "md"), res);

    const text = state.sentBody as string;
    expect(text).not.toContain(PII_CANARY_EMAIL);
    expect(text).not.toContain(PII_CANARY_TOKEN);
  });
});
