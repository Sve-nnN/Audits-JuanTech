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
// Cada componente conexo se dibuja como una BANDA de ancho completo apilada
// verticalmente: el root al centro y los relacionados en anillos concéntricos por
// nivel de profundidad (BFS), con espaciado angular UNIFORME (2π/n) y radio
// generoso — sin simulación de fuerzas. Los componentes distintos quedan
// claramente separados por el gap vertical entre bandas.
export const GRAPH_WIDTH = 720; // ancho del viewBox; conserva la escala responsive de .canvas
export const NODE_RADIUS = 22; // radio del círculo de nodo (compartido con el renderer)
export const ROOT_RADIUS = 28; // el root se destaca un poco más grande (compartido con el renderer)
export const MIN_CELL_HEIGHT = 160; // piso de alto por banda / canvas vacío (compartido)

const RING_BASE = 150; // radio del primer anillo (nivel 1) — generoso para que entren las etiquetas
const RING_STEP = 120; // incremento de radio por cada nivel de profundidad más
const NODE_SLOT = 104; // arco mínimo por nodo en un anillo (para que no se pisen ni sus etiquetas)
const LABEL_MARGIN = 155; // margen horizontal reservado para las etiquetas que radian hacia afuera (evita recorte en el borde)
const LABEL_BAND = 46; // alto reservado para la etiqueta (tipo + caption) al dimensionar la banda
const BAND_GAP = 72; // separación vertical entre bandas de componentes distintos
const START_ANGLE = -Math.PI / 2; // primer nodo del anillo arriba (-90°)

function byIndex(indexOf: Map<string, number>) {
  return (a: string, b: string) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0);
}

/**
 * Posiciona cada entidad con un layout radial estilo Classy Schema: el root de
 * cada componente conexo (sin edges entrantes; tie-break por orden en
 * `graph.nodes`) al centro de su banda, los relacionados en anillos concéntricos
 * por nivel BFS con ángulos uniformes y radio generoso (sin fuerzas). Los
 * componentes se apilan en bandas de ancho completo separadas verticalmente.
 * `width` es constante (720) y `height` crece con la cantidad de componentes.
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

  const maxUsableRadius = GRAPH_WIDTH / 2 - LABEL_MARGIN;

  interface Band {
    root: string;
    byLevel: Map<number, string[]>;
    radiusOf: Map<number, number>;
    bandHeight: number;
  }

  // (4)+(5) Root por componente + niveles BFS + radio por anillo (uniforme, generoso).
  const bands: Band[] = components.map((comp) => {
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

    // Radio por anillo: base creciente por nivel, pero lo bastante grande para que
    // los N nodos del anillo tengan al menos NODE_SLOT de arco entre sí (sin
    // solaparse ni pisar etiquetas). Acotado al radio útil del canvas.
    const radiusOf = new Map<number, number>();
    let outerRadius = 0;
    for (const [lvl, ids] of byLevel) {
      if (lvl === 0) continue;
      const base = RING_BASE + (lvl - 1) * RING_STEP;
      const minForCount = ids.length > 1 ? (ids.length * NODE_SLOT) / (2 * Math.PI) : 0;
      const r = Math.min(Math.max(base, minForCount), maxUsableRadius);
      radiusOf.set(lvl, r);
      outerRadius = Math.max(outerRadius, r);
    }

    const bandHeight = Math.max(MIN_CELL_HEIGHT, 2 * (outerRadius + ROOT_RADIUS + LABEL_BAND));
    return { root, byLevel, radiusOf, bandHeight };
  });

  // Bandas apiladas verticalmente, separadas por BAND_GAP.
  const bandTops: number[] = [];
  let acc = 0;
  for (const b of bands) {
    bandTops.push(acc);
    acc += b.bandHeight + BAND_GAP;
  }
  const height = bands.length > 0 ? acc - BAND_GAP : MIN_CELL_HEIGHT;

  // (6) Escribir posiciones absolutas: root al centro de su banda, cada anillo
  //     repartido uniforme desde -π/2. Guardar el ángulo para radiar la etiqueta.
  const cx = GRAPH_WIDTH / 2;
  bands.forEach((b, idx) => {
    const cy = bandTops[idx]! + b.bandHeight / 2;
    for (const [lvl, ids] of b.byLevel) {
      if (lvl === 0) {
        positions.set(b.root, { x: cx, y: cy, angle: 0, isRoot: true });
        continue;
      }
      const radius = b.radiusOf.get(lvl) ?? RING_BASE;
      ids.forEach((id, i) => {
        const angle = START_ANGLE + (2 * Math.PI * i) / ids.length;
        positions.set(id, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          angle,
          isRoot: false,
        });
      });
    }
  });

  return { width: GRAPH_WIDTH, height, positions };
}
