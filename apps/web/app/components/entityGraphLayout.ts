import type { EntityGraph } from "@auditor/checks";

/**
 * Resultado del layout radial: dimensiones del viewBox + posiciones absolutas
 * (px) por `node.id`. Módulo PURO y determinista (sin dependencias de UI/DOM ni
 * fuentes de no-determinismo) para ser testeable en node y reusable por el renderer.
 */
export interface EntityGraphLayout {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
}

// --- Geometría (Claude's Discretion, ver 23-CONTEXT <decisions>) ---
// Constantes compartidas con el renderer: se exportan desde este módulo puro para
// que exista una única fuente de verdad (el renderer las importa en vez de
// redeclararlas, evitando drift entre el radio reservado y el radio dibujado).
export const GRAPH_WIDTH = 720; // ancho del viewBox; conserva la escala responsive de .canvas
export const NODE_RADIUS = 34; // radio del círculo de nodo (compartido con el renderer)
export const MIN_CELL_HEIGHT = 160; // piso de alto por celda / canvas vacío (compartido)
const CELL_PAD = 40; // margen entre el contenido del componente y el borde de la celda
const RING_BASE = 120; // radio del primer anillo (nivel 1)
const RING_STEP = 100; // incremento de radio por cada nivel de anillo más profundo
const RING_GAP = 16; // separación mínima entre nodos contiguos de un mismo anillo
const START_ANGLE = -Math.PI / 2; // primer hijo arriba (-90°), reparto uniforme 2π/n

function byIndex(indexOf: Map<string, number>) {
  return (a: string, b: string) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0);
}

/**
 * Posiciona cada entidad del grafo con un layout radial por componente conexo:
 * el root de cada componente (sin edges entrantes; tie-break por orden en
 * `graph.nodes`) al centro de su celda, los descendientes en anillos por BFS, y
 * los componentes empacados en un grid sin solaparse. `width` es constante
 * (720) y `height` crece con la cantidad de filas de componentes.
 */
