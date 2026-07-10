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
export const NODE_RADIUS = 22; // radio del círculo de nodo (compartido con el renderer)
export const MIN_CELL_HEIGHT = 160; // piso de alto por celda / canvas vacío (compartido)
const CELL_PAD = 40; // margen entre el contenido del componente y el borde de la celda
const CELL_GAP = 88; // gutter ENTRE celdas de componentes distintos (para que cada grafo se lea como una unidad separada)
const RING_BASE = 120; // radio del primer anillo (nivel 1) — semilla del BFS radial
const RING_STEP = 100; // incremento de radio por cada nivel de anillo más profundo
const RING_GAP = 16; // separación mínima entre nodos contiguos de un mismo anillo
const START_ANGLE = -Math.PI / 2; // primer hijo arriba (-90°), reparto uniforme 2π/n

// --- Relajación por fuerzas (determinista, sin randomness) ---
// El BFS radial da la posición INICIAL; encima corre una relajación tipo
// force-directed hecha a mano (sin d3/deps por el CSP estricto) que separa
// nodos que se solapan: repulsión de colisión entre todo par a < MIN_SEP, más
// atracción de resorte por edge hacia SPRING_LEN. El root queda fijo (pin) en el
// centro de su celda y todo nodo se acota (clamp) a los límites de la celda, de
// modo que los componentes nunca se pisan entre sí. Iteraciones y orden fijos ⇒
// resultado idéntico en cada llamada (testeable, puro).
const FORCE_ITERATIONS = 140; // pasos de relajación (fijo, sin condición de corte no determinista)
const SPRING_LEN = 2 * NODE_RADIUS + RING_GAP; // largo de reposo del resorte por edge
const MIN_SEP = 2 * NODE_RADIUS + RING_GAP; // distancia por debajo de la cual dos nodos se repelen
const REPULSION_K = 0.85; // rigidez de la repulsión de colisión
const SPRING_K = 0.08; // rigidez de la atracción por edge
const MAX_STEP = NODE_RADIUS; // desplazamiento máximo por nodo por iteración (estabilidad)

function byIndex(indexOf: Map<string, number>) {
  return (a: string, b: string) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0);
}

interface XY {
  x: number;
  y: number;
}

interface CellBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Relajación force-directed determinista sobre una celda: parte de `init`,
 * repele pares a menos de MIN_SEP, atrae por edge hacia SPRING_LEN, mantiene el
 * `root` fijo y acota cada nodo a `bounds`. `ids` en orden estable (para
 * determinismo del tie-break degenerado). Devuelve un Map nuevo con las
 * posiciones relajadas. Puro: sin Math.random/Date.now, iteraciones fijas.
 */
function relaxComponent(
  ids: string[],
  root: string,
  init: Map<string, XY>,
  edges: Array<[string, string]>,
  bounds: CellBounds,
): Map<string, XY> {
  const pos = new Map<string, XY>(ids.map((id) => [id, { ...init.get(id)! }]));
  if (ids.length <= 1) return pos;

  for (let iter = 0; iter < FORCE_ITERATIONS; iter++) {
    const cool = 1 - iter / FORCE_ITERATIONS; // enfriamiento lineal: pasos cada vez menores
    const disp = new Map<string, XY>(ids.map((id) => [id, { x: 0, y: 0 }]));

    // Repulsión de colisión: sólo entre pares más cercanos que MIN_SEP.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i]!)!;
        const b = pos.get(ids[j]!)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          // Coincidencia exacta: separar por orden estable (determinista, sin random).
          dx = i - j;
          dy = 0;
          d = Math.abs(dx) || 1e-6;
        }
        if (d < MIN_SEP) {
          const f = (REPULSION_K * (MIN_SEP - d)) / d;
          const fx = dx * f;
          const fy = dy * f;
          const da = disp.get(ids[i]!)!;
          const db = disp.get(ids[j]!)!;
          da.x += fx;
          da.y += fy;
          db.x -= fx;
          db.y -= fy;
        }
      }
    }

    // Atracción de resorte por edge hacia el largo de reposo SPRING_LEN.
    for (const [u, v] of edges) {
      const a = pos.get(u)!;
      const b = pos.get(v)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const f = (SPRING_K * (d - SPRING_LEN)) / d;
      const fx = dx * f;
      const fy = dy * f;
      const du = disp.get(u)!;
      const dv = disp.get(v)!;
      du.x += fx;
      du.y += fy;
      dv.x -= fx;
      dv.y -= fy;
    }

    // Aplicar desplazamientos: root fijo, paso acotado, clamp a la celda.
    for (const id of ids) {
      if (id === root) continue;
      const d = disp.get(id)!;
      let mx = d.x * cool;
      let my = d.y * cool;
      const m = Math.hypot(mx, my);
      if (m > MAX_STEP) {
        mx = (mx / m) * MAX_STEP;
        my = (my / m) * MAX_STEP;
      }
      const p = pos.get(id)!;
      p.x = Math.min(bounds.maxX, Math.max(bounds.minX, p.x + mx));
      p.y = Math.min(bounds.maxY, Math.max(bounds.minY, p.y + my));
    }
  }

  return pos;
}

