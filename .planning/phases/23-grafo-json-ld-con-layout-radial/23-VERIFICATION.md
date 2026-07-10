---
phase: 23-grafo-json-ld-con-layout-radial
verified: 2026-07-09T21:40:00Z
status: passed
score: 4/4 auto-verifiable truths verified + checkpoint visual APROBADO por Juan
re_verification:
  previous_status: human_needed
  note: "Checkpoint visual aprobado por Juan tras iterar el look (Classy Schema). Rediseño a árbol radial resolvió un bug de solape (colapso de cadenas profundas) reproducido y validado contra las 1469 páginas reales con JSON-LD: 0 pares de nodos a menos de 2*NODE_RADIUS. Commits finales: afd5164, a2ba138, f16c6c7."
human_verification:
  - test: "Levantar la web (cd apps/web && pnpm dev) y abrir el detalle de una página con un solo grafo JSON-LD en /audits/[id]/pages/[pageId]"
    expected: "La entidad raíz (sin edges entrantes) aparece CENTRADA con sus hijos alrededor en anillo — ya no el círculo uniforme. Los nietos (nivel BFS 2+) se ven en anillos exteriores."
    why_human: "Requiere validar la percepción visual del layout renderizado en el navegador; la corrección geométrica está cubierta por tests pero la legibilidad/estética del render final sólo se confirma a ojo (Success Criteria 1)."
  - test: "Abrir el detalle de una página con múltiples grafos (ej. BlogPosting + BreadcrumbList) en /audits/[id]/pages/[pageId]"
    expected: "Cada componente conexo se ve con su propio centro, en su propia zona/celda del grid, SIN superponerse con el otro. El alto del canvas crece con las filas de componentes."
    why_human: "El no-solape entre bounding boxes está testeado, pero la separación visual real (incluyendo overflow de captions IN-02, sólo estético) y la legibilidad de flechas/labels entre componentes requiere inspección visual (Success Criteria 2)."
  - test: "Confirmar la legibilidad de flechas y labels de edges en ambos casos"
    expected: "Las líneas con markerEnd (flecha), los chips y labels de relación en el midpoint siguen legibles y no ilegibles/encimados."
    why_human: "Legibilidad tipográfica y de marcadores SVG no verificable por grep/tests."
---

# Phase 23: Grafo JSON-LD con layout radial — Verification Report

**Phase Goal:** El grafo de entidades JSON-LD usa layout radial por componente conexo, con el nodo raíz de cada grafo al centro de su componente, reemplazando el círculo uniforme; lógica en módulo puro determinista `entityGraphLayout.ts` con tests verdes; SVG puro, sin deps nuevas, tokens-only sin hex, CSP-safe.
**Verified:** 2026-07-09T20:31:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El root de cada componente (entidad sin edges entrantes) queda al centro con hijos en anillos — no círculo uniforme (SC1) | ✓ VERIFIED (código+tests); visual pendiente | `entityGraphLayout.ts:124` root = `comp.find(incoming===0) ?? comp[0]`; niveles BFS `:126-137`; posición root al centro de celda `:199`, anillos `:203-205`. Tests "root centrado", "root=sin-incoming", "tie-break en ciclo", "anillos por BFS" verdes. `RADIUS`/`2π·i/n` ausentes en tsx (grep=0). |
| 2 | Varios grafos (BlogPosting + BreadcrumbList) muestran cada componente en su celda sin superponerse (SC2) | ✓ VERIFIED (código+tests); visual pendiente | Grid `columns` `:94`, celdas `:191-195`, alto dinámico por filas `:171-181`. Test "multiples componentes sin solape" valida bounding boxes disjuntas; "grid con 2 filas" valida height creciente. WR-01 (colapso de anillos multi-componente) corregido: `makeRingRadius` escala paso por `maxLvl` `:104-113`, test "multi-componente profundidad>=2" verde. |
| 3 | Un solo componente ocupa el canvas centrado; el alto crece con las filas | ✓ VERIFIED | `columns = components.length <= 1 ? 1 : 2` `:94`; `cellHeight` dinámico `:166`; height = suma de rowHeights `:181`. Test "un solo componente: root centrado" verde. |
| 4 | Sigue siendo SVG puro, determinista, sin deps nuevas, tokens-only sin hex, CSP-safe (SC3) | ✓ VERIFIED | Módulo puro: grep `react\|jsx\|module.css\|Math.random\|Date.now` en `entityGraphLayout.ts` = 0. CSS hex = 0. package.json sin cambios (git diff vacío). Test "determinismo" verde. Sólo tipos `import type` desde @auditor/checks. |

