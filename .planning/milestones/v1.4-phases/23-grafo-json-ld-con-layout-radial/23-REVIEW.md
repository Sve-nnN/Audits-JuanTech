---
phase: 23-grafo-json-ld-con-layout-radial
reviewed: 2026-07-10T01:24:28Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/web/app/components/entityGraphLayout.ts
  - apps/web/app/components/entityGraphLayout.test.ts
  - apps/web/app/components/EntityGraphSvg.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: findings
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-10T01:24:28Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Se revisó el módulo puro de layout radial (`entityGraphLayout.ts`), sus tests y el
renderer reescrito (`EntityGraphSvg.tsx`). El módulo cumple los constraints del
plan: es determinista (sin `Math.random`/`Date.now`), no importa React/DOM/estilos,
maneja el grafo vacío sin lanzar, y protege la geometría contra división por cero y
NaN (guards de `count > 1` y arrays no vacíos en `byLevel`). El wiring del renderer
resuelve posiciones por `node.id` y tiene guards para posiciones ausentes en aristas
y nodos.

No hay defectos Critical (sin crashes, sin riesgo de datos, sin superficie de
seguridad — es un módulo puro de geometría). El hallazgo principal es un defecto de
correctitud geométrica: en layouts de 2+ componentes los anillos colapsan al mismo
radio y los nodos de distinto nivel se superponen (hasta coincidir exactamente),
que es justamente el problema que el módulo debe evitar. Los tests no lo cubren
porque el caso de anillos usa un solo componente.

## Warnings

### WR-01: Los anillos colapsan al mismo radio en layouts multi-componente (nodos superpuestos)

**File:** `apps/web/app/components/entityGraphLayout.ts:91-101`
**Issue:** Con 2+ componentes, `columns = 2` ⇒ `cellW = 720/2 = 360` ⇒
`maxCellRadius = 360/2 - NODE_RADIUS - CELL_PAD = 180 - 34 - 40 = 106`. Pero
`RING_BASE = 120 > 106`, así que `ringRadius(level, count)` satura a `maxCellRadius`
(106) para **todos** los niveles:
- nivel 1 → `min(max(120, ...), 106) = 106`
- nivel 2 → `min(max(220, ...), 106) = 106`

Todos los anillos con `level >= 1` quedan en radio 106. En una cadena `R → A → C`
dentro de un grafo con otro componente (para forzar `columns = 2`), `A` (nivel 1) y
`C` (nivel 2) quedan a la misma distancia del centro; y como cada anillo reparte
desde `START_ANGLE = -π/2`, si ambos anillos tienen 1 nodo obtienen el mismo ángulo
→ **misma coordenada exacta**, nodos totalmente encimados. Esto contradice el
objetivo del layout (jerarquía visible por anillos) y no lo detecta ningún test: el
caso "nieto en anillo exterior" usa un solo componente (`columns = 1`,
`maxCellRadius = 286`), donde sí funciona.

**Fix:** Que el radio del primer anillo dependa del `maxCellRadius` real de la celda
(no de una constante que puede excederlo), y distribuir los niveles dentro del
espacio disponible en vez de saturar. Por ejemplo, escalar el paso de anillo al
número de niveles del componente:
```ts
// dentro de placed.map, tras conocer maxLvl del componente:
const ringStep = maxLvl > 0
  ? Math.min(RING_STEP, (maxCellRadius - NODE_RADIUS) / maxLvl)
  : RING_STEP;
const ringBase = Math.min(RING_BASE, ringStep);
const ringRadius = (level: number, count: number): number => {
  const base = ringBase + (level - 1) * ringStep;
  const minForCount = count > 1 ? (count * (2 * NODE_RADIUS + RING_GAP)) / (2 * Math.PI) : 0;
  return Math.min(Math.max(base, minForCount), maxCellRadius);
};
```
Como mínimo, añadir un test con 2 componentes donde uno tenga profundidad ≥ 2 y
verificar que `dist(center, C) > dist(center, A)` (hoy fallaría).

