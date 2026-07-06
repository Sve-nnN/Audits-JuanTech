---
phase: 08-fundamentos-de-marca-fuentes-y-design-system
verified: 2026-07-06T00:00:00Z
status: passed
score: 5/5 must-haves verified
human_validation: passed 2026-07-06 by Juan (dev server). Shell/foundation OK, dark-first no-FOUC OK, toggle OK. Screen-level spacing/layout + component complaints (Home, Reporte) routed to Phases 9/10 (those screens are rebuilt there). Voceo in current copy routed to COPY-01 (Phase 10).
overrides_applied: 0
human_verification:
  - test: "Recargar la app varias veces (dark por defecto) y observar el primer paint"
    expected: "Nunca aparece un flash de tema claro antes de resolver a oscuro (no-FOUC dark-first)"
    why_human: "El FOUC ocurre en el primer paint del navegador; grep confirma suppressHydrationWarning + script de next-themes, pero solo el ojo humano confirma que no hay flash real"
  - test: "Alternar el tema con el toggle, cerrar la pestaña y volver a abrir la app"
    expected: "La preferencia elegida persiste entre sesiones vía localStorage"
    why_human: "La persistencia real de localStorage y su re-lectura al montar es comportamiento de runtime del navegador, no verificable estáticamente"
  - test: "Navegar con teclado (Tab) hasta el toggle, wordmark y nav; forzar prefers-reduced-motion"
    expected: "El focus-visible muestra el ring de marca (--ring) y no hay animación cuando el usuario pide movimiento reducido"
    why_human: "Apariencia visual del focus ring y respuesta a la media query de movimiento requieren inspección visual"
  - test: "Comparar home, verify, report e history contra v1.0 en ambos temas (claro y oscuro)"
    expected: "Sin regresión visible: colores, espaciado y layout equivalentes tras migrar a tokens"
    why_human: "La ausencia de regresión visual es un juicio comparativo pixel-a-pixel que grep no puede hacer"
  - test: "Verificar que la paleta de marca (lime + ink dark) se siente alineada a juan-tech.com"
    expected: "El acento lima y el canvas casi-negro comunican el posicionamiento code-forward"
    why_human: "Alineación de marca es subjetiva; los hex son una aproximación aprobada por Juan (CONTEXT.md), ajustable si pasa hex exactos"
---

# Phase 8: Fundamentos de marca — fuentes y design system Verification Report

**Phase Goal:** El auditor tiene tipografía de marca, tokens de diseño y theming claro/oscuro consistentes, sirviendo de base para toda la librería de componentes y las pantallas.
**Verified:** 2026-07-05
**Status:** human_needed
**Re-verification:** No — initial verification

> Nota de modo: la fase declara `mode: mvp` en ROADMAP, pero el goal no está en formato User Story ("As a..., I want..., so that..."). Por instrucción explícita del orquestador se verifica con la metodología goal-backward estándar contra los 5 Success Criteria del roadmap.

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Display=Array, títulos/UI=Khand, body=Geist Sans, código/métricas=Geist Mono, con fallbacks y `font-display: swap` en toda la app | ✓ VERIFIED | `fonts.ts` define las 4 familias con `variable` + `display:"swap"` + `fallback`; `layout.tsx` aplica las 4 `.variable` al `<html>`; `globals.css` body=`--font-geist-sans`; `shell.module.css` wordmark/nav=`--font-khand`; `report.module.css` métricas=`--font-geist-mono` (4 clases). Aplicación plena de Array como display en pantallas es Phase 10 (documentado en REQUIREMENTS FONT-04). |
| 2 | Tokens (color, tipografía, espaciado, radios, sombras, z-index) centralizados como CSS vars, usados en vez de hardcoded | ✓ VERIFIED | `tokens.css` (200 líneas) con primitivos + semánticos dark (`:root`) + light (`[data-theme="light"]`); `globals.css` importa tokens; `home.module.css` y `report.module.css` tienen 0 hex hardcodeado (64 usos `var(--` en report). Hex inline/SVG en SCREEN-03/05 diferido a Phase 10 (documentado DS-01). |
| 3 | Paleta de marca + escala de severidad (crítico/advertencia/ok) y estados (good/needs_improvement/critical) coherentes | ✓ VERIFIED | `tokens.css` define `--critical`/`--warning`/`--success` como eje único que respalda severidad e estados de score en ambos temas (comentario DS-02 explícito líneas 156-165). Alineación de marca con juan-tech.com → validación humana (aproximación aprobada). |
| 4 | Toggle claro/oscuro, persiste en localStorage entre sesiones, sin flash | ✓ VERIFIED | `providers.tsx` monta `ThemeProvider` (`attribute="data-theme"`, `defaultTheme="dark"`, `enableSystem`); `ThemeToggle.tsx` usa `useTheme().setTheme` con guard de hidratación; `layout.tsx` tiene `suppressHydrationWarning`. Persistencia y no-FOUC en runtime → validación humana. |
| 5 | Todas las pantallas comparten layout base (contenedor, grid, header/footer) | ✓ VERIFIED | `shell.module.css` provee `.container`/`.grid`/`.header`/`.footer`; `AppHeader`+`AppFooter` montados en `layout.tsx` envolviendo `{children}` dentro de `<Providers>`. Ruta `/history` referenciada por el nav existe. |