/**
 * Posiciona cada entidad del grafo con un layout radial por componente conexo:
 * el root de cada componente (sin edges entrantes; tie-break por orden en
 * `graph.nodes`) al centro de su celda, los descendientes en anillos por BFS
 * como posición inicial, y luego una relajación por fuerzas determinista
 * (repulsión de colisión + resortes por edge, root fijo, clamp a la celda) que
 * separa los nodos que se solapan. Los componentes se empacan en un grid sin
 * pisarse. `width` es constante (720) y `height` crece con la cantidad de filas.
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
  // El radio útil descuenta medio gutter por lado, dejando un pasillo de CELL_GAP
  // entre columnas contiguas (los componentes no se pegan al borde compartido).
  const maxCellRadius = Math.max(NODE_RADIUS, cellW / 2 - NODE_RADIUS - CELL_PAD - CELL_GAP / 2);

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
  // Filas separadas por un gutter CELL_GAP (sin gutter sobrante al final).
  const rowTops: number[] = [];
  let acc = 0;
  for (const h of rowHeights) {
    rowTops.push(acc);
    acc += h + CELL_GAP;
  }
  const height = rowHeights.length > 0 ? acc - CELL_GAP : MIN_CELL_HEIGHT;

  // (7) Posición INICIAL radial (root al centro de su celda, cada anillo repartido
  //     uniforme desde -π/2) + (8) relajación por fuerzas acotada a la celda, con el
  //     root fijo. Escribir las posiciones relajadas absolutas en `positions`.
  placed.forEach((p, idx) => {
    const comp = components[idx]!;
    const row = Math.floor(idx / columns);
    const col = idx % columns;
    const cx = col * cellW + cellW / 2;
    const cy = rowTops[row]! + rowHeights[row]! / 2;

    const init = new Map<string, XY>();
    for (const [lvl, ids] of p.byLevel) {
      if (lvl === 0) {
        init.set(p.root, { x: cx, y: cy });
        continue;
      }
      const radius = p.radiusOf.get(lvl) ?? maxCellRadius;
      ids.forEach((id, i) => {
        const angle = START_ANGLE + (2 * Math.PI * i) / ids.length;
        init.set(id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      });
    }

    // Edges no dirigidos únicos del componente (para los resortes), en orden estable.
    const edgePairs: Array<[string, string]> = [];
    for (const id of comp) {
      for (const nb of [...(adj.get(id) ?? [])].sort(cmp)) {
        if ((indexOf.get(id) ?? 0) < (indexOf.get(nb) ?? 0)) edgePairs.push([id, nb]);
      }
    }

    // Celda: acota los nodos (menos el root) para que los componentes no se pisen.
    // Se insetea medio gutter por lado ⇒ pasillo de CELL_GAP entre celdas vecinas.
    const inset = NODE_RADIUS + CELL_GAP / 2;
    const bounds: CellBounds = {
      minX: col * cellW + inset,
      maxX: (col + 1) * cellW - inset,
      minY: rowTops[row]! + NODE_RADIUS,
      maxY: rowTops[row]! + rowHeights[row]! - NODE_RADIUS,
    };

    const relaxed = relaxComponent(comp, p.root, init, edgePairs, bounds);
    for (const id of comp) positions.set(id, relaxed.get(id)!);
  });

  return { width: GRAPH_WIDTH, height, positions };
}
