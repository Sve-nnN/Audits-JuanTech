---
phase: 14-bot-n-exportar-ui
reviewed: 2026-07-08T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - apps/web/app/components/ui/ExportMenu.tsx
  - apps/web/app/components/ui/ExportMenu.module.css
  - apps/web/app/audits/[id]/page.tsx
  - apps/web/app/audits/[id]/report.module.css
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: findings
---

# Phase 14: Code Review Report — ExportMenu

**Reviewed:** 2026-07-08
**Depth:** deep
**Files Reviewed:** 4 (+ tests read for cross-reference)
**Status:** issues_found

## Summary

Reviewed the `ExportMenu` client component and its mount point in the audit report header. The implementation is solid on the a11y skeleton (correct ARIA roles, roving tabindex, keyboard map, `preventDefault` on Enter/Space to avoid native double-fire) and confirms via `Button.tsx` that the `loading` prop sets a real `disabled` attribute and that ARIA/`onKeyDown`/`id` props are spread through. No BLOCKER-class defects (no injection, no secret, no crash-on-load). However there are four robustness/correctness WARNINGs the green test suite does not exercise: focus is dropped to `<body>` after an export completes (never returned to the trigger), the object URL is revoked synchronously immediately after `anchor.click()` (can cancel the download in some browsers), `decodeURIComponent` on the Content-Disposition filename can throw on a stray `%` and abort an otherwise-successful download, and the double-submit guard is state-based rather than ref-based. The jsdom tests pass because none of these paths are observable in jsdom.

## Warnings

### WR-01: Focus is lost to `<body>` after an export completes

**File:** `apps/web/app/components/ui/ExportMenu.tsx:120-152` (with `154`, `173`)
**Issue:** When a menu item is activated, `runExport` calls `setOpen(false)` immediately (line 124), unmounting the menu and the focused `menuitem`. Focus falls to `document.body`. The trigger is `disabled` during `loading` so it cannot hold focus, and when `loading` clears there is no code path that returns focus to the trigger. Result: after every successful download (and after the error branch), the keyboard user is dumped at the top of the document with no focus anchor. The phase constraint requires focus return on close; this path silently violates it. The Esc path (`closeMenu(true)`) is the only one that restores focus.
**Fix:** Return focus to the trigger once the operation settles. In the `finally` block, after `setLoading(false)`, restore focus (the trigger is re-enabled by then). Because `disabled` is removed on the same render, defer the focus to the next tick:
```ts
} finally {
  if (objectUrl) {
    // see WR-02: defer the revoke
    setTimeout(() => URL.revokeObjectURL(objectUrl!), 250);
  }
  setLoading(false);
  // return focus to the trigger (menu already closed)
  requestAnimationFrame(() => focusTrigger());
}
```

### WR-02: Object URL revoked synchronously right after `anchor.click()` can cancel the download

**File:** `apps/web/app/components/ui/ExportMenu.tsx:141-147`
**Issue:** `anchor.click()` dispatches the download synchronously, but the browser reads the blob from the object URL asynchronously. Calling `URL.revokeObjectURL(objectUrl)` in the `finally` immediately after `click()` can invalidate the URL before the browser has started fetching the blob, cancelling the download in some browsers (notably Firefox and some Chromium builds under load). jsdom never fetches the blob, so the test suite cannot catch this. Revoke-on-error and revoke-on-unmount are fine; only the success path is at risk.
**Fix:** Defer the revoke so the browser has time to start the transfer:
```ts
anchor.click();
anchor.remove();
// hand back to browser before releasing the URL
setTimeout(() => URL.revokeObjectURL(objectUrl!), 250);
```
Move the revoke out of the `finally` for the success path (keep an immediate revoke only for the error/early-exit path, or guard so it isn't double-revoked).

### WR-03: `decodeURIComponent` on the filename can throw and abort a successful download

**File:** `apps/web/app/components/ui/ExportMenu.tsx:45-50` (thrown into the try at `133`)
**Issue:** `filenameFromDisposition` calls `decodeURIComponent(raw)` unconditionally. For a legitimate non-encoded header such as `Content-Disposition: attachment; filename="reporte 50% off.pdf"`, `decodeURIComponent("reporte 50% off.pdf")` throws `URIError: URI malformed` (stray `%` not forming a valid escape). That throw happens inside `runExport`'s `try` (line 133), so it is caught by the generic `catch`, which shows `ERROR_MSG` and drops the download even though the blob was received successfully. The server controls this header, but any filename with a raw `%`, or a partially-encoded value, breaks the happy path.
**Fix:** Only decode RFC 5987 (`filename*=`) values, and wrap the decode defensively:
```ts
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // fall back to the literal filename
  }
}
```

### WR-04: Double-submit guard relies on React state, not a synchronous ref

**File:** `apps/web/app/components/ui/ExportMenu.tsx:120-122` (also `96`, `156`, `174`)
**Issue:** `runExport` guards with `if (loading) return;`, reading the `loading` state captured in the closure. State updates are asynchronous, so two synchronous invocations in the same tick both observe `loading === false` and both fire `fetch`. In practice this is largely mitigated (Enter/Space call `preventDefault` to suppress the native click, the trigger goes `disabled` on re-render, and discrete user events land in separate tasks after React has flushed), which is why the "second trigger while loading" test passes. But the guard itself is not airtight — it depends on those mitigations rather than being correct by construction. Any future refactor that removes a `preventDefault` or introduces a programmatic double-call reopens the race.
**Fix:** Back the guard with a ref so it is synchronous and closure-stable:
```ts
const inFlight = useRef(false);
// ...inside runExport, before setLoading(true):
if (inFlight.current) return;
inFlight.current = true;
// ...in finally:
inFlight.current = false;
```

## Info

### IN-01: `aria-controls` references a menu id that does not exist while closed

**File:** `apps/web/app/components/ui/ExportMenu.tsx:228` (menu rendered only at `235`)
**Issue:** The trigger always sets `aria-controls={menuId}`, but the `role="menu"` element is only in the DOM when `open` is true. While closed, `aria-controls` points at a non-existent id, which some assistive tech flags. Minor.
**Fix:** Conditionally set it: `aria-controls={open ? menuId : undefined}`.

### IN-02: No unmount guard / AbortController for an in-flight fetch

**File:** `apps/web/app/components/ui/ExportMenu.tsx:127-149`
**Issue:** If the user navigates away mid-fetch, the promise still resolves and runs `setLoading(false)` / `setErrorMsg` on an unmounted component. React 18 no longer warns on this, so it is harmless today, but the fetch is not aborted and the work is wasted.
**Fix:** Optionally attach an `AbortController` in a cleanup effect and pass `signal` to `fetch`; treat `AbortError` as a silent no-op in `catch`.

### IN-03: Mouse-open moves focus into the menu

**File:** `apps/web/app/components/ui/ExportMenu.tsx:104-106`, `173-177`
**Issue:** The focus effect fires on every open, including opening via mouse click on the trigger, so a pointer user has focus yanked onto item 0. This is an acceptable menu-pattern choice and matches many implementations, but note it is a deliberate behavior, not a bug. No change required.
**Fix:** None required; documented for awareness.

---

_Reviewed: 2026-07-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
