---
phase: 22-arbol-de-arquitectura-estilo-octopus
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/report-model/src/model.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/build.test.ts
  - apps/web/app/components/ArchitectureTreeSvg.tsx
  - apps/web/app/components/ArchitectureTreeSvg.module.css
  - apps/web/app/audits/[id]/page.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-07-09
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Se revisó la reconstrucción del árbol desde `graph.edges` (build.ts), el layout
determinista del dendrograma (ArchitectureTreeSvg.tsx), el CSS por tokens y la
página de reporte. La lógica central es sólida: el árbol es acíclico por
construcción (padre siempre con `depth` estrictamente menor), ningún nodo válido
se pierde (cada `archNode` termina como hijo o raíz), un nodo enlazado sólo por
páginas rotas/excluidas cae correctamente como raíz, y el promedio-de-X no
produce NaN ni división por cero. No hay XSS (todo va como texto SVG que React
escapa; sin `dangerouslySetInnerHTML`), el CSS es 100% tokens (sin hex), y la
migración `nodesByDepth`→`tree` no dejó referencias muertas fuera de comentarios
en el test.

Las fallas encontradas son de robustez/visualización, no de seguridad. La más
relevante: el label "+N más" de la banda de huérfanas se dibuja fuera de la
altura calculada del lienzo y queda recortado. También hay un riesgo de
duplicación de nodos ante URLs repetidas en `graph.nodes` y una colocación
incorrecta cuando `depthByUrl` no trae la profundidad de un nodo.

## Warnings

### WR-01: El label "+N más" de huérfanas se dibuja fuera del lienzo y queda recortado

**File:** `apps/web/app/components/ArchitectureTreeSvg.tsx:239-248`
**Issue:** La altura de la banda de huérfanas (`orphanBandH`, línea 181-183) sólo
reserva `ORPHAN_LABEL_H + orphanRows*NODE_H + (orphanRows-1)*GAP_Y` — no incluye
espacio extra para el nodo-resumen de overflow. Sin embargo el texto "+N más" se
posiciona en:

```
y = orphanBandTop + ORPHAN_LABEL_H + orphanRows*(NODE_H+GAP_Y) - GAP_Y + NODE_H/2
  = orphanBandTop + orphanBandH + NODE_H/2
```

Es decir, `NODE_H/2` (42px) por debajo del final de la banda. El fondo real del
lienzo (`height`) sólo llega hasta `orphanBandTop + orphanBandH + PAD` (PAD=20).
El texto queda ~22px por debajo del borde del SVG y el `viewBox` lo recorta.
Cuando `orphans.length > MAX_ORPHANS` (>24) el usuario NUNCA ve el "+N más" — que
es justamente la garantía anti-truncado-silencioso (T-22-04) que el diseño busca.
**Fix:** Reservar una fila (o al menos `ORPHAN_LABEL_H`) extra en el alto cuando
`hiddenOrphans > 0`, y bajar el texto a esa zona:
```tsx
const orphanBandH = hasOrphans
  ? ORPHAN_LABEL_H + orphanRows * NODE_H + (orphanRows - 1) * GAP_Y
    + (hiddenOrphans > 0 ? GAP_Y + ORPHAN_LABEL_H : 0)
  : 0;
// ...y colocar el texto dentro de esa banda extra:
y={orphanBandTop + ORPHAN_LABEL_H + orphanRows * (NODE_H + GAP_Y) + ORPHAN_LABEL_H / 2}
```

### WR-02: URLs duplicadas en `graph.nodes` duplican el nodo en el árbol

**File:** `packages/report-model/src/build.ts:210-256`
**Issue:** `archByUrl` está indexado por URL (dedup implícito), pero el bucle de
anclado (líneas 247-256) itera sobre `graph.nodes` y hace
`archByUrl.get(node.url)` por cada entrada. Si `graph.nodes` contiene la misma
URL dos veces (dos `pageId` distintos que normalizan a la misma URL), se obtiene
el MISMO objeto `archNode` en ambas iteraciones y se hace `push` dos veces — el
nodo aparece duplicado (como hijo repetido o como dos raíces). El foco del review
("cada nodo colocado exactamente una vez") se rompe en ese caso. El código
confía en que las URLs son únicas, pero nada lo garantiza en runtime.
**Fix:** Deduplicar por URL al anclar, con un `Set` de URLs ya colocadas:
```ts
const placedUrls = new Set<string>();
for (const node of graph.nodes) {
  if (placedUrls.has(node.url)) continue;
  const archNode = archByUrl.get(node.url);
  if (!archNode) continue;
  placedUrls.add(node.url);
  // ...resto igual
}
```

