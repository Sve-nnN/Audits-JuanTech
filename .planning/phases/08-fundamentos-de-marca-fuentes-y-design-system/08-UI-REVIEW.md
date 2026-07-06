# Phase 8 — UI Review

**Audited:** 2026-07-05
**Baseline:** 08-UI-SPEC.md (design contract) — foundation scope (tokens, fonts, theming, base shell)
**Screenshots:** not captured (no dev server on :3000 / :5173 / :8080 — code-only audit)
**Stance:** Advisory, non-blocking. Judged against UI-SPEC values, not Phase 9/10 component polish.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Shell copy matches contract verbatim, español neutro sin voceo, no generic labels; foundation empty/error defaults not yet shipped (flagged for Phase 10 in contract). |
| 2. Visuals | 4/4 | Clear focal (accent wordmark glyph), icon-only toggle has aria-label + title, coherent role hierarchy. |
| 3. Color | 3/4 | Token fidelity is hex-perfect and shell is accent-disciplined, but inline hardcoded hex in legacy `.tsx` screens violates DS-01 and breaks dark theme. |
| 4. Typography | 4/4 | Four families wired correctly, roles applied, full size/weight/line-height scale present and exact; minor fallback-stack deviation. |
| 5. Spacing | 4/4 | 4px scale complete, shell fully tokenized, responsive gutter (16→24→32) exact; legacy screens still off-grid (deferred). |
| 6. Experience Design | 3/4 | FOUC-safe theming, hydration guard, focus-visible + reduced-motion + 44px target all correct; no app-level error boundary or empty-state primitive shipped. |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Hardcoded hex in inline `.tsx` styles breaks dark theme (DS-01 violation)** — `audits/[id]/pages/[pageId]/page.tsx`, `pages/page.tsx`, `AuditProgress.tsx` hardcode light-theme slate/severity hex (`#f8fafc` bg, `#475569` text, `#e2e8f0` borders, `#dc2626`) directly in `style={{}}`. These do not respond to `data-theme` — a light `#f8fafc` panel and `#475569` text render on the `#0a0b0f` dark canvas, failing contrast. **Fix:** replace inline hex with the equivalent semantic tokens (`var(--surface)`, `var(--text-secondary)`, `var(--border)`, `var(--critical)`), moving styles into a CSS Module so they can read `var(--*)`.

2. **No app-level resilience boundary shipped** — the copy contract defines a foundation-level error boundary and empty-state default, but no `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, nor any component carrying `Todavía no hay nada por acá` / `Algo salió mal al cargar` exists. A thrown render error currently has no branded fallback. **Fix:** add `app/error.tsx` + `app/not-found.tsx` using the contract copy (apply the no-voceo final forms noted in the contract).

3. **Legacy screen `.module.css` uses off-scale type and spacing** — `home.module.css` and `report.module.css` use raw px outside the token scale (`24px`, `15px`, `13px`, `11px`, `26px`, `40px` font sizes; `36px`, `18px`, `10px 12px` padding — several not multiples of 4). Colors were migrated to tokens (clean), but size/space were not. **Fix:** migrate to `--font-size-*` and `--space-*` (this is the Phase 9/10 adoption pass; noted here as the outstanding half of the token migration).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- **PASS** Shell chrome copy matches the contract character-for-character:
  - Wordmark `Auditor` + accent trailing dot (`AppHeader.tsx:24-27`, `wordmarkAccent` → `var(--accent)`).
  - Nav `Auditar` · `Historial` (`AppHeader.tsx:31-36`).
  - Theme toggle aria-labels `Cambiar a modo claro` / `Cambiar a modo oscuro` per active state (`ThemeToggle.tsx:46`) — exact match to contract.
  - Footer copyright `© 2026 juan-tech.com. Todos los derechos reservados.` (`AppFooter.tsx:34`) — exact.
- **PASS** No generic labels (`Submit`/`OK`/`Cancel`/`Click Here`) in any foundation component. Español neutro, no voceo.
- **WARNING** Foundation-default empty-state (`Todavía no hay nada por acá`) and app-level error copy (`Algo salió mal al cargar…`) are defined in the contract but not present anywhere in code (grep: NOT FOUND). The contract explicitly marks these NOTE/Phase-10 for final wording, so this is a deferral rather than a defect — score held at 4, but the boundary itself should ship (see Pillar 6).

### Pillar 2: Visuals (4/4)
- **PASS** Clear focal point: accent-colored wordmark glyph is the only accent element in the header, drawing the eye (`shell.module.css:115-117`).
- **PASS** Icon-only theme toggle is paired with both `aria-label` and `title` per state (`ThemeToggle.tsx:53-54`); SVG marked `aria-hidden` + `focusable="false"`.
- **PASS** Hierarchy through family/weight/color: Khand wordmark/nav vs Geist Sans footer vs muted secondary text. Foundation-appropriate; component focal points are Phase 9.

### Pillar 3: Color (3/4)
- **PASS** `tokens.css` is hex-perfect against the spec: every primitive ramp (slate 50-950, ink 900-600, lime 300-700, red/amber/green) and every semantic token (dark `:root` + `[data-theme="light"]` override) matches the contract value-for-value, including shadows per theme and the DS-02 score-state↔severity reuse note.
- **PASS** Accent discipline in the shell: accent appears only on the wordmark glyph, focus rings, and (in `home.module.css`) the CTA fill — consistent with the reserved-for list. No accent overuse. `report.module.css` correctly derives faint severity backgrounds via `color-mix()` off tokens (no hardcoded tints).
- **PASS** Module CSS is clean — zero hardcoded hex across all `*.module.css` (grep confirmed).
- **BLOCKER-adjacent WARNING** Inline `.tsx` styles hardcode hex that breaks theming and violates DS-01 "no hardcoded colors anywhere after this phase": `audits/[id]/pages/[pageId]/page.tsx:20-22,52,58,64,71,74,80,85`, `pages/page.tsx:36,50`, `AuditProgress.tsx:83`. Several are light-theme values (`#f8fafc`, `#475569`, `#e2e8f0`) that render on the dark canvas. `EntityGraphSvg.tsx:13-27,56-113` uses a categorical entity palette — data-viz, more defensible, but still bypasses tokens.
- **WARNING** Accent reserved-use #3 (active/current nav indicator) is not implemented — `navLink` has no active/`aria-current` state (`shell.module.css:126-139`). Acceptable at foundation, worth wiring in Phase 9.

