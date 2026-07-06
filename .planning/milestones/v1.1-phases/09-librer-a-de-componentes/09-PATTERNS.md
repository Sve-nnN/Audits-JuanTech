# Phase 9: Librería de componentes - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 22 new (11 components × [.tsx + .module.css]) + 1 modified (package.json) + 1 new dep
**Analogs found:** 22 / 22 (single strong convention analog: ThemeToggle + shell + report)

> **Read this first (planner):** every new component is a `"use client"` + CSS Module pair that copies the SAME three conventions from Phase 8. There is no per-component analog hunt to do — the repo has exactly one component convention and it is fully captured below. The *visual/markup* source of truth for gauge, cards, table, badges and accordion is the existing `report.module.css` + `audits/[id]/page.tsx` (Phase 6), which these components refactor into reusable primitives. Copy the CSS values from there verbatim; they already match the reference report (86/100) and already use tokens + `color-mix` soft fills.

---

## File Classification

All new files live in `apps/web/app/components/ui/` (folder does not exist yet — create it). Role for every `.tsx` is **component / client**; data flow is **transform** (props → markup, no I/O, no state fetching — Skeleton/ThemeToggle-style client rendering only).

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `ui/ScoreGauge.tsx` + `.module.css` | component/client | transform | `report.module.css` `.scoreCircle*` (visual) + `EntityGraphSvg.tsx` (SVG structure) + `ThemeToggle.tsx` (client/CSS-module shell) | role-match (visual exact) |
| `ui/CategoryCard.tsx` + `.module.css` | component/client | transform | `report.module.css` `.categoryCard*` + `page.tsx` L247-262 | exact (visual) |
| `ui/Badge.tsx` + `.module.css` | component/client | transform | `report.module.css` `.badge` + severity/diff classes L234-271 | exact (visual) |
| `ui/IssuesTable.tsx` + `.module.css` | component/client | transform | `report.module.css` `.table*` L197-232 + `page.tsx` L304-364 | exact (visual) + new sticky/scroll behavior |
| `ui/CategoryAccordion.tsx` + `.module.css` | component/client | transform | `report.module.css` `.categoryGroup*` + `.issue*` L279-351 + `page.tsx` L474-504 | exact (visual) |
| `ui/Button.tsx` + `.module.css` | component/client | transform | `ThemeToggle.module.css` `.toggle` (states) + `shell.module.css` `.navLink` | role-match (states pattern) |
| `ui/Input.tsx` + `.module.css` | component/client | transform | `ThemeToggle.module.css` focus/disabled pattern + tokens | role-match |
| `ui/Field.tsx` + `.module.css` | component/client | transform | no exact analog (new form primitive) — follow shell/tokens conventions | role-match |
| `ui/EmptyState.tsx` (EmptyState+ErrorState) + `.module.css` | component/client | transform | `report.module.css` `.emptyState` L397-405 | role-match (visual seed) |
| `ui/Skeleton.tsx` + `.module.css` | component/client | transform | `ThemeToggle.module.css` reduced-motion guard pattern | role-match |
| `apps/web/package.json` | config | — | current deps block L12-24 | modify |

---

## The Three Convention Rules (apply to EVERY component)

These are the only conventions the repo enforces. Copy them into every new `.tsx`/`.module.css` pair.

### Rule 1 — Client component shell (from `ThemeToggle.tsx` L1-5, 22, 48-55)

```tsx
"use client";

import styles from "./ScoreGauge.module.css";   // relative import, sibling CSS Module

export function ScoreGauge({ value, status, size = "lg", ...props }: ScoreGaugeProps) {
  // named export (NOT default). Matches HomeClient / VerifyClient / AuditProgress / ThemeToggle.
  return <div className={styles.gauge}>…</div>;
}
```

