import { describe, it, expect } from "vitest";
import { jsonLdStateForPage } from "./jsonld";

describe("jsonLdStateForPage", () => {
  it("returns 'error' when any schema issue is critical", () => {
    expect(jsonLdStateForPage(["critical"], true)).toBe("error");
    // Precedence: critical wins even with a graph present and no other problems.
    expect(jsonLdStateForPage(["critical"], false)).toBe("error");
  });

  it("returns 'warning' when there is a warning and no critical", () => {
    expect(jsonLdStateForPage(["warning"], true)).toBe("warning");
    expect(jsonLdStateForPage(["ok", "warning"], false)).toBe("warning");
  });

  it("returns 'ok' when no critical/warning and a schema graph is present", () => {
    expect(jsonLdStateForPage([], true)).toBe("ok");
    expect(jsonLdStateForPage(["ok"], true)).toBe("ok");
  });

  it("returns 'absent' when no critical/warning and no schema graph", () => {
    expect(jsonLdStateForPage([], false)).toBe("absent");
    expect(jsonLdStateForPage(["ok"], false)).toBe("absent");
  });

  it("resolves the worst state for a mixed critical + warning page (→ error)", () => {
    expect(jsonLdStateForPage(["warning", "critical"], true)).toBe("error");
    expect(jsonLdStateForPage(["critical", "warning"], false)).toBe("error");
  });
});
