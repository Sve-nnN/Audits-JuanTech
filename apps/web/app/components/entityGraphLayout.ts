import type { EntityGraph } from "@auditor/checks";

/**
 * Posición de un nodo en el canvas: coordenadas absolutas (px del viewBox), el
 * ángulo radial desde el centro de su componente (para radiar la etiqueta hacia
 * afuera) y si es el root del componente (va al centro, etiqueta centrada).
 */
export interface EntityNodePosition {
  x: number;
  y: number;
  angle: number; // radianes; dirección desde el centro del componente (0 para el root)
  isRoot: boolean;
}

/**
 * Resultado del layout: dimensiones del viewBox + posiciones por `node.id`.
 * Módulo PURO y determinista (sin dependencias de UI/DOM ni fuentes de
 * no-determinismo) para ser testeable en node y reusable por el renderer.
 */
export interface EntityGraphLayout {
  width: number;
  height: number;
  positions: Map<string, EntityNodePosition>;
}

// --- Geometría estilo "Classy Schema" (Claude's Discretion, ver 23-CONTEXT) ---
// Cada componente conexo se dibuja como una BANDA apilada verticalmente. Es un
// ÁRBOL RADIAL: el root al centro, y cada nodo a un radio que crece
// (estrictamente) con su profundidad BFS y a un ángulo dentro del sector que le
// asigna su padre (repartido entre hermanos por peso de subárbol). Una estrella
// (root + hijos directos) queda como un anillo uniforme; una cadena profunda
// RADIA hacia afuera en vez de apilarse en el mismo punto. El ancho del viewBox
// crece para grafos densos/anchos (se escala responsivamente vía .canvas) en vez
// de encimar nodos; para grafos normales queda en 720 (BASE_WIDTH).
export const GRAPH_WIDTH = 720; // ancho base del viewBox (grafos normales); crece si el grafo lo necesita
export const NODE_RADIUS = 22; // radio del círculo de nodo (compartido con el renderer)
export const ROOT_RADIUS = 28; // el root se destaca un poco más grande (compartido con el renderer)
export const MIN_CELL_HEIGHT = 160; // piso de alto por banda / canvas vacío (compartido)

const LABEL_SAFE_R = GRAPH_WIDTH / 2 - 155; // radio hasta el cual las etiquetas entran sin recorte a ancho base
const RING_BASE = 150; // radio del primer anillo (nivel 1) — generoso para que entren las etiquetas
const RING_STEP = 120; // incremento IDEAL de radio por nivel (se comprime si hay mucha profundidad)
const NODE_SLOT = 104; // arco mínimo por nodo en un anillo (para que no se pisen ni sus etiquetas)
const MIN_RING_SEP = 2 * NODE_RADIUS + 12; // separación radial mínima entre anillos contiguos (nunca se enciman)
const LABEL_BAND = 46; // alto reservado para la etiqueta (tipo + caption) al dimensionar la banda
const BAND_GAP = 72; // separación vertical entre bandas de componentes distintos
const EDGE_PAD = NODE_RADIUS + 12; // margen del nodo más externo al borde del viewBox
const MAX_WIDTH = 1600; // techo de ancho del viewBox (grafos patológicos: se acepta algo de recorte)
const START_ANGLE = -Math.PI / 2; // el reparto angular arranca arriba (-90°)
const CHAIN_LEAN = 0.5; // desvío angular (rad) alternado en cadenas de hijo único: las hace zigzaguear en vez de colineales (etiquetas legibles)

function byIndex(indexOf: Map<string, number>) {
  return (a: string, b: string) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0);
}

/**
 * Posiciona cada entidad con un árbol radial estilo Classy Schema: el root de
 * cada componente conexo (sin edges entrantes; tie-break por orden en
 * `graph.nodes`) al centro de su banda, y cada descendiente a un radio que crece
 * estrictamente con su profundidad BFS y a un ángulo dentro del sector que le
 * asigna su padre. Los componentes se apilan en bandas separadas verticalmente.
 * `width` es 720 salvo que el grafo necesite más (denso/ancho), y `height` crece
 * con la cantidad de componentes.
 */