- `"use client"` on line 1, always.
- **Named export**, one component per file (wrappers like `SeverityBadge`/`DiffBadge` and `EmptyState`/`ErrorState` are additional named exports in the same file).
- CSS Module imported as `styles` from the sibling file, relative path.
- JSDoc block above the component describing purpose + a11y (see ThemeToggle L7-21 for the house style — Spanish, documents keyboard/aria/reduced-motion). Keep this habit.
- Boolean prop → CSS class mapping: `className={loading ? styles.loading : undefined}` and compose with template strings `` `${styles.badge} ${styles[variant]}` `` exactly like `page.tsx` does (`` `${styles.badge} ${SEVERITY_BADGE_CLASS[...]}` ``, L340).

### Rule 2 — CSS Module conventions (from `ThemeToggle.module.css` + `shell.module.css` header comment)

- File header comment stating "solo tokens semánticos (sin hex crudo). CSP-safe" (ThemeToggle.module.css L1-4). Keep it.
- **camelCase single-word class names**: `.gauge`, `.card`, `.badge`, `.table`, `.summary`, `.chip`. Variant/state as separate classes (`.good`, `.critical`, `.loading`, `.invalid`) composed in JSX — mirrors `report.module.css` `.good`/`.critical`/`.severityCritical`.
- **Semantic tokens only** (`var(--surface)`, `var(--text)`, `var(--space-4)`, `var(--radius-md)`). NEVER raw hex, NEVER primitive ramps (`--slate-800`). This is the hard rule from tokens.css L10-13 and 09-UI-SPEC.
- Font stacks with fallback exactly as shell does, e.g. `font-family: var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;` (shell.module.css L154-156) and mono `var(--font-geist-mono), ui-monospace, monospace` (report.module.css L102-103). Khand stack: `var(--font-khand), "Arial Narrow", system-ui, sans-serif` (shell L106).

### Rule 3 — Focus, hover, motion (from `ThemeToggle.module.css` L21-54, shell L180-194)

Every interactive component copies this exact block set:

```css
.control:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.control:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: var(--shadow-focus);
}

@media (prefers-reduced-motion: reduce) {
  .control { transition: none; }
  /* also null out any transform/animation */
}
```

- Focus ring is ALWAYS `2px solid var(--ring)` + `outline-offset: 2px` (inset `-2px` where clipped by `overflow:hidden`, e.g. accordion summary — see UI-SPEC COMP-05). Add `box-shadow: var(--shadow-focus)` where a solid outline alone is subtle (ThemeToggle L29).
- Micro-transitions ≤ 0.15–0.2s, ONLY color/border/transform. Every one wrapped in `@media (prefers-reduced-motion: reduce)`. This is non-negotiable and already 100% consistent across ThemeToggle and shell.
- 44×44px min touch target for icon-only controls (ThemeToggle L10-11: `width:44px; height:44px`).

---

## Pattern Assignments (visual source → new component)

For gauge/cards/badges/table/accordion, the fastest correct path is **lift the CSS rules out of `report.module.css` into the new module, tokenize any leftover literals, then wire the props**. Below maps each component to its exact source lines.

### `ui/ScoreGauge.tsx` (COMP-01)

**Visual analog:** `report.module.css` `.scoreCircle` / `.scoreCircleNumber` / `.scoreCircleMax` (L89-112); status color classes `.good`/`.needs_improvement`/`.critical` (L135-160).
**SVG structural analog:** `EntityGraphSvg.tsx` L39+ (inline `<svg>`, deterministic geometry, self-contained, CSP note L34-38).
**Client shell analog:** `ThemeToggle.tsx` (also the inline-`<svg>` + `stroke="currentColor"` pattern, L58-73).

- Current report uses a CSS `border: 8px solid currentColor` ring (L98) — the new gauge upgrades to two concentric `<circle>` + `stroke-dashoffset` (UI-SPEC). Reuse from ThemeToggle SVG: `fill="none" stroke="currentColor" stroke-linecap="round"`, `aria-hidden` on decorative paths (L68-69).
- Number style copies report L101-107 verbatim: `font-family: var(--font-geist-mono), ui-monospace, monospace; font-feature-settings:"tnum" 1; line-height:1`. Size via variant class (`--font-size-5xl` lg / `--font-size-2xl` md).
- Status → `currentColor` via wrapper class exactly like report L135-160 (`.good{color:var(--success)}` etc.). Add `.unknown{color:var(--text-muted)}` for `value===null`.
- **CAUTION — do NOT copy from EntityGraphSvg:** its `TYPE_COLORS` use hardcoded hex (`#2563eb`, L12-24) and it is a server component (no `"use client"`). Use it only for `<svg>` geometry/structure, never its color approach.
- `stroke-dashoffset` exposed as custom prop `--gauge-offset` (motion-ready, Phase 10), NO transition on it now.