### WR-03: Nodo con `depthByUrl` faltante cae a profundidad 0 y se coloca mal

**File:** `packages/report-model/src/build.ts:213`
**Issue:** `const depth = graph.depthByUrl[node.url] ?? 0;` — si `depthByUrl` no
trae la profundidad de un nodo (grafo parcial, URL no normalizada igual que en
`depthByUrl`, o entrada omitida por BFS), el nodo asume `depth = 0`. Un hijo real
que debería colgar de la home queda con la misma profundidad que la home, por lo
que la guarda `parent.depth >= child.depth` (línea 236) descarta a la home como
padre y el nodo termina como RAÍZ suelta en vez de anidado. Es una degradación
silenciosa que ensucia el árbol sin señal alguna.
**Fix:** Distinguir "profundidad 0 real" de "sin dato". Si la URL no está en
`depthByUrl`, tratarla como huérfana/desconocida en vez de forzar 0, o registrar
la ausencia:
```ts
const rawDepth = graph.depthByUrl[node.url];
const depth = typeof rawDepth === "number" ? rawDepth : Number.POSITIVE_INFINITY;
// (o excluir el nodo del árbol y mandarlo a orphans si no tiene profundidad)
```

### WR-04: `finalUrl` se selecciona pero nunca se usa para clasificar el nodo

**File:** `packages/report-model/src/build.ts:167, 214-221`
**Issue:** El `select` de páginas incluye `finalUrl`, y `ArchPageRow` lo declara,
pero al construir el nodo se usa siempre `node.url` (la URL del grafo) para
`classifyTemplate` y para la key. Si una página redirige (`url` ≠ `finalUrl`), la
plantilla se clasifica sobre la URL de origen, no la final — inconsistente con el
resto del reporte que muestra `resolvedUrl`. O bien `finalUrl` es un campo muerto
en el select (columna traída sin uso), o hay un bug de clasificación. Ambas
lecturas son defectos.
**Fix:** Decidir la intención: si la clasificación debe usar la URL final,
pasar `pagesById.get(node.pageId)?.finalUrl ?? node.url` a `classifyTemplate`; si
no, quitar `finalUrl` del `select` y de `ArchPageRow` para no arrastrar columna
sin uso.

## Info

### IN-01: Clase CSS `.placeholderText` sin uso (código muerto)

**File:** `apps/web/app/components/ArchitectureTreeSvg.module.css:35-38`
**Issue:** `.placeholderText` está definida pero no se referencia en
`ArchitectureTreeSvg.tsx` (el estado vacío usa `.emptyText`). Sobra tras la
reescritura del Plan 22-02.
**Fix:** Eliminar la regla `.placeholderText`.

### IN-02: Ternario redundante en el ancho de la insignia de profundidad

**File:** `apps/web/app/components/ArchitectureTreeSvg.tsx:275`
**Issue:** `width={node.isOrphan ? 66 : 66}` — ambas ramas devuelven 66; el
ternario no hace nada (residuo de cuando huérfana y no-huérfana tenían anchos
distintos).
**Fix:** `width={66}`.

### IN-03: Comentario referencia una constante ya eliminada (`MAX_NODES_PER_ROW`)

**File:** `apps/web/app/components/ArchitectureTreeSvg.tsx:17`
**Issue:** El comentario "Alineado con el antiguo MAX_NODES_PER_ROW=12" apunta a
una constante que ya no existe en el código. No es un bug, pero es un rastro
muerto de la migración que confunde a quien lea el archivo.
**Fix:** Ajustar el comentario para describir el cap actual sin referenciar el
símbolo eliminado.

---

_Reviewed: 2026-07-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