**Score:** 5/5 truths verified (validación estructural/código; ver ítems de validación humana)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/web/app/fonts.ts` | 4 fuentes con variable + swap | ✓ VERIFIED | Exporta `array` (localFont woff2), `khand` (google 400-700), `geistSans`, `geistMono`; fallbacks presentes |
| `apps/web/app/fonts/Array-Regular.woff2` | woff2 self-hosted real | ✓ VERIFIED | Archivo WOFF2 válido, 20832 bytes (no stub) |
| `apps/web/app/tokens.css` | primitivos + semánticos dark/light | ✓ VERIFIED | 200 líneas, fiel al UI-SPEC; override `[data-theme="light"]` |
| `apps/web/app/providers.tsx` | ThemeProvider next-themes | ✓ VERIFIED | attribute/defaultTheme/enableSystem correctos |
| `apps/web/app/components/ThemeToggle.tsx` | botón icon-only con guard | ✓ VERIFIED | `useTheme`, mounted guard, aria-label ES neutro, 44px |
| `apps/web/app/components/ThemeToggle.module.css` | estilos con tokens | ✓ VERIFIED | 44×44 (WCAG), focus-visible, prefers-reduced-motion |
| `apps/web/app/globals.css` | import tokens + body geist-sans | ✓ VERIFIED | `@import "./tokens.css"`, body `var(--bg)/var(--text)`, sin `@media prefers-color-scheme` |
| `apps/web/app/layout.tsx` | fuentes + suppressHydration + Providers + shell | ✓ VERIFIED | 4 `.variable`, `suppressHydrationWarning`, AppHeader/AppFooter montados |
| `apps/web/app/components/AppHeader.tsx` | header sticky con nav + toggle | ✓ VERIFIED | wordmark, nav Auditar/Historial, ThemeToggle |
| `apps/web/app/components/AppFooter.tsx` | footer con wordmark + copyright | ✓ VERIFIED | copyright ES neutro |
| `apps/web/app/components/shell.module.css` | container/grid/header/footer con tokens | ✓ VERIFIED | solo `var(--*)`, gutter responsive 16→24→32px |
| `apps/web/app/home.module.css` | migrado a tokens | ✓ VERIFIED | 0 hex, sin prefers-color-scheme |
| `apps/web/app/audits/[id]/report.module.css` | tokens + Geist Mono en métricas | ✓ VERIFIED | 0 hex, 4 usos geist-mono en scores/valores medidos |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `layout.tsx` | `providers.tsx` | `<Providers>` envuelve children | ✓ WIRED |
| `layout.tsx` | `fonts.ts` | `.variable` de las 4 fuentes en `<html>` | ✓ WIRED |
| `layout.tsx` | `AppHeader`/`AppFooter` | render alrededor de `<main>` | ✓ WIRED |
| `globals.css` | `tokens.css` | `@import "./tokens.css"` | ✓ WIRED |
| `tokens.css` `:root` | `[data-theme="light"]` | override semántico | ✓ WIRED |
| `ThemeToggle.tsx` | next-themes | `useTheme`/`setTheme`/`resolvedTheme` | ✓ WIRED |
| `AppHeader.tsx` | `ThemeToggle.tsx` | header monta el toggle | ✓ WIRED |
| `home`/`report.module.css` | `tokens.css` | `var(--surface)` etc. | ✓ WIRED |
| `report.module.css` | Geist Mono | `var(--font-geist-mono)` en métricas | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Typecheck del paquete web | `pnpm --filter @auditor/web typecheck` | tsc --noEmit exit 0 | ✓ PASS |
| Build de producción | `pnpm --filter @auditor/web build` | Compiled successfully, 9 rutas | ✓ PASS |
| Deps geist + next-themes instaladas | inspección node_modules | geist@1.7.2, next-themes@0.4.6 (symlinks pnpm presentes) | ✓ PASS |
| Array woff2 es fuente real | `file Array-Regular.woff2` | WOFF2 válido 20832 bytes | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| FONT-01 (Array self-hosted → `--font-array`) | 08-01 | ✓ SATISFIED | localFont woff2, variable `--font-array` |
| FONT-02 (Khand → `--font-khand`) | 08-01 | ✓ SATISFIED | next/font/google 400-700, variable |
| FONT-03 (Geist Sans/Mono) | 08-01 | ✓ SATISFIED | paquete geist, ambas variables |
| FONT-04 (roles aplicados, fallbacks, swap) | 08-03/04/05 | ✓ SATISFIED (base) | body=Sans, nav=Khand, métricas=Mono; roles en componentes → Phase 9, display Array/headings pantalla → Phase 10 (documentado) |
| DS-01 (tokens centralizados) | 08-02/05 | ✓ SATISFIED (base) | tokens.css + migración globals/home/report; hex inline/SVG → Phase 10 (documentado) |
| DS-02 (paleta + severidad + estados coherentes) | 08-02 | ✓ SATISFIED | 3 tokens únicos para severidad y score-state |
| DS-03 (claro/oscuro, persistente, sin flash) | 08-03 | ✓ SATISFIED (código) | next-themes + toggle + suppressHydration; runtime → humano |
| DS-04 (layout base compartido) | 08-04 | ✓ SATISFIED | shell + header/footer en layout.tsx |

### Anti-Patterns Found

Ninguno. Sin debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) en los archivos de la fase. Sin hex hardcodeado en CSS Modules migrados. Sin `@media (prefers-color-scheme)` residual. Sin stubs ni handlers vacíos.

### Human Verification Required

1. **No-FOUC dark-first en recarga** — Recargar varias veces; no debe aparecer flash de tema claro antes de resolver a oscuro.
2. **Persistencia del toggle entre sesiones** — Cambiar tema, cerrar y reabrir; la preferencia debe persistir vía localStorage.
3. **Focus ring y movimiento reducido** — Tab hasta toggle/wordmark/nav muestra ring de marca; sin animación con prefers-reduced-motion.
4. **Sin regresión visual vs v1.0** — Comparar home/verify/report/history en ambos temas contra v1.0.
5. **Alineación de marca con juan-tech.com** — Confirmar que la paleta lime + ink comunica el posicionamiento (hex aproximados aprobados, ajustables).

### Gaps Summary

No hay gaps automáticos. Los 5 Success Criteria del roadmap están satisfechos a nivel de código y estructura: las 4 fuentes cargan self-hosted con variables/swap/fallbacks, los tokens están centralizados y consumidos (0 hex en módulos migrados), la coherencia severidad↔score-state está implementada, el theming next-themes está correctamente cableado (provider + toggle + suppressHydrationWarning), y el shell base (header/footer/container/grid) envuelve todas las pantallas. Typecheck y build de producción pasan limpios. Los elementos diferidos (aplicación plena de Array como display, roles tipográficos en componentes, tokenización de hex inline/SVG) son propiedad explícita de las Fases 9/10 según la trazabilidad de REQUIREMENTS y no son gaps de la Fase 8. El status es `human_needed` únicamente porque cuatro comportamientos visuales/runtime (no-FOUC, persistencia, focus ring, no-regresión) y la alineación subjetiva de marca requieren confirmación humana.

---

_Verified: 2026-07-05_
_Verifier: Claude (gsd-verifier)_