### Pillar 4: Typography (4/4)
- **PASS** All four families wired via `fonts.ts`: Array (`next/font/local`, single 400 woff2), Khand (`next/font/google`, 400/500/600/700), Geist Sans/Mono (via `geist` pkg). `font-display: swap` on all; self-hosted, CSP-safe (no CDN `<link>`). Variables joined onto `<html>` (`layout.tsx:14-23`).
- **PASS** Full size scale (`--font-size-xs`→`6xl`), line-height tokens, and weight tokens present and exact (`tokens.css:77-100`).
- **PASS** Roles applied correctly in shell: wordmark + nav → Khand (`shell.module.css:106,127`), footer/copyright → Geist Sans (`:154,172`), metrics → Geist Mono with `font-feature-settings: "tnum" 1` (`report.module.css:102-106,183`).
- **WARNING** Array fallback stack is `["Arial Narrow","system-ui","sans-serif"]` (`fonts.ts:32`), not the spec's `Khand`-first fallback — but there is a documented technical reason (next/font emits a hashed family name, not `"Khand"`). Acceptable.
- **WARNING** Wordmark uses `--weight-semibold` (600) while nav h4 role is 500 (`shell.module.css:109`); legacy screens use off-scale px sizes (26px/15px/40px). Deferred adoption; foundation wiring itself is complete.

### Pillar 5: Spacing (4/4)
- **PASS** 4px base scale complete and exact, all multiples of 4 (`tokens.css:63-75`).
- **PASS** Shell fully tokenized: container gutter `16→24→32` via `--space-4/6/8` at the exact `640px`/`1024px` breakpoints (`shell.module.css:21-38`); header gap `--space-6`, footer `padding-block: --space-12` (48px), grid `gap: --space-6`. Matches the layout-primitive contract.
- **PASS** Toggle honors the 44×44 WCAG 2.5.5 exception (`ThemeToggle.module.css:11-12`).
- **WARNING** Legacy `home.module.css` / `report.module.css` carry off-grid padding (`36px`, `18px`, `10px 12px`, `8px 10px`). Colors migrated, spacing not — the deferred half of the migration. Does not affect foundation score.

### Pillar 6: Experience Design (3/4)
- **PASS** Theming contract fully honored: `next-themes` with `attribute="data-theme"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`, `suppressHydrationWarning` on `<html>` (`providers.tsx:25-31`, `layout.tsx:23`). FOUC prevented (pre-paint script + dark-first `:root` fallback).
- **PASS** Toggle hydration guard renders an inert same-size placeholder before mount to avoid mismatch/FOUC of the control itself (`ThemeToggle.tsx:32-42`).
- **PASS** Accessibility of the shell: native `<button>`, keyboard operable, `focus-visible` ring + `--shadow-focus` glow on toggle and all shell links (`ThemeToggle.module.css:26-30`, `shell.module.css:181-186`), `prefers-reduced-motion` respected in both stylesheets.
- **WARNING** No app-level error boundary (`app/error.tsx` / `global-error.tsx`) and no `not-found.tsx` exist — a thrown render error has no branded fallback. The contract's foundation-default error/empty copy is unshipped. This is the main foundation resilience gap.
- **WARNING** No empty-state primitive exists at the shell level; `report.module.css` has a local `.emptyState` but there is no reusable foundation default carrying the contract copy.

---

## Registry Safety
Not applicable — `components.json` absent (NO_SHADCN), no third-party component registries declared in UI-SPEC. Registry audit: 0 third-party blocks, no flags.

---

## Files Audited
- `apps/web/app/fonts.ts`
- `apps/web/app/tokens.css`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/providers.tsx`
- `apps/web/app/components/ThemeToggle.tsx` + `ThemeToggle.module.css`
- `apps/web/app/components/AppHeader.tsx`
- `apps/web/app/components/AppFooter.tsx`
- `apps/web/app/components/shell.module.css`
- `apps/web/app/home.module.css`
- `apps/web/app/audits/[id]/report.module.css`
- Cross-checked (hardcoded-color grep): `audits/[id]/pages/**`, `AuditProgress.tsx`, `EntityGraphSvg.tsx`