### `ui/CategoryCard.tsx` (COMP-02)

**Visual analog:** `report.module.css` `.categoryCard*` (L169-194); markup `page.tsx` L247-262.
- Copy L169-194 verbatim: `background:var(--surface); border:1px solid var(--border); border-radius` → change to token `var(--radius-md)` (report uses literal `12px`, tokenize to `--radius-md`=10px per UI-SPEC), score in mono/tnum.
- Add hover ONLY when `href` present (new vs report): reuse Rule 3 hover block. Wrap whole card in single `<a>` (one tab stop) per UI-SPEC.
- Label color: UI-SPEC upgrades `--text-muted` → `--text-secondary` for AA (report currently uses `--text-muted` at L177 — the new component must use `--text-secondary`; this is the UI-FEEDBACK.md contrast fix).

### `ui/Badge.tsx` (COMP-03)

**Visual analog:** `report.module.css` `.badge` base (L234-241) + all severity/diff variant classes (L243-271).
- Copy the eight variant→token mappings directly from report L243-271 — they already match UI-SPEC's table exactly (critical/warning/ok/new/persistent/resolved).
- **Soft-fill custom props:** report defines `--severity-good-bg` / `--severity-warn-bg` / `--severity-critical-bg` / `--severity-info-bg` via `color-mix(in srgb, var(--token) 12%, transparent)` on `.page` (report L7-14). UI-SPEC renames these to `--sev-good-bg`/`--sev-warn-bg`/`--sev-critical-bg`/`--sev-info-bg`. Define them at component scope (`.badge` or a `:where` root) so the badge is self-contained (report scoped them on `.page` — the new primitive must own them).
- Optional lucide icon at 14px, `aria-hidden`, inherits `currentColor`. Ship `SeverityBadge` + `DiffBadge` typed wrappers as extra named exports mapping variant→Spanish label (labels already exist in `page.tsx` L34-56: `SEVERITY_LABEL`, `DIFF_LABEL`).

### `ui/IssuesTable.tsx` (COMP-04)

**Visual analog:** `report.module.css` `.table*` (L197-232); markup/logic `page.tsx` L304-364, plus helpers `shortUrl` (L127-135) and `issueUrl` (L120-125).
- Copy `.table`, `.table th`, `.table td`, `tr:last-child td`, `.tableNote` from report L197-232.
- **New behavior (not in report):** wrap in `overflow-x:auto` region with `min-width:640px` inner table; sticky first URL column (`position:sticky; left:0; background:var(--surface)` + `box-shadow:1px 0 0 var(--border)` seam); scroll region gets `tabindex="0" role="region" aria-label`. See UI-SPEC COMP-04.
- Reuse the clickable-URL pattern verbatim from `page.tsx` L330-338: `http`-prefixed → `<a target="_blank" rel="noreferrer" title={url}>{shortUrl(url)}</a>`, else plain span. Lift `shortUrl`/`issueUrl` into a shared util or the component.
- `<th>` color: report uses `--text-muted` (L213) → upgrade to `--text-secondary` (UI-SPEC AA fix).
- Empty rows → render `<EmptyState>` (COMP-07) with `CheckCircle2`/`--success`, replacing report's inline `.emptyState` div (page.tsx L301).

### `ui/CategoryAccordion.tsx` (COMP-05)