export function layoutEntityGraph(graph: EntityGraph): EntityGraphLayout {
  const positions = new Map<string, EntityNodePosition>();
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

  // (2) Adyacencia NO dirigida (para componentes + árbol) + incoming dirigido (root).
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

  interface Band {
    root: string;
    depthOf: Map<string, number>;
    children: Map<string, string[]>;
    radiusByDepth: number[]; // índice = profundidad (1..maxDepth)
    outerR: number;
    bandHeight: number;
  }

  // (4) Por componente: root + árbol BFS (padre/hijos) + radios por profundidad.
  const bands: Band[] = components.map((comp) => {
    const root = comp.find((id) => (incoming.get(id) ?? 0) === 0) ?? comp[0]!;

    // BFS con árbol: cada nodo tiene un padre (el que lo descubre) y una lista de
    // hijos en orden estable. Las aristas fuera del árbol (ciclos) se ignoran para
    // el layout — el árbol es acíclico por construcción.
    const depthOf = new Map<string, number>([[root, 0]]);
    const children = new Map<string, string[]>();
    for (const id of comp) children.set(id, []);
    const queue = [root];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = depthOf.get(cur)!;
      for (const nb of [...(adj.get(cur) ?? [])].sort(cmp)) {
        if (!depthOf.has(nb)) {
          depthOf.set(nb, d + 1);
          children.get(cur)!.push(nb);
          queue.push(nb);
        }
      }
    }
    // Defensa: nodos del componente no alcanzados (no debería pasar) cuelgan del root.
    for (const id of comp) {
      if (!depthOf.has(id)) {
        depthOf.set(id, 1);
        children.get(root)!.push(id);
      }
    }

    let maxDepth = 0;
    const countByDepth = new Map<number, number>();
    for (const d of depthOf.values()) {
      maxDepth = Math.max(maxDepth, d);
      if (d > 0) countByDepth.set(d, (countByDepth.get(d) ?? 0) + 1);
    }

    // Paso adaptativo: comprime el incremento por nivel para que la profundidad
    // entre en el radio "label-safe" cuando se puede, sin bajar de MIN_RING_SEP
    // (así una cadena profunda no se apila ni desborda). Los anillos densos, en
    // cambio, empujan el radio hacia afuera (y el viewBox se ensancha después).
    const step =
      maxDepth > 1
        ? Math.min(RING_STEP, Math.max(MIN_RING_SEP, (LABEL_SAFE_R - RING_BASE) / (maxDepth - 1)))
        : RING_STEP;

    const radiusByDepth: number[] = [0];
    let prev = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const count = countByDepth.get(d) ?? 1;
      const depthR = RING_BASE + (d - 1) * step;
      const countR = count > 1 ? (count * NODE_SLOT) / (2 * Math.PI) : 0;
      const r = Math.max(depthR, countR, prev + MIN_RING_SEP);
      radiusByDepth[d] = r;
      prev = r;
    }

    const outerR = maxDepth > 0 ? radiusByDepth[maxDepth]! : 0;
    const bandHeight = Math.max(MIN_CELL_HEIGHT, 2 * (outerR + ROOT_RADIUS + LABEL_BAND));
    return { root, depthOf, children, radiusByDepth, outerR, bandHeight };
  });

  // Ancho del viewBox: base 720, o lo que necesite el componente más ancho (el
  // radio externo + margen) para no encimar/desbordar — se escala responsivamente.
  let requiredHalf = GRAPH_WIDTH / 2;
  for (const b of bands) requiredHalf = Math.max(requiredHalf, b.outerR + EDGE_PAD);
  const width = Math.min(MAX_WIDTH, 2 * requiredHalf);
  const cx = width / 2;

  // Bandas apiladas verticalmente, separadas por BAND_GAP.
  const bandTops: number[] = [];
  let acc = 0;
  for (const b of bands) {
    bandTops.push(acc);
    acc += b.bandHeight + BAND_GAP;
  }
  const height = bands.length > 0 ? acc - BAND_GAP : MIN_CELL_HEIGHT;

  // (5) Peso de subárbol (cantidad de hojas) para repartir el sector angular de
  //     forma proporcional, de modo que subárboles grandes reciban más ángulo.
  const weightOf = (b: Band): Map<string, number> => {
    const weight = new Map<string, number>();
    const post = (id: string): number => {
      const kids = b.children.get(id) ?? [];
      if (kids.length === 0) {
        weight.set(id, 1);
        return 1;
      }
      let sum = 0;
      for (const k of kids) sum += post(k);
      weight.set(id, sum);
      return sum;
    };
    post(b.root);
    return weight;
  };

  // (6) Asignar ángulo por nodo (árbol radial) y escribir posiciones absolutas.
  bands.forEach((b, idx) => {
    const cy = bandTops[idx]! + b.bandHeight / 2;
    positions.set(b.root, { x: cx, y: cy, angle: 0, isRoot: true });

    const weight = weightOf(b);
    const place = (id: string, angle: number) => {
      const d = b.depthOf.get(id) ?? 1;
      const r = Math.min(b.radiusByDepth[d] ?? RING_BASE, cx - EDGE_PAD);
      positions.set(id, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        angle,
        isRoot: false,
      });
    };

    // Reparte [a0, a1) entre los hijos de `id` por peso; cada hijo va al centro de
    // su subsector y recibe ese subsector para sus propios descendientes.
    const assign = (id: string, a0: number, a1: number) => {
      const kids = b.children.get(id) ?? [];
      if (kids.length === 0) return;
      // Cadena de hijo único: en vez de dejarlo colineal con el padre (que apila
      // las etiquetas en una misma línea), se lo desvía un poco, alternando el
      // signo por profundidad, para que la cadena zigzaguee y las etiquetas se
      // separen. Conserva la celda angular completa para sus descendientes.
      if (kids.length === 1) {
        const k = kids[0]!;
        const mid = (a0 + a1) / 2;
        const lean = ((b.depthOf.get(k) ?? 0) % 2 === 0 ? 1 : -1) * CHAIN_LEAN;
        place(k, mid + lean);
        assign(k, a0, a1);
        return;
      }
      const total = kids.reduce((s, k) => s + (weight.get(k) ?? 1), 0);
      let cur = a0;
      for (const k of kids) {
        const span = (a1 - a0) * ((weight.get(k) ?? 1) / total);
        const mid = cur + span / 2;
        place(k, mid);
        assign(k, cur, cur + span);
        cur += span;
      }
    };
    assign(b.root, START_ANGLE, START_ANGLE + 2 * Math.PI);
  });

  return { width, height, positions };
}
