import type { EntityGraph } from "@auditor/checks";
import {
  GRAPH_WIDTH,
  MIN_CELL_HEIGHT,
  NODE_RADIUS,
  ROOT_RADIUS,
  layoutEntityGraph,
} from "./entityGraphLayout";
import styles from "./EntityGraphSvg.module.css";

interface EntityGraphSvgProps {
  graph: EntityGraph;
}

/**
 * @type → clase de color token-backed. La clase setea `color` a un token
 * semántico y el círculo del nodo usa `fill: currentColor` (DS-01, sin hex). El
 * color codifica el @type de la entidad de forma consistente (todas las
 * instancias de un tipo comparten color), estilo Classy Schema.
 */
const TYPE_CLASS: Record<string, string | undefined> = {
  Person: styles.typePerson,
  Organization: styles.typeAccent,
  ProfessionalService: styles.typeAccent,
  Product: styles.typeAccent,
  WebSite: styles.typeSecondary,
  WebPage: styles.typeSecondary,
  ProfilePage: styles.typeSecondary,
  CollectionPage: styles.typeSecondary,
  FAQPage: styles.typeSuccess,
  Article: styles.typeWarning,
  BlogPosting: styles.typeWarning,
  NewsArticle: styles.typeWarning,
  BreadcrumbList: styles.typeMuted,
  ListItem: styles.typeMuted,
  External: styles.typeMuted,
};

function classForType(type: string): string {
  return TYPE_CLASS[type] ?? styles.typeMuted!;
}

function truncate(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Self-contained SVG entity-graph renderer (no external libs / CDN — the deploy
 * has a strict CSP). Layout estilo **Classy Schema**: el root de cada componente
 * conexo al centro de su banda y los relacionados en anillos concéntricos por
 * nivel con ángulos uniformes (calculado en el módulo puro `layoutEntityGraph`).
 * Cada nodo es un círculo coloreado por @type con su etiqueta (tipo + título)
 * radiando hacia afuera; los componentes se apilan separados verticalmente.
 */
export function EntityGraphSvg({ graph }: EntityGraphSvgProps) {
  const { nodes, edges } = graph;

  if (nodes.length === 0) {
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
        // Salta self-loops igual que el módulo (los filtra de la adyacencia).
        if (!from || !to || edge.from === edge.to) return null;
        // La etiqueta de relación se ubica sesgada hacia el destino (no en el punto
        // medio): cuando varias aristas salen del mismo root (ej. un BreadcrumbList
        // con muchos itemListElement) los midpoints caerían todos encima del centro;
        // sesgar hacia el hijo las reparte por sus radios y despeja el centro.
        const t = 0.64;
        const midX = from.x + (to.x - from.x) * t;
        const midY = from.y + (to.y - from.y) * t;
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
        const r = pos.isRoot ? ROOT_RADIUS : NODE_RADIUS;

        // Etiqueta: el root centrada debajo; los del anillo radian hacia afuera
        // (horizontal, sin rotar) para no pisarse con los vecinos ni el centro.
        let lx: number;
        let anchor: "start" | "middle" | "end";
        let typeY: number;
        let capY: number;
        if (pos.isRoot) {
          lx = pos.x;
          anchor = "middle";
          typeY = pos.y + r + 16;
          capY = typeY + 14;
        } else {
          const off = NODE_RADIUS + 12;
          const cos = Math.cos(pos.angle);
          const sin = Math.sin(pos.angle);
          lx = pos.x + cos * off;
          const ly = pos.y + sin * off;
          anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          const vdir = sin >= 0 ? 1 : -1; // apila las dos líneas alejándose del centro
          typeY = ly;
          capY = ly + vdir * 13;
        }

        // El caption (2ª línea) sólo aporta si tiene un nombre real. Si el label es
        // sintético (igual al id, ej. "#BreadcrumbList-1", o igual al @type, ej.
        // "WebPage") es puro ruido que ensucia el centro del grafo → se omite.
        const caption = truncate(node.label);
        const showCaption = node.label !== node.id && node.label !== node.type;

        return (
          <g key={node.id} className={classForType(node.type)}>
            <circle className={styles.nodeCircle} cx={pos.x} cy={pos.y} r={r} opacity={pos.isRoot ? 1 : 0.9} />
            <text className={styles.nodeType} x={lx} y={typeY} textAnchor={anchor} fontSize={11}>
              {node.type}
            </text>
            {showCaption && (
              <text className={styles.nodeCaption} x={lx} y={capY} textAnchor={anchor} fontSize={10}>
                {caption}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
