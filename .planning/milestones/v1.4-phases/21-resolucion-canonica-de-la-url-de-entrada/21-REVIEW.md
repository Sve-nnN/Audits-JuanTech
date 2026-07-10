---
phase: 21-resolucion-canonica-de-la-url-de-entrada
reviewed: 2026-07-09T19:59:14Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/crawler/src/resolveCanonicalUrl.ts
  - packages/crawler/src/resolveCanonicalUrl.test.ts
  - packages/crawler/src/index.ts
  - apps/worker/src/index.ts
  - packages/db/prisma/schema.prisma
  - packages/graph/src/buildLinkGraph.ts
  - packages/graph/src/buildLinkGraph.test.ts
  - apps/web/app/audits/[id]/page.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-09T19:59:14Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the canonical-URL resolution feature (URLRES-02): `resolveCanonicalUrl` (https→http fallback, redirect-follow, bounded abort), its wiring in the worker (resolved URL as `startUrl`/`origin`, fail-hard gate, dual persistence), the removal of the `resolveHomeKey` heuristic from `buildLinkGraph`, and the report's conditional display of the resolved URL.

No BLOCKER-tier defects. The timeout/abort cleanup is correct (`clearTimeout` in both branches, one `AbortController` per candidate), `null`-on-total-failure is honored, and the fail-hard gate + `worker.on("failed")` path persists `failed` correctly without clobbering a terminal state. The dual persistence of `resolvedUrl` (early at line 295, final at line 602) is consistent.

The most important finding (WR-01) is an architectural gap the phase set out to fix but does not fully close: `origin` is derived by stripping the path off `startUrl`, so for sites whose root redirects to a **subpath** (e.g. `/` → `/en/`), the resolved home is lost again and the link graph / architecture visualization silently degrades to empty — the exact "empty graph" symptom this phase targeted. I verified downstream blast radius: `orphanPagesCheck` (TECH-09) computes its own inlink set and `depthCheck` (TECH-14) returns `[]` on an empty `depthByUrl`, so this does **not** emit false issues — it only silently drops the architecture/click-depth feature. That keeps it a WARNING, not a BLOCKER.

The remaining items are robustness/consistency concerns (missing User-Agent, unconsumed response body) and minor edge cases.

## Warnings

### WR-01: `origin` strips the redirect path, re-introducing the empty-graph case for root→subpath redirects

**File:** `apps/worker/src/index.ts:348` (and `packages/graph/src/buildLinkGraph.ts:69-75`)
**Issue:** `resolveCanonicalUrl` correctly returns the full final URL including path (its JSDoc emphasizes the raw `res.url`, e.g. `https://example.com/en/`), and that value seeds the crawl as `startUrl`. But the graph root is derived as `new URL(startUrl).origin` — which **discards the path** — and `buildLinkGraph` now does a strict exact match of `normalizeUrl(origin)` against crawled page keys (the `resolveHomeKey` fallback was removed). For any site whose root redirects to a subpath (language prefixes like `/en/`, `/es/`, or a `/home` landing), the real entry page is crawled at `startUrl` but `normalizeUrl(origin)` = `https://example.com/` is never among the crawled keys, so `buildLinkGraph` hits its degrade branch and returns `{ nodes: [], edges: [], depthByUrl: {} }`. This is the very "seed from the wrong origin → empty graph" failure the phase docstring cites as motivation. `buildLinkGraph.test.ts` only covers root→root (`Test 9` uses `www.example.com/` with pages at `/`), so this path is untested. Same defect also weakens `orphanPagesCheck` line 52 (`homepage = normalizeUrl(origin)` won't match the real `/en/` home). Blast radius is limited to a degraded (empty) architecture section + no click-depth signal — no false issues — hence WARNING, but the feature is silently broken for multilingual/landing-redirect sites.
**Fix:** Pass the full resolved home URL (with path) to `buildLinkGraph` instead of the bare origin, and use it as the BFS root. Keep `origin` only for same-registrable-domain filtering.
```ts
// worker
const homeUrl = startUrl;                 // full resolved URL, includes path
const origin = new URL(startUrl).origin;  // still used for domain filtering
graph = buildLinkGraph(pages, origin, homeUrl);
```
```ts
// buildLinkGraph: root lookup uses the resolved home URL, not origin
export function buildLinkGraph(pages, origin, homeUrl = origin) {
  ...
  const normalizedHome = normalizeUrl(homeUrl);
  const home = normalizedHome && byUrl.has(normalizedHome) ? normalizedHome : null;
```
Add a regression test where `/` redirects to `/en/` and pages exist only under `/en/`.

### WR-02: `resolveCanonicalUrl` sends no `User-Agent`, inconsistent with the crawler and can fail the whole audit at the gate

**File:** `packages/crawler/src/resolveCanonicalUrl.ts:54-58`
**Issue:** The resolution `fetch` sends no headers, so it uses Node/undici's default UA. Every other network hop in this pipeline (`fetchRobotsTxtBody`, the Crawlee crawler) sends `DEFAULT_USER_AGENT`. Bot-mitigation layers (Cloudflare, etc.) commonly block requests with a missing/`node`-style UA. Because this is a **fail-hard gate** (line 287-291 throws → whole audit fails with "No pudimos conectar…"), a site that is perfectly reachable by the actual crawler can be rejected here purely because the probe used a different (blocked) UA. This makes the gate stricter than the crawl it guards.
**Fix:** Send the same UA the crawler uses.
```ts
import { DEFAULT_USER_AGENT } from "./robots";
const res = await fetch(url, {
  method: "GET",
  signal: controller.signal,
  redirect: "follow",
  headers: { "user-agent": DEFAULT_USER_AGENT },
});
```

### WR-03: Resolution response body is never consumed or cancelled — socket/memory retention in a long-lived worker

**File:** `packages/crawler/src/resolveCanonicalUrl.ts:54-61`
**Issue:** `fetch` resolves as soon as response headers arrive; `return res.url` then abandons the (potentially large) home-page body without reading or cancelling it. In undici, an unconsumed body keeps the underlying socket checked out and can grow memory. The worker is a long-lived process running this on every audit (plus the http fallback path), so this accumulates. `fetchRobotsTxtBody` avoids the issue by calling `res.text()`; this helper does not.
**Fix:** Cancel the body before returning.
```ts
const res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow" });
clearTimeout(timeout);
res.body?.cancel().catch(() => {}); // release the socket; we only need res.url
return res.url;
```

### WR-04: A redirect to a different registrable domain silently switches the audited site

**File:** `apps/worker/src/index.ts:286-300, 348`
**Issue:** `resolveCanonicalUrl` accepts *any* non-network-error final URL, including a cross-domain redirect (parked domains, `example.com` → `example.org`, or a redirect to an unrelated SaaS host). The worker then derives `origin` from that foreign host and crawls it end-to-end, persisting results and showing "Analizamos: <other-domain>" in the report. The user requested an audit of their domain; they get an audit of wherever it redirected, with no warning. There is no same-registrable-domain assertion between `audit.site.domain` and `resolvedUrl`.
**Fix:** After resolving, compare registrable domains and either reject or surface it explicitly.
```ts
if (!sameRegistrableDomain(resolvedUrl, `https://${audit.site.domain}`)) {
  throw new Error(
    `${audit.site.domain} redirige a otro dominio (${new URL(resolvedUrl).hostname}). ` +
    `Ingresa la URL final directamente si quieres auditarla.`
  );
}
```
(If cross-domain audits are intentionally allowed, at minimum record the discrepancy in `stats` so the report can flag it.)

## Info

### IN-01: `toBareHost` does not strip userinfo or port, producing malformed probe URLs

**File:** `packages/crawler/src/resolveCanonicalUrl.ts:25-34`
**Issue:** The regexes strip the scheme, path/query/fragment and a leading `www.`, but leave `user:pass@` userinfo and `:port` intact. Input like `user:pass@example.com` or `example.com:8080/path` yields a `host` of `user:pass@example.com`, and `${scheme}://${host}` embeds credentials into the probe URL. Unlikely in this lead-magnet flow (input is already reduced to a bare hostname by `normalizeDomain` in the web route before a `Site` is created), so this is defensive-only.
**Fix:** Parse via `new URL()` after prepending a scheme and read `.hostname` (drops userinfo automatically), or explicitly strip `^[^@]*@` and decide a port policy.

