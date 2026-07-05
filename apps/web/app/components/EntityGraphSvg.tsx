import type { EntityGraph } from "@auditor/checks";

interface EntityGraphSvgProps {
  graph: EntityGraph;
}

const WIDTH = 720;
const HEIGHT = 480;
const RADIUS = 170;
const NODE_RADIUS = 34;

const TYPE_COLORS: Record<string, string> = {
  Organization: "#2563eb",
  Person: "#7c3aed",
  WebSite: "#0891b2",
  WebPage: "#0891b2",
  FAQPage: "#16a34a",
  Article: "#ea580c",
  BlogPosting: "#ea580c",
  ProfessionalService: "#db2777",
  Product: "#ca8a04",
  BreadcrumbList: "#64748b",
  External: "#94a3b8",
};

function colorForType(type: string): string {
  return TYPE_COLORS[type] ?? "#475569";
}

function truncate(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Self-contained SVG entity-graph renderer (no external libs / CDN — the
 * deploy has a strict CSP). Places nodes on a circle (deterministic, no
 * client-side layout engine needed) and draws labeled edges between them.
 */
export function EntityGraphSvg({ graph }: EntityGraphSvgProps) {
  const { nodes, edges } = graph;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: cx + RADIUS * Math.cos(angle),
      y: cy + RADIUS * Math.sin(angle),
    });
  });

  if (nodes.length === 0) {
    return (
      <svg width={WIDTH} height={120} viewBox={`0 0 ${WIDTH} 120`} role="img" aria-label="Sin grafo de entidades">
        <text x={WIDTH / 2} y={60} textAnchor="middle" fill="#64748b" fontFamily="system-ui, sans-serif" fontSize={14}>
          Sin datos estructurados en esta página.
        </text>
      </svg>
    );
  }

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Grafo de entidades">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>

      {edges.map((edge, i) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        return (
          <g key={`edge-${i}`}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#cbd5e1"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            <rect x={midX - edge.rel.length * 3} y={midY - 8} width={edge.rel.length * 6} height={14} fill="white" opacity={0.85} />
            <text x={midX} y={midY + 3} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={9} fill="#64748b">
              {edge.rel}
            </text>
          </g>
        );
      })}

      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return (
          <g key={node.id}>
            <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={colorForType(node.type)} opacity={0.9} />
            <text
              x={pos.x}
              y={pos.y - 4}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize={10}
              fontWeight={600}
              fill="white"
            >
              {node.type}
            </text>
            <text x={pos.x} y={pos.y + 44} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={10} fill="#1e293b">
              {truncate(node.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
