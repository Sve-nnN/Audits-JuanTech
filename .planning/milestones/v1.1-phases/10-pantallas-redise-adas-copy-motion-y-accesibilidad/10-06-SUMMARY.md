---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: 06
subsystem: ui
tags: [css-modules, design-tokens, svg, next-app-router, a11y, motion, ds-01]

# Dependency graph
requires:
  - phase: 10-01
    provides: design tokens (tokens.css), Badge/SeverityBadge/EmptyState, url.ts, useReveal
provides:
  - SCREEN-05 tokenizado (lista de páginas rastreadas + detalle estructura/AEO)
  - pages.module.css con clases token-backed para ambas vistas
  - EntityGraphSvg restilado a tokens (TYPE_COLORS -> clases por @type) con lógica intacta
  - Grafo responsive (width:100%, max-width 720px) sin overflow horizontal
affects: [phase-10 checkpoint visual, futuros reportes por página]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component + CSS Module: estilo por className/var, sin lookup JS de tema"
    - "SVG por token: nodo con fill:currentColor + clase de color por @type en el <g> padre"
    - "Reveal (client) envuelto como <li> dentro de server component para stagger on-scroll"

key-files:
  created:
    - apps/web/app/audits/[id]/pages/pages.module.css
    - apps/web/app/components/EntityGraphSvg.module.css
  modified:
    - apps/web/app/audits/[id]/pages/page.tsx
    - apps/web/app/audits/[id]/pages/[pageId]/page.tsx
    - apps/web/app/components/EntityGraphSvg.tsx

key-decisions:
  - "Contenedor de lectura --container-narrow (720px), que coincide con el viewBox del grafo"
  - "node type label -> --accent-foreground (texto oscuro) sobre fills de nodo mayormente claros/mid"
  - "Fade del grafo por keyframe CSS puro (no JS scroll-trigger), neutralizado por reduced-motion global"

patterns-established:
  - "@type -> clase de color token-backed en el <g>, círculo con fill:currentColor"
  - "Severidad de hallazgo via --finding-color local + SeverityBadge de Fase 9"

requirements-completed: [SCREEN-05, COPY-01, COPY-02]

# Metrics
duration: 7min
completed: 2026-07-06
---

# Phase 10 Plan 06: Páginas rastreadas + Grafo de entidades Summary

**SCREEN-05 tokenizado (DS-01 cerrado para estas vistas): lista y detalle de páginas migrados de hex/inline a pages.module.css, EntityGraphSvg restilado a tokens con su lógica de layout intacta y contenedor responsive, componiendo Badge/SeverityBadge/EmptyState con copy neutro sin voceo.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-06T15:53:10Z
- **Completed:** 2026-07-06T16:00:51Z
- **Tasks:** 2 auto ejecutadas + 1 checkpoint (auto-aprobado en auto-mode)
- **Files modified:** 5 (2 creados, 3 modificados)

## Accomplishments
- Lista de páginas rastreadas tokenizada: rows en --surface, dividers --border, contenedor --radius-md; URL como link mono --accent-text con shortUrl + title de URL completa; indicador de presencia via Badge (ok/neutral); EmptyState para set vacío; stagger de reveal on-scroll.
- Detalle estructura/AEO tokenizado: meta URL/HTTP mono --text-secondary, card de grafo --surface/--border/--radius-lg, hallazgos como cards con left-border de severidad por token + SeverityBadge, EmptyState de hallazgos.
- EntityGraphSvg restilado a tokens: TYPE_COLORS hex -> clases por @type (fill:currentColor), strokes/markers/labels/caption tokenizados, fuentes Geist sans/mono via CSS, canvas transparente, svg responsive. Layout circular, edges/nodes, role="img" y rama empty preservados verbatim.
- Reads Prisma + notFound + derivación schemaGraph->node-count intactos en ambos server components.
- Copy en español neutro sin voceo; cero hex crudo y cero system-ui en los 3 .tsx.

## Task Commits

1. **Task 1: Tokenizar lista + detalle de páginas + componentes Fase 9 + copy** - `44caa65` (feat)
2. **Task 2: Restyle de EntityGraphSvg a tokens + contenedor responsive** - `478c1f6` (feat)
3. **Task 3: Validación visual (Juan)** - checkpoint human-verify, auto-aprobado en auto-mode

## Files Created/Modified
- `apps/web/app/audits/[id]/pages/pages.module.css` - Estilos tokenizados para lista y detalle (creado)
- `apps/web/app/components/EntityGraphSvg.module.css` - Paleta por @type + estilos del grafo (creado)
- `apps/web/app/audits/[id]/pages/page.tsx` - Lista tokenizada con Badge/EmptyState/shortUrl + reveal (modificado)
- `apps/web/app/audits/[id]/pages/[pageId]/page.tsx` - Detalle tokenizado con SeverityBadge/EmptyState (modificado)
- `apps/web/app/components/EntityGraphSvg.tsx` - Restyle a tokens, lógica intacta (modificado)

## Decisions Made
- Contenedor de lectura en `--container-narrow` (720px), coincidiendo con el viewBox 720 del grafo para que la card lo enmarque sin holgura.
- Etiqueta de tipo del nodo con `--accent-foreground` (ink oscuro) por legibilidad sobre los fills de nodo mayormente claros/mid del set de tokens.
- Fade-in del grafo con keyframe CSS puro (sin trigger JS por scroll, ya que es server component); la red global de `prefers-reduced-motion` lo deja estático completo.

## Deviations from Plan

None - plan executed exactly as written. Se compusieron los componentes de Fase 9 y los helpers/tokens según el mapa de tokenización del plan, sin fixes de bug ni funcionalidad extra.

## Issues Encountered
- El gate `pnpm typecheck` reporta 2 errores TS2322 en `apps/web/app/HomeClient.tsx` (prop `ref` sobre `Input` sin `forwardRef`). Ese archivo NO pertenece a este plan: está siendo modificado en paralelo por el plan hermano de SCREEN-01 (working tree lo muestra ` M HomeClient.tsx` + `M home.module.css`, ninguno tocado por 10-06). Los 5 archivos de 10-06 compilan limpios en aislamiento (el typecheck de Task 1 pasó antes de que el hermano invalidara la caché incremental). Por SCOPE BOUNDARY no se corrige aquí; registrado en `deferred-items.md`. Owner: quien cierre SCREEN-01/Input debe agregar `forwardRef` a `Input`.
- El checkpoint pedía captura de dev server en dark/light; un build/dev completo está bloqueado por el error transitorio de `HomeClient.tsx` del plan hermano, así que no se pudo capturar automáticamente. Los gates de tokens (cero hex, cero system-ui, role="img") sí pasaron sobre los archivos en scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SCREEN-05 listo para validación visual de Juan (dark/light, mobile/desktop, grafo poblado y vacío) una vez el hermano de SCREEN-01 destrabe el typecheck compartido.
- DS-01 cerrado para lista de páginas, detalle y EntityGraphSvg.

## Self-Check: PASSED

- Archivos verificados en disco: pages.module.css, EntityGraphSvg.module.css, pages/page.tsx, pages/[pageId]/page.tsx, EntityGraphSvg.tsx — todos FOUND.
- Commits verificados: `44caa65`, `478c1f6` — ambos FOUND.
- Typecheck de archivos en scope: 0 errores (los errores restantes de `pnpm typecheck` son de archivos de planes hermanos: `HomeClient.tsx` ya resuelto por 10-02, `audits/[id]/page.tsx` de SCREEN-04).

---
*Phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad*
*Completed: 2026-07-06*