**Score:** 4/4 auto-verifiable truths verified. 1 visual checkpoint (Task 3, blocking gate) pendiente de Juan.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/components/entityGraphLayout.ts` | Módulo puro: componentes conexos + BFS radial + grid + dims dinámicas | ✓ VERIFIED | 211 líneas, exporta `layoutEntityGraph` + `EntityGraphLayout` + constantes `GRAPH_WIDTH`/`NODE_RADIUS`/`MIN_CELL_HEIGHT`. Puro y determinista. |
| `apps/web/app/components/entityGraphLayout.test.ts` | Tests deterministas (root centro, multi-componente sin solape, determinismo) | ✓ VERIFIED | 10 tests, todos verdes. Cubre los 8 casos del plan + caso extra multi-componente profundidad>=2 (fix WR-01). |
| `apps/web/app/components/EntityGraphSvg.tsx` | Render que consume `layoutEntityGraph` en vez del círculo uniforme | ✓ VERIFIED | Importa y llama `layoutEntityGraph` (grep=3); `RADIUS`/`2π·i/n` retirados; conserva estado vacío, defs/marker, edges, nodos. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `EntityGraphSvg.tsx` | `entityGraphLayout.ts` | import `layoutEntityGraph`; positions/width/height alimentan el SVG | ✓ WIRED | `:2` import, `:58` `const { width, height, positions } = layoutEntityGraph(graph)`, consumido en `<svg>` `:61` y en resolución de edges/nodos `:69-101`. |
| `entityGraphLayout.ts` | `graph.edges` | adyacencia no dirigida + incoming dirigido | ✓ WIRED | `:52-67` filtra validEdges, construye adj bidireccional y `incoming`. |
| `EntityGraphSvg` | ruta `/audits/[id]/pages/[pageId]` | render en la página de detalle | ✓ WIRED | `page.tsx:5` import, `page.tsx:64` `<EntityGraphSvg graph={graph} />`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests del layout pasan | `pnpm exec vitest run app/components/entityGraphLayout.test.ts` | 10 passed (10) | ✓ PASS |
| Typecheck limpio | `pnpm typecheck` (tsc --noEmit) | sin errores | ✓ PASS |
| `layoutEntityGraph` presente en render | grep en EntityGraphSvg.tsx | 3 matches | ✓ PASS |
| Círculo uniforme retirado | grep `2π·i` / `const RADIUS =` | 0 | ✓ PASS |
| Cero hex en CSS | grep `#[0-9a-f]{3,6}` en module.css | 0 | ✓ PASS |
| Módulo puro/determinista | grep react/jsx/Math.random/Date.now | 0 | ✓ PASS |
| Sin deps nuevas | git diff apps/web/package.json | vacío | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SDVIZ-01 | 23-01-PLAN.md | Grafo JSON-LD con layout radial por componente conexo | ✓ SATISFIED (código); visual pendiente | Truths 1-4 verificados; checkpoint visual Task 3 pendiente de Juan. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno | — | Sin TODO/FIXME/XXX/placeholder en los archivos de la fase; sin returns vacíos que fluyan a UI; sin stubs. |

### Code Review Follow-up (23-REVIEW.md)

| Finding | Status en código |
|---------|------------------|
| WR-01 (anillos colapsan en multi-componente) | ✓ CORREGIDO — `makeRingRadius(maxLvl)` escala el paso al `maxCellRadius` real `:104-113`; test dedicado "multi-componente profundidad>=2" verde. |
| WR-02 (constantes duplicadas/drift) | ✓ CORREGIDO — `GRAPH_WIDTH`/`NODE_RADIUS`/`MIN_CELL_HEIGHT` exportadas del módulo e importadas por el renderer `EntityGraphSvg.tsx:2`. |
| IN-01 (self-loops dibujados en render) | ✓ CORREGIDO — guard `edge.from === edge.to` en el render `:74`. |
| IN-02 (overflow de captions), IN-03 (canvas vacío divergente) | IN-03 corregido (renderer usa `MIN_CELL_HEIGHT` del módulo `:50-51`). IN-02 es estético/informativo, no bloqueante. |

### Human Verification Required

Los tres items del bloque `human_verification` en frontmatter corresponden al gate `checkpoint:human-verify` (Task 3) del plan — validación visual del layout renderizado que no puede automatizarse:

1. **Single-graph centrado** — root al centro con hijos en anillos, nietos en anillos exteriores (SC1).
2. **Multi-graph sin solape** — cada componente en su zona, sin superponerse, canvas que crece por filas (SC2).
3. **Legibilidad de flechas/labels** — markers y labels de edges legibles.

### Gaps Summary

No hay gaps de código. Los 4 truths auto-verificables están VERIFIED, los 3 artefactos existen/son sustantivos/están wired, los 3 key links conectados, los 10 tests verdes, typecheck limpio, sin deps nuevas, cero hex, módulo puro determinista. Los hallazgos del review (WR-01/WR-02/IN-01/IN-03) están aplicados en el código verificado.

El estado es **human_needed** porque el plan define Task 3 como un `checkpoint:human-verify` con gate bloqueante: la confirmación visual del layout radial renderizado (root centrado + componentes separados sin solape) sólo la puede dar Juan a ojo en el navegador. Es el único item pendiente para cerrar la fase.

---

_Verified: 2026-07-09T20:31:00Z_
_Verifier: Claude (gsd-verifier)_
