# Phase 8: Fundamentos de marca — fuentes y design system - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 8 (font config, tokens.css, ThemeProvider, ThemeToggle + CSS module, globals.css migration, layout.tsx, home/report module migration)
**Analogs found:** 5 / 8 (3 new file types have no direct analog — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/app/fonts.ts` (font config) | config | transform | `apps/web/app/layout.tsx` (import site) | role-match |
| `apps/web/app/tokens.css` (design tokens) | config | n/a | `apps/web/app/audits/[id]/report.module.css` (scoped CSS vars) | partial (proto-tokens) |
| `apps/web/app/providers.tsx` (ThemeProvider wrapper) | provider | request-response | `apps/web/app/HomeClient.tsx` (client wrapper) | role-match |
| `apps/web/app/components/ThemeToggle.tsx` | component | event-driven | `apps/web/app/HomeClient.tsx` / `app/audits/[id]/AuditProgress.tsx` | role-match |
| `apps/web/app/components/ThemeToggle.module.css` | component (styles) | n/a | `apps/web/app/home.module.css` | exact |
| `apps/web/app/globals.css` (migrate to tokens) | config | n/a | `apps/web/app/globals.css` (self) | exact (in-place) |
| `apps/web/app/layout.tsx` (fonts + provider + data-theme) | config | n/a | `apps/web/app/layout.tsx` (self) | exact (in-place) |
| `apps/web/app/home.module.css` + `report.module.css` (migrate hardcoded colors → tokens) | component (styles) | n/a | `apps/web/app/home.module.css` (self) | exact (in-place) |

## Pattern Assignments

### `apps/web/app/fonts.ts` (config, font loader)

**No direct analog in repo** (no fonts exist yet). Follow Next `next/font` conventions + the repo's CSP-safe intent already documented in `globals.css` line 1 (`no CDN fonts/resets — CSP-safe`) and `report.module.css` lines 1-5 (`CSP: no external stylesheets/fonts`). `next/font` self-hosts at build time, so it satisfies that existing CSP constraint — call this out so the planner keeps the CSP promise intact.

**Placement/convention to follow:** colocate a single `app/fonts.ts` module that exports the four font instances; keep font files under `apps/web/app/fonts/` (per CONTEXT.md decision). Array = `next/font/local` (woff2), Khand = `next/font/google`, Geist Sans/Mono via the `geist` npm package. Each font sets a CSS variable (`--font-array`, `--font-khand`, `--font-geist-sans`, `--font-geist-mono`) and `display: "swap"`.

**Import style to mirror** (from `layout.tsx`): imports are relative within `app/` (`import "./globals.css"`). The `@/*` alias exists (`tsconfig.json` lines 20-24) but existing app code uses relative imports — stay relative for intra-`app` modules.

**Dependency note for planner:** `geist` and `next-themes` are NOT in `apps/web/package.json` (deps lines 12-22 have only workspace pkgs + next/react). Both must be added.

---

### `apps/web/app/tokens.css` (config, design tokens)

**Analog:** `apps/web/app/audits/[id]/report.module.css` (lines 7-45) — the repo already has a proto-token pattern: CSS custom properties declared on a selector, with a `@media (prefers-color-scheme: dark)` override block.

**Existing proto-token pattern** (`report.module.css` lines 7-45):
```css
.page {
  --color-good: #16a34a;
  --color-critical: #dc2626;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-surface: #ffffff;
  --color-bg: #f8fafc;
  /* ... */
}

@media (prefers-color-scheme: dark) {
  .page {
    --color-border: #1e293b;
    --color-text: #f1f5f9;
    --color-surface: #0f172a;
  }
}
```

**Convention to follow / what changes:** hoist these from a `.page` scope up to `:root` (primitive + dark-default semantic tokens per UI-SPEC "Token Architecture"), and replace the `@media (prefers-color-scheme: dark)` override with a `[data-theme="light"]` block (UI-SPEC locks `attribute="data-theme"`). Dark is the default on `:root`; light overrides. `tokens.css` is imported at the TOP of `globals.css` (UI-SPEC line 36). Token names come verbatim from UI-SPEC (`--bg`, `--surface`, `--text`, `--accent`, `--space-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--font-size-*`, etc.).

---

### `apps/web/app/providers.tsx` (provider — ThemeProvider wrapper)

**Analog:** `apps/web/app/HomeClient.tsx` (lines 1-14) — the repo's convention for a client component consumed by a server file.

**Client-wrapper pattern** (`HomeClient.tsx` lines 1-14):
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";

export function HomeClient({ initialEmail }: HomeClientProps) {
```