### WR-02: Constantes de geometría duplicadas entre el módulo y el renderer (riesgo de drift)

**File:** `apps/web/app/components/EntityGraphSvg.tsx:9-10` y `apps/web/app/components/entityGraphLayout.ts:15,16`
**Issue:** `WIDTH = 720` y `NODE_RADIUS = 34` están declaradas por separado en ambos
archivos, y el módulo depende de que coincidan (el comentario en el módulo lo admite:
"coincide con el renderer"). El renderer dibuja círculos con `r = NODE_RADIUS` (34) y
posiciona la caption en `pos.y + 44`, mientras el módulo reserva el padding vertical
usando su propia constante `NODE_RADIUS`. Si una se cambia sin la otra, las celdas se
calculan con un radio distinto al dibujado y los nodos/captions se salen de su celda
o se recortan, sin que ningún test lo detecte (el módulo no importa el renderer y
viceversa exportan constantes distintas).

**Fix:** Exportar las constantes compartidas desde el módulo puro y consumirlas en el
renderer:
```ts
// entityGraphLayout.ts
export const GRAPH_WIDTH = 720;
export const NODE_RADIUS = 34;
```
```tsx
// EntityGraphSvg.tsx
import { layoutEntityGraph, NODE_RADIUS } from "./entityGraphLayout";
```
La `WIDTH` del branch de grafo vacío del renderer también debería derivarse de ahí.

## Info

### IN-01: El renderer dibuja self-loops que el módulo sí filtra

**File:** `apps/web/app/components/EntityGraphSvg.tsx:68-91`
**Issue:** El layout excluye aristas con `e.from === e.to` de la adyacencia
(`entityGraphLayout.ts:49-51`), pero el renderer itera sobre `graph.edges` crudas.
Una arista self-loop tiene `from` y `to` con la misma posición, así que pasa el guard
`if (!from || !to)` y dibuja una `line` de longitud cero (invisible) más un chip y un
label de relación encimados sobre el nodo. Es cosmético, no rompe nada, pero mete
ruido visual y un marker de flecha degenerado.

**Fix:** Saltar self-loops en el render igual que hace el módulo:
```tsx
if (!from || !to || edge.from === edge.to) return null;
```

### IN-02: Overflow horizontal de labels/captions no acotado por el ancho de celda

**File:** `apps/web/app/components/entityGraphLayout.ts:93` y `apps/web/app/components/EntityGraphSvg.tsx:108-110`
**Issue:** `maxCellRadius` acota la geometría de los círculos dentro de media celda,
pero las captions (`truncate(label, 22)`, centradas bajo el nodo) pueden ser más
anchas que el diámetro del nodo. En `columns = 2` la celda mide 360px de ancho y un
nodo en el borde del anillo (radio 106) más una caption larga puede desbordar hacia
la celda vecina o fuera del `viewBox`. Es solo estético (el `viewBox` escala), pero
puede solapar texto de componentes contiguos.

**Fix:** Considerar reducir `max` en `truncate` para el caso de 2 columnas, o reservar
padding horizontal en función del ancho de texto estimado. Bajo severidad porque no
afecta correctitud del grafo.

### IN-03: Rama de grafo vacío duplica geometría y diverge del módulo

**File:** `apps/web/app/components/EntityGraphSvg.tsx:48-56`
**Issue:** El renderer maneja `nodes.length === 0` con un SVG hardcodeado de
`height={120}`, mientras el módulo devuelve `height = MIN_CELL_HEIGHT = 160` para el
mismo caso. No es un bug (el renderer nunca llega a llamar al módulo en ese branch),
pero son dos fuentes de verdad para el "canvas vacío" que ya divergen (120 vs 160).

**Fix:** Unificar la altura del canvas vacío con `MIN_CELL_HEIGHT` exportado del
módulo, o dejar que el módulo calcule también el caso vacío y que el renderer solo
cambie el texto/aria-label.

---

_Reviewed: 2026-07-10T01:24:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
