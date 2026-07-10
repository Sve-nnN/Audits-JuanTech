import type { EntityGraph } from "@auditor/checks";
import { GRAPH_WIDTH, MIN_CELL_HEIGHT, NODE_RADIUS, layoutEntityGraph } from "./entityGraphLayout";
import styles from "./EntityGraphSvg.module.css";

interface EntityGraphSvgProps {
  graph: EntityGraph;
}

/**
 * @type → clase de color token-backed. La clase setea `color` a un token
 * semántico y el círculo del nodo usa `fill: currentColor` (DS-01, sin hex).
 */
const TYPE_CLASS: Record<string, string | undefined> = {
  Organization: styles.typeAccent,
  ProfessionalService: styles.typeAccent,
  Product: styles.typeAccent,
  Person: styles.typePerson,
  WebSite: styles.typeSecondary,
  WebPage: styles.typeSecondary,
  FAQPage: styles.typeSuccess,
  Article: styles.typeWarning,
  BlogPosting: styles.typeWarning,
  BreadcrumbList: styles.typeMuted,
  External: styles.typeMuted,
};

function classForType(type: string): string {
  return TYPE_CLASS[type] ?? styles.typeMuted!;
}

function truncate(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Self-contained SVG entity-graph renderer (no external libs / CDN — the
 * deploy has a strict CSP). El layout es un **radial por componente conexo**
 * (root de cada componente al centro, hijos en anillos por BFS + relajación por
 * fuerzas determinista que separa nodos solapados, componentes empacados sin
 * pisarse), calculado en el módulo puro determinista `layoutEntityGraph`; este
 * componente sólo renderiza sus posiciones.
 */
export function EntityGraphSvg({ graph }: EntityGraphSvgProps) {
  const { nodes, edges } = graph;

  if (nodes.length === 0) {
    // Canvas vacío: reusa las dimensiones del módulo puro (que devuelve
    // GRAPH_WIDTH × MIN_CELL_HEIGHT para nodes.length === 0) en vez de valores
    // hardcodeados, para no divergir de la única fuente de verdad.
    return (
      <svg className={styles.canvas} width={GRAPH_WIDTH} height={MIN_CELL_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${MIN_CELL_HEIGHT}`} role="img" aria-label="Sin grafo de entidades">
        <text className={styles.emptyText} x={GRAPH_WIDTH / 2} y={MIN_CELL_HEIGHT / 2} textAnchor="middle" fontSize={14}>
          Sin datos estructurados en esta página.
        </text>
      </svg>
    );
  }

  const { width, height, positions } = layoutEntityGraph(graph);

  return (
    <svg className={styles.canvas} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafo de entidades">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path className={styles.arrow} d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>

      {edges.map((edge, i) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        // Salta self-loops igual que el modulo (los filtra de la adyacencia): sin
        // este guard el renderer dibuja una linea de longitud cero mas un chip y
        // label encimados sobre el nodo, con un marker de flecha degenerado.
        if (!from || !to || edge.from === edge.to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        return (
          <g key={`edge-${i}`}>
            <line
              className={styles.edgeLine}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            <rect className={styles.edgeChip} x={midX - edge.rel.length * 3} y={midY - 8} width={edge.rel.length * 6} height={14} opacity={0.85} />
            <text className={styles.edgeLabel} x={midX} y={midY + 3} textAnchor="middle" fontSize={9}>
              {edge.rel}
            </text>
          </g>
        );
      })}

      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return (
          <g key={node.id} className={classForType(node.type)}>
            <circle className={styles.nodeCircle} cx={pos.x} cy={pos.y} r={NODE_RADIUS} opacity={0.9} />
            <text
              className={styles.nodeType}
              x={pos.x}
              y={pos.y - 4}
              textAnchor="middle"
              fontSize={10}
            >
              {node.type}
            </text>
            <text className={styles.nodeCaption} x={pos.x} y={pos.y + NODE_RADIUS + 14} textAnchor="middle" fontSize={10}>
              {truncate(node.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