**Convention to follow:** `"use client"` on line 1, named export (repo uses named exports for client components — `HomeClient`, `VerifyClient`), colocated under `app/`. The provider wraps `next-themes` `ThemeProvider` with `attribute="data-theme"`, `defaultTheme="dark"`, `enableSystem`. Server `layout.tsx` imports and wraps `{children}` with it (mirrors how `page.tsx` line 9 renders `<HomeClient .../>`).

**Server→client handoff pattern** (`page.tsx` lines 1-10): a server component imports the client component and renders it — layout will do the same with the provider.

---

### `apps/web/app/components/ThemeToggle.tsx` (component, event-driven)

**Analogs:** `apps/web/app/HomeClient.tsx` (hooks + handlers) and `apps/web/app/audits/[id]/AuditProgress.tsx` (lines 1-4, `useEffect`/`useState` client component). No existing `app/components/` UI primitive exists except `EntityGraphSvg.tsx` — but that's an SVG renderer, not an interactive control.

**Client component + styles import pattern** (`AuditProgress.tsx` lines 1-4):
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./report.module.css";
```

**Event-handler convention** (`HomeClient.tsx` lines 23-27):
```tsx
async function handleEmailSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (submitting) return;
  setError(null);
```

**Convention to follow:** `"use client"`, named export, `import styles from "./ThemeToggle.module.css"`. Use `next-themes` `useTheme()` for `resolvedTheme` + `setTheme`. Guard against hydration mismatch with a `mounted` flag (`useEffect` set-true pattern seen in `AuditProgress.tsx`). Icon-only button, `aria-label` per state (UI-SPEC copy contract lines 280-281: `Cambiar a modo claro` / `Cambiar a modo oscuro`), ≥44×44px target, `--radius-full`. Place under `app/components/` alongside `EntityGraphSvg.tsx` (existing components dir).

---

### `apps/web/app/components/ThemeToggle.module.css` (component styles)

**Analog:** `apps/web/app/home.module.css` (whole file) — exact role match, the canonical CSS Module convention.

**CSS Module conventions to copy** (`home.module.css`):
- Class names are lowercase `camelCase` single words: `.page`, `.card`, `.title`, `.linkButton` (lines 1, 9, 26, 115). No BEM, no kebab-case.
- Colocated with its component, imported as `import styles from "./x.module.css"` then `styles.className`.
- Interactive states use `:focus` / `:disabled` pseudo-classes (lines 53-56, 69-72).

**Focus pattern to modernize** (`home.module.css` lines 53-56):
```css
.input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
```

**Convention to follow / what changes:** same class-naming and file-colocation rules, BUT every color/space/radius value must reference a semantic token (`var(--accent)`, `var(--surface)`, `var(--ring)`, `var(--radius-full)`, `var(--space-*)`) instead of hardcoded hex like `#2563eb` (UI-SPEC "Token Architecture" line 39: component CSS Modules reference semantic tokens only). Focus outline should use `var(--ring)` + `--shadow-focus`.

---

### `apps/web/app/globals.css` (in-place migration to tokens)

**Analog:** self (current file, 32 lines).

**Current hardcoded pattern to replace** (`globals.css` lines 12-28):
```css
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

@media (prefers-color-scheme: dark) {
  body {
    background: #020617;
    color: #f1f5f9;
  }
}
```

**Convention to follow / what changes:**
1. Add `@import "./tokens.css";` as the first line (UI-SPEC line 36).
2. Replace hardcoded `background`/`color` with `var(--bg)` / `var(--text)`.
3. Remove the `@media (prefers-color-scheme: dark)` block — theme switching now lives in `tokens.css` under `[data-theme="light"]` (dark is `:root` default).
4. Keep the existing minimal reset (lines 2-10, `* { box-sizing }`, `html, body { margin/padding: 0 }`) and `a { color: inherit }` (lines 30-32) — those stay.
5. Wire body font-family to `var(--font-geist-sans)` stack (body role per UI-SPEC typography table).
6. Preserve the CSP-safe intent comment on line 1 (no CDN fonts) — `next/font` keeps this true.

---

### `apps/web/app/layout.tsx` (in-place: fonts + provider + data-theme)

**Analog:** self (current file, 15 lines).