### IN-02: Fake `Response` in tests omits `body`, so WR-03's cleanup can't be regression-tested as written

**File:** `packages/crawler/src/resolveCanonicalUrl.test.ts:4-7`
**Issue:** `fakeResponse` returns only `{ url, status, ok }`. If WR-03's `res.body?.cancel()` is added, the tests still pass (optional chaining short-circuits on the missing `body`) but they never exercise the cancel path, so a future regression (e.g. forgetting the `.catch`) would go undetected. Not a defect in current code — a test-coverage gap tied to the recommended fix.
**Fix:** When implementing WR-03, add a `body: { cancel: vi.fn().mockResolvedValue(undefined) }` to `fakeResponse` and assert `cancel` was called.

### IN-03: `resolvedDiffersFromDomain` treats a bare-`http` root as "different" and shows it, which is the intended-but-slightly-noisy behavior

**File:** `apps/web/app/audits/[id]/page.tsx:54-68`
**Issue:** The predicate flags `http://example.com/` (same host, root, no query) as differing because `httpsProtocol` is false, so the report shows "Analizamos: http://example.com/". That matches the documented intent (surface a protocol downgrade), so it is correct — noting only that for an http-only site the banner appears on every audit. Also `domain` is already a bare hostname (guaranteed by `normalizeDomain` in the create route), so the `stripWww(domain)` path-in-domain edge case cannot occur here; no action needed.
**Fix:** None required. If the http banner proves noisy, gate it on host/subdomain change only and drop the protocol condition.

---

## Verified correct (adversarial checks that passed)

- **Timeout/abort cleanup** — `clearTimeout(timeout)` runs in both the success and catch branches; a fresh `AbortController`/timer is created per scheme, so there is no abort-after-clear or reuse-of-aborted-controller bug (`resolveCanonicalUrl.ts:49-66`).
- **null contract** — total failure (both schemes reject, incl. `AbortError`) returns `null` without throwing; the worker gate converts `null` into a hard audit failure with a user-facing message (`index.ts:287-291`). Covered by tests.
- **Failed-path persistence** — `worker.on("failed")` guards against clobbering an already-terminal `done`/`failed` state and wraps its own persistence in try/catch (`index.ts:649-679`).
- **`resolveHomeKey` removal** — `buildLinkGraph` no longer references the removed heuristic; the CR-01 dual-key adjacency (pre/post-redirect) is preserved and still tested (`buildLinkGraph.test.ts` Test 8). Empty-graph degrade path is safe: TECH-14 returns `[]` on empty `depthByUrl` and TECH-09 does not consume the graph, so no false issues are produced (see WR-01 caveat for the root→subpath case).

---

_Reviewed: 2026-07-09T19:59:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