**Visual analog:** `report.module.css` `.categoryGroup*` + `.issueDetail`/`.issueHeader`/`.issueFields`/`.issueField` (L279-351); markup `page.tsx` L474-504.
- Native `<details>`/`<summary>` — already the report's approach (page.tsx L475-481). Copy `list-style:none` + `::-webkit-details-marker{display:none}` from report L296-301.
- Copy `.issueFields` grid (`repeat(auto-fit, minmax(220px,1fr))`, L327-332) and the `nth-of-type(2) dd` → Geist Mono trick (L348-351) for "Valor medido".
- **New:** lucide `ChevronDown` 20px that rotates 180° on `[open]` (report has no chevron), rotation guarded by reduced-motion. Summary title → Khand h4 role. Summary focus-visible uses inset `outline-offset:-2px` (clipped by `overflow:hidden` on the group, report L285).
- Sub-group titles pair a `<Badge variant="critical|ok">` with count — report already does this inline (page.tsx L483-486, L493-496); refactor to use the new Badge component.

### `ui/Button.tsx` (COMP-06)

**Analog:** state machinery from `ThemeToggle.module.css` (hover/focus/disabled/reduced-motion, L21-54); nav color-transition from `shell.module.css` `.navLink` (L126-138).
- No existing button-with-variants in repo — this is the new canonical primitive. Build the 4 variants (primary/secondary/ghost/destructive) from UI-SPEC's token table; each `:hover` uses Rule 3 block.
- `disabled` copies ThemeToggle's `:disabled` intent (L32-34) but full UI-SPEC: `opacity:.5; cursor:not-allowed; pointer-events:none`.
- `loading` → lucide `Loader2` with spin animation **guarded by reduced-motion** (static when reduced), `aria-busy="true"`, `disabled`.
- Real `<button type>`; icon-only needs `aria-label` + 44×44 (ThemeToggle precedent).

### `ui/Input.tsx` + `ui/Field.tsx` (COMP-06)

**Analog:** focus/disabled token pattern from ThemeToggle; no existing form field in repo → new primitives, follow UI-SPEC token refs.
- Input base `var(--surface-raised)` fill, `var(--border-strong)` border, `--radius-sm`, `min-height:44px`, `font-size:var(--font-size-base)` (16px, iOS no-zoom). States per UI-SPEC; `invalid` → `--critical` border + `aria-invalid`.
- Field wraps `<label htmlFor>` + hint/error linked via `aria-describedby`, error node `role="alert"`, required `*` in `--critical`. Voceo-free placeholder copy from UI-SPEC COMP-06.

### `ui/EmptyState.tsx` (EmptyState + ErrorState) (COMP-07)

**Visual seed:** `report.module.css` `.emptyState` (L397-405): `background:var(--surface); border:1px dashed var(--border); border-radius; text-align:center`.
- Upgrade per UI-SPEC: centered column, icon chip 56×56 (`--radius-full`), Khand h4 title, `--text-secondary` description (not `--text-muted` — AA), optional action Button. Two named exports `EmptyState`/`ErrorState` (variant prop). Error container `role="status"`/`"alert"`. Default icons lucide `Inbox`/`AlertTriangle`.

### `ui/Skeleton.tsx` (COMP-08)

**Analog:** reduced-motion guard idiom from `ThemeToggle.module.css` L45-54.
- Base `background:var(--surface-hover)`, shimmer via `::after` `linear-gradient` + `color-mix(in srgb, var(--text) 6%, transparent)` (same `color-mix` idiom the report uses for soft fills). `@keyframes shimmer` MUST be nulled under `@media (prefers-reduced-motion: reduce)`. Always `aria-hidden="true"`.

### `apps/web/package.json` (modify)

Add `lucide-react` to `dependencies` (block L12-24). See Shared Patterns → New Dependency.

---

## Shared Patterns