**Current minimal shell** (`layout.tsx` lines 9-15):
```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

**Convention to follow / what changes:**
1. Import the four fonts from `./fonts` and apply their `.variable` classNames to `<html>` (or `<body>`) so `--font-*` vars are in scope.
2. Add `suppressHydrationWarning` to `<html>` (UI-SPEC theming row + "No FOUC" line 266) — required by `next-themes`.
3. Keep `lang="es"` (existing, correct for Spanish-neutral rule).
4. Wrap `{children}` in the `providers.tsx` ThemeProvider (server imports client provider, same handoff as `page.tsx` → `HomeClient`).
5. Keep `import "./globals.css"` (line 2) and the existing `metadata` export (lines 4-7).

---

### `apps/web/app/home.module.css` + `apps/web/app/audits/[id]/report.module.css` (migrate hardcoded colors → tokens)

**Analog:** self.

**Current hardcoded values to replace** (`home.module.css` — examples):
- `background: #ffffff` (line 11) → `var(--surface)`
- `border: 1px solid #e2e8f0` (line 11) → `var(--border)`
- `color: #64748b` (line 34) → `var(--text-muted)` / `--text-secondary`
- `outline: 2px solid #2563eb` (line 54) → `var(--ring)`
- `.error { color: #dc2626 }` (line 81) → `var(--critical)`
- `.success { color: #16a34a }` (line 92) → `var(--success)`
- all `@media (prefers-color-scheme: dark)` blocks (lines 19-24, 74-78, 108-113, 146-151) → DELETE; theming now global via `[data-theme]`.

**For `report.module.css`:** its `.page`-scoped `--color-*` vars (lines 7-45) collapse into the global semantic tokens — replace local `--color-good/warn/critical/border/text/surface/bg` with the global `--success/--warning/--critical/--border/--text/--surface/--bg`, and delete the dark `@media` override block (lines 32-45+).

**Note for planner:** these two migrations are lower-risk-if-scoped-carefully but touch working v1.0 screens. Juan's profile flags regressions as a hard frustration trigger — the plan should treat the color→token swap as a mechanical 1:1 mapping (hex values in UI-SPEC ramps match the existing hardcoded hex almost exactly, e.g. `#f8fafc`, `#0f172a`, `#1e293b`, `#e2e8f0` all already map to named slate tokens), and verify rendered output.

---

## Shared Patterns

### CSS Modules naming + colocation
**Source:** `apps/web/app/home.module.css`, `apps/web/app/audits/[id]/report.module.css`
**Apply to:** every new `.module.css`
- Lowercase `camelCase` single-word class names (`.page`, `.linkButton`).
- Colocate the module next to its component; import as `import styles from "./x.module.css"`, reference `styles.className`.
- After this phase: no raw hex — only `var(--semantic-token)`.

### Client component convention
**Source:** `apps/web/app/HomeClient.tsx`, `apps/web/app/verify/VerifyClient.tsx`, `apps/web/app/audits/[id]/AuditProgress.tsx`
**Apply to:** `providers.tsx`, `ThemeToggle.tsx`
```tsx
"use client";
import { useState } from "react";
import styles from "./x.module.css";

export function ComponentName(props: Props) { /* ... */ }
```
- `"use client"` line 1, named export (not default), relative imports.

### Server → client handoff
**Source:** `apps/web/app/page.tsx` (lines 1-10)
**Apply to:** `layout.tsx` wrapping the ThemeProvider
- Server file imports the client component/provider and renders it around `{children}`.

### CSP-safe styling/fonts
**Source:** `apps/web/app/globals.css` line 1, `report.module.css` lines 1-5
**Apply to:** font setup + all CSS
- No CDN fonts or external stylesheets. `next/font` (self-hosted at build) and CSS Modules (same-origin at build) both preserve this. Do not introduce `<link>` to Google Fonts CDN.

### Spanish neutral, no voceo
**Source:** CLAUDE.md hard rule + UI-SPEC copy contract (lines 273-288)
**Apply to:** every user-facing string (theme toggle `aria-label`, footer, etc.)

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `apps/web/app/fonts.ts` | font config | No `next/font` usage exists yet; follow Next conventions + repo CSP intent. Requires adding `geist` dep. |
| `apps/web/app/providers.tsx` (next-themes) | provider | No React context provider exists in the repo. Requires adding `next-themes` dep. Follow client-component convention for shape. |
| `apps/web/app/tokens.css` | design tokens | Only a partial proto-analog exists (`report.module.css` scoped vars); no `:root` global token file or `[data-theme]` strategy yet. |

Planner: for these three, lean on RESEARCH/UI-SPEC + the conventions above rather than a copy-source.

## Metadata

**Analog search scope:** `apps/web/app/**` (pages, client components, CSS modules, layout, config)
**Files scanned:** layout.tsx, globals.css, home.module.css, report.module.css, HomeClient.tsx, page.tsx, AuditProgress.tsx, tsconfig.json, next.config.ts, package.json
**Pattern extraction date:** 2026-07-05
