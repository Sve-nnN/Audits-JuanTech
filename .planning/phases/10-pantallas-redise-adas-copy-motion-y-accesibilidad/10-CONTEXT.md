# Phase 10: Pantallas rediseñadas, copy, motion y accesibilidad - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensamblar TODAS las pantallas del auditor con los componentes de Fase 9 y los tokens/fuentes de Fase 8: home, verificación de email, progreso de auditoría, reporte `/audits/[id]`, páginas rastreadas + grafo de entidades, historial. Humanizar todo el copy (español neutro sin voceo), sumar motion sutil (score que cuenta, reveals, transiciones, progreso vivo) respetando `prefers-reduced-motion`, y validar accesibilidad + responsive de punta a punta. Cierra SCREEN-01..06, COPY-01..03, MOTION-01..03, A11Y-01..03. Última fase de v1.1. NO toca la lógica de v1.0 (crawl/checks/PSI/scoring/email); solo consume el schema y las APIs existentes.

</domain>

<decisions>
## Implementation Decisions

### Motion + ensamblaje
- Librería de motion: CSS transitions/animations + Web Animations API. CERO librerías pesadas (no framer-motion). CSP-safe.
- Score count-up: hook `useCountUp` con WAAPI animando el número + `--gauge-offset` (custom prop ya preparado en ScoreGauge de Fase 9).
- Reveal de secciones: IntersectionObserver + clase CSS de fade/slide sutil.
- Progreso vivo: reusar el polling existente de `AuditProgress.tsx`; sumar barra/indicador de fase animado (rastreando / analizando / midiendo rendimiento).
- Todo el motion detrás de guard `@media (prefers-reduced-motion: reduce)`.

### Copy + alcance
- Humanización: todo el copy nuevo o reescrito pasa por la skill humanizer antes de commit. Español neutro SIN voceo, sin tells de IA, sin em/en dashes. Incluye copy de recomendaciones de issues, errores, cuota, verificación.
- Grafo de entidades: restilar `EntityGraphSvg` existente a tokens (color/stroke/fuente); NO reescribir la lógica del grafo.
- Validación: Juan valida cada pantalla en dev server (checkpoint humano de validación visual). En modo autónomo se consolida: Claude corre el dev server y captura las pantallas él mismo primero (verificar render), luego Juan hace el pase pixel-perfect final.
- Agrupación de planes: 1 plan por pantalla (6) + 1 de motion transversal + 1 de a11y/responsive sweep (~8 planes).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Fase 8 + 9)
- Tokens: `apps/web/app/tokens.css`. Fuentes: `apps/web/app/fonts.ts`. Shell: AppHeader/AppFooter/shell.module.css, ThemeToggle.
- Componentes Fase 9 en `apps/web/app/components/ui/`: ScoreGauge, CategoryCard, Badge/SeverityBadge/DiffBadge, IssuesTable, CategoryAccordion (+AccordionSubgroup/IssueDetail), Button, Input, Field, EmptyState/ErrorState, Skeleton, labels.ts (SEVERITY_LABEL/DIFF_LABEL/STATUS_LABEL), url.ts (shortUrl/issueUrl).
- ScoreGauge expone `--gauge-offset` sin transición (listo para animar acá). EmptyState acepta `titleLevel`.

### Pantallas actuales a rediseñar
- `app/page.tsx` + `HomeClient.tsx` + `home.module.css` (SCREEN-01).
- `app/verify/page.tsx` + `VerifyClient.tsx` (SCREEN-02).
- `app/audits/[id]/AuditProgress.tsx` (SCREEN-03, tiene polling + hex inline a tokenizar).
- `app/audits/[id]/page.tsx` + `report.module.css` (SCREEN-04, mayor consumidor de componentes).
- `app/audits/[id]/pages/page.tsx` + `pages/[pageId]/page.tsx` + `components/EntityGraphSvg.tsx` (SCREEN-05, hex inline a tokenizar).
- `app/history/page.tsx` (SCREEN-06).

### Deuda de Fase 8 a cerrar acá
- Hex hardcodeado inline/SVG en AuditProgress.tsx, pages/page.tsx, pages/[pageId]/page.tsx, EntityGraphSvg.tsx (diferido explícito de Fase 8 → DS-01 se completa acá). En dark se ven rotos hoy.
- Copy con voceo en pantallas actuales ("Ingresá", "podés", "te damos") → reescribir sin voceo (COPY-01/02).

### Feedback de Juan (validación Fase 8) — .planning/UI-FEEDBACK.md
- Home: card flota con vacío vertical enorme arriba; contraste bajo del texto de descripción. Rehacer hero con jerarquía y densidad correctas (AA).
- Reporte y componentes: ensamblar con la librería de Fase 9.
- Array NO en títulos (headings=Khand). Regla fija.

</code_context>

<specifics>
## Specific Ideas

- El reporte de referencia (juan-tech.com, 86/100) define el look objetivo del reporte: hero score, categorías, issues prioritarios, detalle problemas/correctos, rendimiento, diff.
- Reusar el polling de progreso existente, no reescribirlo.
- Consolidar la validación visual: Claude captura pantallas en dev server (dark + light, móvil + desktop) antes del pase final de Juan.

</specifics>

<deferred>
## Deferred Ideas

- Export del reporte a PDF / branding compartible → v2.
- Ilustraciones/gráficos custom por categoría → post-v1.1.
- Cualquier cambio en lógica de crawl/checks/scoring/email → fuera de v1.1 (UI-only).

</deferred>