### New Dependency: `lucide-react`
**Apply to:** Badge, Button, Field, EmptyState, Accordion, IssuesTable (empty state).
- Add to `apps/web/package.json` dependencies (currently NOT present — confirmed absent from `pnpm-lock.yaml`). Verify npm legitimacy at install per 09-CONTEXT.md before adding.
- **CSP-safe rationale (already established in repo):** `ThemeToggle.tsx` and `EntityGraphSvg.tsx` prove the house pattern is inline `<svg>` with `stroke="currentColor"`, no CDN, no external asset — lucide-react renders exactly this (inline SVG components), so it is a drop-in for the existing hand-rolled icons under strict `style-src/img-src 'self'`.
- **Named imports only:** `import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Inbox } from "lucide-react";` (tree-shakeable). Icons inherit `currentColor`, `aria-hidden` when decorative, size via `size` prop mapped to px (16/18/20/32 per UI-SPEC).

### Soft severity fills (`color-mix`)
**Source:** `report.module.css` L7-14 (`.page` scope).
**Apply to:** Badge, EmptyState (error chip), Skeleton (shimmer tint).
```css
--sev-good-bg: color-mix(in srgb, var(--success) 12%, transparent);
--sev-warn-bg: color-mix(in srgb, var(--warning) 12%, transparent);
--sev-critical-bg: color-mix(in srgb, var(--critical) 12%, transparent);
--sev-info-bg: color-mix(in srgb, var(--accent-text) 12%, transparent);
```
Report scopes these on `.page`; new primitives must define them locally so each component is self-contained (renamed `--severity-*` → `--sev-*` per UI-SPEC).

### Status → color mapping (score-state coherence DS-02)
**Source:** `report.module.css` L135-160 + tokens.css L156-165.
**Apply to:** ScoreGauge, CategoryCard.
`good → var(--success)`, `needs_improvement → var(--warning)`, `critical → var(--critical)`, `null → var(--text-muted)`. Same three tokens back both severity badges and score-state — never substitute the brand accent.

### Spanish labels (already localized in repo)
**Source:** `page.tsx` L14-61.
**Apply to:** Badge wrappers, CategoryCard, Accordion, IssuesTable.
`CATEGORY_LABEL`, `STATUS_LABEL`, `SEVERITY_LABEL`, `DIFF_LABEL`, `STRATEGY_LABEL` maps already exist — reuse them (or lift to a shared module) rather than re-authoring. Neutral Spanish, no voceo, no em/en dashes.

### AA contrast upgrade (UI-FEEDBACK.md)
**Apply to:** every component that currently maps to a `--text-muted` usage in `report.module.css`.
Meaningful secondary text moves `--text-muted` → `--text-secondary`. Reserve `--text-muted` strictly for placeholders / disabled / "sin datos". Report uses `--text-muted` liberally (L59, L111, L177, L213, etc.) — the redesign must NOT carry that over for readable text.

---

## No Analog Found (build from UI-SPEC, follow the 3 conventions)

| File | Role | Reason |
|------|------|--------|
| `ui/Button.tsx` (variant system) | component | No multi-variant button exists; ThemeToggle covers only icon-button states. Build from UI-SPEC token table. |
| `ui/Input.tsx` / `ui/Field.tsx` | component | No form-field primitive in repo. Build from UI-SPEC; borrow focus/disabled idiom from ThemeToggle. |
| `ui/Skeleton.tsx` (shimmer) | component | No loading skeleton exists. Only the reduced-motion guard idiom is reusable. |

All three still obey the three convention rules (client shell, camelCase token-only CSS Module, focus/reduced-motion block).

---

## Metadata

**Analog search scope:** `apps/web/app/components/`, `apps/web/app/audits/[id]/`, `apps/web/app/tokens.css`, `apps/web/package.json`.
**Files scanned:** 8 (ThemeToggle.tsx/.module.css, AppHeader.tsx, shell.module.css, tokens.css, EntityGraphSvg.tsx, report.module.css, audits/[id]/page.tsx) + package.json + lockfile check.
**Key finding:** repo has exactly ONE component convention (client + CSS Module + tokens + reduced-motion), and the report page already contains token-correct CSS for gauge/card/badge/table/accordion — Phase 9 is largely a *refactor-into-primitives* of `report.module.css`, not net-new styling.
**Pattern extraction date:** 2026-07-06
