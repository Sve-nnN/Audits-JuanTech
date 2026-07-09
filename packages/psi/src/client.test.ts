import { afterEach, describe, expect, it, vi } from "vitest";
import { runPsi } from "./client";
import { extractDiagnostics } from "./parser";
import mobileFixture from "./__fixtures__/psi-response-mobile.json";
import diagnosticsFixture from "./__fixtures__/psi-response-diagnostics.json";

function mockFetchOnce(response: { ok: boolean; status: number; json: () => Promise<unknown> }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response)
  );
}

describe("runPsi diagnostics wiring (PERF-05..09)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches diagnostics extracted from the same PSI response when present", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => diagnosticsFixture });

    const result = await runPsi("https://juan-tech.com/", "mobile");

    expect(result.ok).toBe(true);
    expect(result.metrics?.diagnostics).toEqual(extractDiagnostics(diagnosticsFixture));
  });

  it("returns an empty diagnostics object (not undefined) when the response has no diagnostic audits", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => mobileFixture });

    const result = await runPsi("https://juan-tech.com/", "mobile");

    expect(result.ok).toBe(true);
    expect(result.metrics?.diagnostics).toEqual({});
  });

  it("does not touch the existing error path (no metrics field, ok: false)", async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => ({}) });

    const result = await runPsi("https://juan-tech.com/", "mobile");

    expect(result.ok).toBe(false);
    expect(result.metrics).toBeUndefined();
    expect(result.error).toBeTruthy();
  }, 15_000);
});