export function layoutEntityGraph(graph: EntityGraph): EntityGraphLayout {
  const positions = new Map<string, { x: number; y: number }>();
  const nodes = graph.nodes;

  if (nodes.length === 0) {
    return { width: GRAPH_WIDTH, height: MIN_CELL_HEIGHT, positions };
  }

  // (1) Índice estable id → orden de aparición; edges válidos (sin self-loop,
  //     ambos extremos presentes) — protege contra ids ausentes / cíclicos.
  const indexOf = new Map<string, number>();
  nodes.forEach((n, i) => {
    if (!indexOf.has(n.id)) indexOf.set(n.id, i);
  });
  const validEdges = graph.edges.filter(
    (e) => e.from !== e.to && indexOf.has(e.from) && indexOf.has(e.to),
  );

  // (2) Adyacencia NO dirigida (para componentes) + incoming dirigido (para root).
  const adj = new Map<string, Set<string>>();
  const incoming = new Map<string, number>();
  for (const n of nodes) {
    if (!adj.has(n.id)) adj.set(n.id, new Set());
    if (!incoming.has(n.id)) incoming.set(n.id, 0);
  }
  for (const e of validEdges) {
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }

  const cmp = byIndex(indexOf);

  // (3) Componentes conexos por flood no dirigido, en orden de aparición.
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const comp: string[] = [];
    const queue = [n.id];
    visited.add(n.id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const nb of [...(adj.get(cur) ?? [])].sort(cmp)) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    comp.sort(cmp);
    components.push(comp);
  }

  // (6) Grid de componentes: 1 componente ocupa todo el ancho; en adelante 2 columnas.
  const columns = components.length <= 1 ? 1 : 2;
  const cellW = GRAPH_WIDTH / columns;
  const maxCellRadius = Math.max(NODE_RADIUS, cellW / 2 - NODE_RADIUS - CELL_PAD);

  // Radio de anillo escalado por componente: el paso y la base se ajustan al
  // `maxCellRadius` real de la celda y a la profundidad del componente, de modo
  // que los niveles de BFS queden distintos y dentro de la celda en cualquier
  // número de columnas. Con constantes fijas (RING_BASE/RING_STEP), en layouts de
  // 2+ componentes (maxCellRadius ≈ 106 < RING_BASE) todos los anillos saturaban
  // al mismo radio y los nodos de distinto nivel se encimaban (mismas coordenadas).
  const makeRingRadius = (maxLvl: number) => {
    const ringStep =
      maxLvl > 0 ? Math.min(RING_STEP, (maxCellRadius - NODE_RADIUS) / maxLvl) : RING_STEP;
    const ringBase = Math.min(RING_BASE, ringStep);
    return (level: number, count: number): number => {
      const base = ringBase + (level - 1) * ringStep;
      const minForCount = count > 1 ? (count * (2 * NODE_RADIUS + RING_GAP)) / (2 * Math.PI) : 0;
      return Math.min(Math.max(base, minForCount), maxCellRadius);
    };
  };

  interface Placed {
    root: string;
    byLevel: Map<number, string[]>;
    cellHeight: number;
    radiusOf: Map<number, number>;
  }

  // (4)+(5) Root por componente + niveles de anillo por BFS no dirigido.
  const placed: Placed[] = components.map((comp) => {
    const root = comp.find((id) => (incoming.get(id) ?? 0) === 0) ?? comp[0]!;

    const levels = new Map<string, number>([[root, 0]]);
    const queue = [root];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const lvl = levels.get(cur)!;
      for (const nb of [...(adj.get(cur) ?? [])].sort(cmp)) {
        if (!levels.has(nb)) {
          levels.set(nb, lvl + 1);
          queue.push(nb);
        }
      }
    }
    // Nodos inalcanzables dentro del componente (no debería pasar) → último anillo.
    let maxLvl = 0;
    for (const l of levels.values()) maxLvl = Math.max(maxLvl, l);
    for (const id of comp) if (!levels.has(id)) levels.set(id, maxLvl + 1);

    const byLevel = new Map<number, string[]>();
    for (const id of comp) {
      const l = levels.get(id)!;
      if (!byLevel.has(l)) byLevel.set(l, []);
      byLevel.get(l)!.push(id);
    }
    for (const arr of byLevel.values()) arr.sort(cmp);

    let compMaxLvl = 0;
    for (const l of byLevel.keys()) compMaxLvl = Math.max(compMaxLvl, l);
    const ringRadius = makeRingRadius(compMaxLvl);

    // Radio precalculado por nivel: única fuente de verdad para el alto de la
    // celda y para escribir las posiciones (evita recalcular con otra escala).
    const radiusOf = new Map<number, number>();
    let maxRadius = 0;
    for (const [lvl, ids] of byLevel) {
      if (lvl === 0) continue;
      const r = ringRadius(lvl, ids.length);
      radiusOf.set(lvl, r);
      maxRadius = Math.max(maxRadius, r);
    }
    const contentR = maxRadius + NODE_RADIUS + CELL_PAD;
    const cellHeight = Math.max(MIN_CELL_HEIGHT, 2 * contentR);
    return { root, byLevel, cellHeight, radiusOf };
  });

  // Alto dinámico: cada fila toma el alto del componente más alto de esa fila.
  const rows = Math.ceil(components.length / columns);
  const rowHeights: number[] = [];
  for (let r = 0; r < rows; r++) {
    let h = MIN_CELL_HEIGHT;
    for (let c = 0; c < columns; c++) {
      const idx = r * columns + c;
      if (idx < placed.length) h = Math.max(h, placed[idx]!.cellHeight);
    }
    rowHeights.push(h);
  }
  const height = rowHeights.reduce((a, b) => a + b, 0);
  const rowTops: number[] = [];
  let acc = 0;
  for (const h of rowHeights) {
    rowTops.push(acc);
    acc += h;
  }

  // (7)+(8) Escribir posiciones absolutas: root al centro de su celda, cada
  //         anillo repartido uniforme desde -π/2.
  placed.forEach((p, idx) => {
    const row = Math.floor(idx / columns);
    const col = idx % columns;
    const cx = col * cellW + cellW / 2;
    const cy = rowTops[row]! + rowHeights[row]! / 2;

    for (const [lvl, ids] of p.byLevel) {
      if (lvl === 0) {
        positions.set(p.root, { x: cx, y: cy });
        continue;
      }
      const radius = p.radiusOf.get(lvl) ?? maxCellRadius;
      ids.forEach((id, i) => {
        const angle = START_ANGLE + (2 * Math.PI * i) / ids.length;
        positions.set(id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      });
    }
  });

  return { width: GRAPH_WIDTH, height, positions };
}
