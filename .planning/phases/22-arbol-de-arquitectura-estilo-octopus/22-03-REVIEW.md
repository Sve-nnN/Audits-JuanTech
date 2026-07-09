---
phase: 22-arbol-de-arquitectura-estilo-octopus
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/web/app/components/ArchitectureMap.tsx
  - apps/web/app/components/ArchitectureMap.module.css
  - apps/web/app/audits/[id]/arquitectura/page.tsx
  - apps/web/app/audits/[id]/arquitectura/arquitectura.module.css
  - apps/web/app/audits/[id]/page.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-07-09
**Depth:** standard
**Files Reviewed:** 5 (+ `ArchitectureTreeSvg.tsx` traced as render dependency)
**Status:** issues_found

## Summary

Reviewed the new client-side interactive architecture map viewport (`ArchitectureMap`), its CSS module, the dedicated `/arquitectura` route, and the report page that links into it. The implementation is clean and defensible against the specific risks flagged in the review brief:

- **Event listener lifecycle: correct.** The non-passive `wheel` listener is added with `{ passive: false }` and removed in the same `useEffect` cleanup (lines 132-133). Its dependency (`zoomAt`) is a `useCallback` with `[]` deps, so the effect registers exactly once with no re-registration churn. Pan drag does **not** use `window` listeners at all: it uses Pointer Events with `setPointerCapture`, so a drag ending off-canvas still routes `pointerup`/`pointercancel` back to the element (both wired to `endDrag`). No listener leak on unmount or re-render.
- **Zoom math: correct.** Scale is clamped to `[0.2, 3]` via `clampScale` on every path (wheel, buttons, keyboard, fit). Zoom-toward-cursor is the standard `x2 = px - (px - x) * (k2/k)` with `transformOrigin: 0 0`, which keeps the cursor point stable (verified against the `screen = x + k*s` model). No division by zero: `prev.k` is always ≥ 0.2, and `computeFit` guards `cw === 0 || ch === 0` before dividing. At the clamp bounds `zoomAt` short-circuits (`k2 === prev.k`), so there is no positional drift when scrolling past a limit. Note `computeFit` correctly reads `scrollWidth/Height`, which is unaffected by CSS transforms, so measurement is robust regardless of current scale.
- **Reset exists.** "Reajustar vista" button (`applyFit`) and keyboard `0` both restore the fit view, so the tree can always be recovered.
- **Tokens-only / CSP-safe.** Both CSS modules use only `var(--…)` tokens, no raw hex. No `dangerouslySetInnerHTML`; SVG text nodes render `node.title ?? node.url` as React children (auto-escaped).
- **Route safety.** `notFound()` fires when the model is missing; a graphless-but-valid model renders the `EmptyState`. The viewport is a `"use client"` component and touches `window`/DOM only inside effects and event handlers, never during render — SSR-safe.

Two warnings and three info items remain, detailed below. No blockers.

## Warnings

### WR-01: Wheel handler zooms out on `deltaY === 0` (horizontal-only wheel events)

**File:** `apps/web/app/components/ArchitectureMap.tsx:129`
**Issue:** The zoom direction is chosen with `const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;`. Any event where `deltaY` is not strictly negative maps to zoom-out — including `deltaY === 0`, which occurs on pure horizontal trackpad/shift-wheel scroll and some mice. The result is an unintended zoom-out on gestures the user meant as horizontal panning (which the viewport also swallows via `preventDefault`). Directionality should ignore zero-delta events.
**Fix:**
```ts
if (e.deltaY === 0) return; // ignore horizontal-only wheel; nothing to zoom
const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
```

### WR-02: `/arquitectura` returns 404 for in-progress audits instead of a progress/empty state

**File:** `apps/web/app/audits/[id]/arquitectura/page.tsx:21-22`
**Issue:** `buildReportModel` returns `null` both when the audit does not exist **and** when `audit.status !== "done"` (confirmed in `packages/report-model/src/build.ts:132`). The route treats any `null` model as `notFound()`. So deep-linking to `/audits/{id}/arquitectura` for a valid, still-running audit yields a hard 404, diverging from the report page (`page.tsx:84-103`), which renders `<AuditProgress>` for non-`done` audits. A user who bookmarks or shares the map URL before the crawl finishes hits a dead 404 rather than a "still processing" state.
**Fix:** Distinguish "audit missing" from "audit not done" before deciding. For example, look up the audit status first (mirroring the report page) and render a progress/`EmptyState` for non-`done` audits, reserving `notFound()` for a genuinely absent audit:
```ts
const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { status: true } });
if (!audit) notFound();
if (audit.status !== "done") {
  return <EmptyState title="Auditoría en proceso" description="El mapa estará disponible cuando termine el análisis." />;
}
const model = await buildReportModel(auditId);
if (!model) notFound();
```

## Info

### IN-01: Pan is unbounded — the tree can be dragged fully off-screen

**File:** `apps/web/app/components/ArchitectureMap.tsx:152-158, 188-202`
**Issue:** Neither pointer pan (`onPointerMove`) nor keyboard arrow pan clamps `view.x`/`view.y` to any bound, so the user can push the tree entirely outside the viewport. This is mitigated — `applyFit` (button) and key `0` recenter — but recovery depends on the user recognizing the `Maximize2` icon or knowing the `0` shortcut. Consider a soft bound (keep at least some fraction of the stage visible) or a visible "Reajustar" text affordance to improve discoverability.
**Fix:** Optional — clamp the translation in the `setView` updaters so at least `~48px` of the stage stays within the viewport, using measured `stage.scrollWidth * view.k` against `viewport.clientWidth`.

### IN-02: Keyboard reset (`0`) uses cached `fitRef`, button uses fresh `applyFit()`

**File:** `apps/web/app/components/ArchitectureMap.tsx:186` vs `243`
**Issue:** Key `0` does `setView(fitRef.current)` (the value last written by the `ResizeObserver`), whereas the "Reajustar" button calls `applyFit()`, which recomputes fresh. After a content or layout change that the `ResizeObserver` did not catch, the two reset paths can land on slightly different views. Minor inconsistency, not a correctness bug.
**Fix:** Point the keyboard case at the same path: `case "0": e.preventDefault(); applyFit(); break;`

### IN-03: No pinch-zoom on touch devices

**File:** `apps/web/app/components/ArchitectureMap.module.css:17` + `ArchitectureMap.tsx`
**Issue:** `touch-action: none` disables the browser's native pinch/scroll so the pointer gestures work, but the component only implements single-pointer drag and `wheel` zoom — there is no multi-touch pinch handler. On touch devices users can pan and use the +/- buttons but cannot pinch-zoom, which is the expected gesture on a map. Acceptable for a lead-magnet MVP; flagging for parity.
**Fix:** Optional — track two active pointers and derive a scale factor from the changing distance, feeding it into `zoomAt` at the midpoint.

---

_Reviewed: 2026-07-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
