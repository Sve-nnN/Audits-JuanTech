---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
reviewed: 2026-07-05T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/web/app/fonts.ts
  - apps/web/app/tokens.css
  - apps/web/app/globals.css
  - apps/web/app/layout.tsx
  - apps/web/app/providers.tsx
  - apps/web/app/components/ThemeToggle.tsx
  - apps/web/app/components/ThemeToggle.module.css
  - apps/web/app/components/AppHeader.tsx
  - apps/web/app/components/AppFooter.tsx
  - apps/web/app/components/shell.module.css
  - apps/web/app/home.module.css
  - apps/web/app/audits/[id]/report.module.css
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-05
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Phase 8 brand-fonts + design-system foundation: the central `fonts.ts` loader, the token layer (`tokens.css` + `globals.css`), the `next-themes` wiring (`providers.tsx`, `ThemeToggle`), the app shell (header/footer/shell.module.css), and the two migrated CSS Modules (home, report).

No BLOCKER/Critical issues. Security posture is clean for UI-only work: fonts are self-hosted via `next/font` (no font CDN), CSS Modules compile same-origin, SVG icons are inline JSX (no `dangerouslySetInnerHTML`), no secrets, no injection surface. The hydration/FOUC handling is sound — `suppressHydrationWarning` on `<html>`, dark-first `:root` default so a no-JS render still lands on the intended dark theme, and the `ThemeToggle` mount guard renders an inert placeholder before hydration.

The substantive findings are: (1) the `next-themes` config claims to honor the OS preference on first load but the props chosen make that unreachable; (2) the Array brand display font is declared, its variable is mounted on `<html>`, yet no CSS ever consumes it and its own fallback chain references a font-family name that will not resolve. These undercut the stated goal of the phase (brand fonts actually rendering, theming behaving as documented) without breaking the build.

## Warnings

### WR-01: `enableSystem` is inert — OS color-scheme is never honored on first visit, contradicting the documented intent

**File:** `apps/web/app/providers.tsx:22-32` (see comment at `:15`)
**Issue:** The comment states `enableSystem: respeta prefers-color-scheme como valor inicial`, but with `defaultTheme="dark"` set explicitly, `next-themes` uses `"dark"` as the resolved theme when there is no stored preference — it does **not** fall through to the system value. `enableSystem` only takes effect when the active theme is literally `"system"`, and `ThemeToggle` (`ThemeToggle.tsx:45,52`) only ever calls `setTheme("light" | "dark")`, never `"system"`. Net effect: a first-time visitor on a light-mode OS always gets dark, and the `enableSystem` prop plus its media listener are effectively dead configuration. The provider's own comments are internally contradictory (`arranca en oscuro` vs `respeta prefers-color-scheme como valor inicial`).
**Fix:** Pick one behavior and make the code match the docs. If dark-first-regardless is intended, drop `enableSystem` and the misleading comment. If OS preference should win on first load, remove `defaultTheme="dark"` (so it defaults to `"system"`) or set `defaultTheme="system"`:
```tsx
<ThemeProvider
  attribute="data-theme"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
```

### WR-02: Array display font is wired to `<html>` but no CSS consumes `--font-array`

**File:** `apps/web/app/fonts.ts:19-30`, `apps/web/app/layout.tsx:14-23`
**Issue:** `array.variable` (`--font-array`) is included in `fontVariables` and applied to `<html>`, but a repo-wide grep of `apps/web/app/` shows **zero** `font-family: var(--font-array)` usages (only Khand and Geist are actually referenced, in `shell.module.css` and `globals.css`). The brand display font — the headline face of a "brand fonts" phase — is loaded/declared but never renders anywhere. If Array application is deliberately deferred to Phase 9/10 headings, that is defensible, but as shipped this phase the wiring is inert and the woff2 asset is never matched by the browser.
**Fix:** Either apply the token to the intended surface (e.g. a display/hero heading role in `shell.module.css` or a headings utility), or, if Array is genuinely Phase 9 scope, remove it from the Phase 8 font-variable mount so the phase does not ship a dead variable:
```ts
// consume it, e.g.:
.display { font-family: var(--font-array), var(--font-khand), system-ui, sans-serif; }
```

### WR-03: Array's `fallback: ["Khand", …]` names a font-family that will never resolve

**File:** `apps/web/app/fonts.ts:29`
**Issue:** The fallback chain lists the literal string `"Khand"`. Khand is loaded through `next/font/google`, which emits a **hashed** family name (exposed only via `--font-khand`), not a family literally named `Khand`. No system will have `Khand` installed either. So during Array's `swap` window the browser skips `"Khand"` and falls straight to `system-ui` — the intended "fall back to the brand heading font while Array loads" never happens. Same latent mismatch does not affect `khand`'s own fallback (`"Arial Narrow"` is a real system face), so this is specific to the `array` loader.
**Fix:** Fallbacks in `next/font` are plain CSS family names and cannot reference another `next/font` loader by variable. Use only real installed faces, matching the pattern already used for `khand`:
```ts
fallback: ["Arial Narrow", "system-ui", "sans-serif"],
```

## Info

### IN-01: `home.module.css` uses raw pixel radii/spacing while tokens for them exist

**File:** `apps/web/app/home.module.css:6,11,14,15,21,33,38,52,53` (e.g. `border-radius: 16px`, `padding: 32px 20px`, `gap: 12px`)
**Issue:** The color migration (08-05) moved this file onto semantic color tokens, but geometry is still hardcoded (`16px`, `10px`, `36px`, `12px`, …) even though `--radius-lg: 16px`, `--radius-md: 10px`, and the `--space-*` scale exist and are used consistently in `shell.module.css`/`report.module.css`. This is a token-consistency gap, not a color-token violation (the tokens.css convention note targets raw hex).
**Fix:** Swap literals for the existing tokens, e.g. `border-radius: var(--radius-lg);`, `gap: var(--space-3);`, `padding: var(--space-8) var(--space-5);`.

### IN-02: Redundant duplicate `border-top` on adjacent issue-detail blocks

**File:** `apps/web/app/audits/[id]/report.module.css:309-316`
**Issue:** `.issueDetail` already declares `border-top: 1px solid var(--border);`, and `.issueDetail + .issueDetail` re-declares the identical `border-top`. The sibling rule adds nothing (no override, no different value), so it is dead duplication that can mislead future edits into thinking the two borders differ.
**Fix:** Delete the `.issueDetail + .issueDetail { border-top: … }` block, or, if the intent was to avoid a doubled divider against the summary, change the base rule to target only siblings.

### IN-03: `color-mix()` severity backgrounds have no fallback

**File:** `apps/web/app/audits/[id]/report.module.css:10-13`
**Issue:** The severity badge backgrounds are built entirely with `color-mix(in srgb, …)`. On an engine without `color-mix` support the `--severity-*-bg` custom properties resolve to invalid/empty and the badge backgrounds silently disappear (text stays legible via the separate `color`, so it degrades rather than breaks). Acceptable for modern targets; flagging only so the choice is intentional and documented.
**Fix (optional):** Declare a flat token fallback before the `color-mix` so unsupported engines still get a tint, e.g. `--severity-good-bg: var(--surface-hover); --severity-good-bg: color-mix(in srgb, var(--success) 12%, transparent);`.

---

_Reviewed: 2026-07-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
