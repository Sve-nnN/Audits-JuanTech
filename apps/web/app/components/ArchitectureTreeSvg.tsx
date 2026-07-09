import type {
  ReportArchitecture,
  ArchNode,
  ArchTreeNode,
  PageTemplate,
} from "@auditor/report-model";
import { TEMPLATE_LABEL } from "./ui/labels";
import styles from "./ArchitectureTreeSvg.module.css";

interface ArchitectureTreeSvgProps {
  architecture: ReportArchitecture;
}

/**
 * Cap por rama: si un nodo tiene más de este número de hijos, se dibujan los
 * primeros N y un nodo-resumen "+K más" como hijo adicional VISIBLE (nunca un
 * truncado silencioso, T-22-04). Alineado con el antiguo MAX_NODES_PER_ROW=12.
 */
const MAX_CHILDREN_PER_NODE = 12;

/** Cap de la banda de huérfanas (se muestran en grilla, con "+N más"). */
const MAX_ORPHANS = 24;

/* Geometría estática (sin motor de layout en cliente — CSP estricta). */
const PAD = 20;
const NODE_W = 176;
const NODE_H = 84;
const GAP_X = 26;
const GAP_Y = 48;
const ORPHAN_LABEL_H = 26;
const SECTION_GAP = 40;

/**
 * @template → clase de color token-backed. La clase setea `color` a un token
 * semántico y la franja de la tarjeta usa `fill: currentColor` (DS-01, sin hex).
 */
const TEMPLATE_CLASS: Record<PageTemplate, string | undefined> = {
  home: styles.tplHome,
  category: styles.tplCategory,
  product: styles.tplProduct,
  article: styles.tplArticle,
  other: styles.tplOther,
};

function classForTemplate(template: PageTemplate): string {
  return TEMPLATE_CLASS[template] ?? styles.tplOther!;
}

function truncate(label: string, max = 26): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** Nodo posicionado del dendrograma (x en unidades de hoja, level = fila). */
interface Placed {
  key: string;
  node: ArchNode;
  level: number;
  x: number;
}

/** Nodo-resumen "+K más" (hijo virtual de una rama capada). */
interface PlacedMore {
  key: string;
  moreCount: number;
  level: number;
  x: number;
}

/** Conector padre→hijo, en unidades de hoja/nivel (se convierte a px al render). */
interface Edge {
  key: string;
  px: number;
  pLevel: number;
  cx: number;
  cLevel: number;
}

/** Centro X (px) de una columna de hoja. */
function colCenterX(x: number): number {
  return PAD + x * (NODE_W + GAP_X) + NODE_W / 2;
}

/** Y (px) del borde superior de una tarjeta en el nivel dado. */
function levelTop(level: number): number {
  return PAD + level * (NODE_H + GAP_Y);
}

/**
 * Árbol de arquitectura del sitio, auto-contenido en SVG (sin librerías
 * externas ni CDN — la deploy tiene CSP estricta). Reescrito en Plan 22-02 como
 * un DENDROGRAMA top-down estilo Octopus.do: consume el árbol anidado real
 * (`architecture.tree`, ArchTreeNode reconstruido en Plan 22-01) y dibuja la
 * raíz (home) arriba, los niveles hacia abajo, con conectores SVG visibles de
 * cada padre a cada hijo. Layout determinista en dos pasadas puras (sin estado
 * de cliente): un contador de hojas fija la X de las hojas y la X de cada nodo
 * interno es el promedio de las X de sus hijos (reingold-tilford simplificado).
 * Cada nodo conserva sus señales v1.3 (profundidad, huérfana, +3 clics, color
 * por plantilla). Las huérfanas van en una banda aparte bajo el árbol.
 */
export function ArchitectureTreeSvg({ architecture }: ArchitectureTreeSvgProps) {
  const { tree, orphans } = architecture;

  // ---- Pasada 1: posicionar nodos y registrar conectores ----
  const placed: Placed[] = [];
  const placedMore: PlacedMore[] = [];
  const edges: Edge[] = [];
  let leafCursor = 0;

  function layout(node: ArchTreeNode, level: number, key: string): number {
    const visibleChildren = node.children.slice(0, MAX_CHILDREN_PER_NODE);
    const hidden = node.children.length - visibleChildren.length;
    const hasChildren = visibleChildren.length > 0 || hidden > 0;

    if (!hasChildren) {
      const x = leafCursor++;
      placed.push({ key, node, level, x });
      return x;
    }

    const childXs: number[] = [];
    visibleChildren.forEach((child, i) => {
      childXs.push(layout(child, level + 1, `${key}.${i}`));
    });
    if (hidden > 0) {
      const x = leafCursor++;
      placedMore.push({ key: `${key}.more`, moreCount: hidden, level: level + 1, x });
      childXs.push(x);
    }

    const centerX = childXs.reduce((sum, v) => sum + v, 0) / childXs.length;
    placed.push({ key, node, level, x: centerX });
    childXs.forEach((cx, i) => {
      edges.push({ key: `${key}.e${i}`, px: centerX, pLevel: level, cx, cLevel: level + 1 });
    });
    return centerX;
  }

  tree.forEach((root, i) => layout(root, 0, `r${i}`));

  const treeLeaves = leafCursor;
  const treeMaxLevel = Math.max(
    0,
    ...placed.map((p) => p.level),
    ...placedMore.map((p) => p.level)
  );

  // ---- Banda de huérfanas (grilla, sin conectores) ----
  const visibleOrphans = orphans.slice(0, MAX_ORPHANS);
  const hiddenOrphans = orphans.length - visibleOrphans.length;
  const hasOrphans = orphans.length > 0;
  const orphanCols =
    treeLeaves > 0 ? treeLeaves : Math.max(1, Math.min(visibleOrphans.length, 8));
  const orphanRows = hasOrphans ? Math.ceil(visibleOrphans.length / orphanCols) : 0;

  // ---- Estado vacío (sin árbol ni huérfanas) ----
  if (treeLeaves === 0 && !hasOrphans) {
    return (
      <svg
        className={styles.canvas}
        width={480}
        height={120}
        viewBox="0 0 480 120"
        role="img"
        aria-label="Sin arquitectura del sitio"
      >
        <text className={styles.emptyText} x={240} y={60} textAnchor="middle" fontSize={14}>
          Sin datos de arquitectura para este sitio.
        </text>
      </svg>
    );
  }

  // ---- Dimensiones del lienzo (ancho dinámico por hojas, alto por profundidad) ----
  const cols = Math.max(1, treeLeaves, hasOrphans ? orphanCols : 1);
  const contentW = cols * NODE_W + (cols - 1) * GAP_X;
  const width = PAD * 2 + contentW;

  const treeBlockH =
    treeLeaves > 0 ? (treeMaxLevel + 1) * NODE_H + treeMaxLevel * GAP_Y : 0;
  const sectionGap = treeLeaves > 0 && hasOrphans ? SECTION_GAP : 0;
  const orphanBandH = hasOrphans
    ? ORPHAN_LABEL_H + orphanRows * NODE_H + (orphanRows - 1) * GAP_Y
    : 0;
  const height = PAD * 2 + treeBlockH + sectionGap + orphanBandH;

  const orphanBandTop = PAD + treeBlockH + sectionGap;

  return (
    <svg
      className={styles.canvas}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Árbol de arquitectura del sitio (jerarquía padre-hijo)"
    >
      {/* Conectores primero (los nodos se dibujan encima) */}
      {edges.map((edge) => {
        const x1 = colCenterX(edge.px);
        const y1 = levelTop(edge.pLevel) + NODE_H;
        const x2 = colCenterX(edge.cx);
        const y2 = levelTop(edge.cLevel);
        const midY = (y1 + y2) / 2;
        return (
          <path
            key={edge.key}
            className={styles.connector}
            d={`M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`}
          />
        );
      })}

      {/* Tarjetas de nodo del árbol */}
      {placed.map((p) => nodeCard(p.key, colCenterX(p.x) - NODE_W / 2, levelTop(p.level), p.node))}

      {/* Nodos-resumen "+K más" */}
      {placedMore.map((p) =>
        moreCard(p.key, colCenterX(p.x) - NODE_W / 2, levelTop(p.level), p.moreCount)
      )}

      {/* Banda de huérfanas */}
      {hasOrphans && (
        <g>
          <text
            className={styles.rowLabel}
            x={PAD}
            y={orphanBandTop + 16}
            fontSize={14}
          >
            Huérfanas (sin ruta desde la home) · {orphans.length}
          </text>
          {visibleOrphans.map((node, i) => {
            const col = i % orphanCols;
            const row = Math.floor(i / orphanCols);
            const left = PAD + col * (NODE_W + GAP_X);
            const top = orphanBandTop + ORPHAN_LABEL_H + row * (NODE_H + GAP_Y);
            return nodeCard(`orphan-${i}`, left, top, node);
          })}
          {hiddenOrphans > 0 && (
            <text
              className={styles.moreText}
              x={PAD}
              y={orphanBandTop + ORPHAN_LABEL_H + orphanRows * (NODE_H + GAP_Y) - GAP_Y + NODE_H / 2}
              fontSize={12}
            >
              +{hiddenOrphans} más
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/** Tarjeta de nodo con todas las señales v1.3 (color plantilla, clics, huérfana, +3). */
function nodeCard(key: string, left: number, top: number, node: ArchNode) {
  const right = left + NODE_W;
  const label = node.title ?? node.url;
  return (
    <g key={key}>
      <rect className={styles.cardBg} x={left} y={top} width={NODE_W} height={NODE_H} rx={7} />
      <rect className={classForTemplate(node.template)} x={left} y={top} width={6} height={NODE_H} />
      <text className={styles.cardTitle} x={left + 16} y={top + 24} fontSize={12}>
        {truncate(label, 26)}
      </text>
      <text className={styles.cardTemplate} x={left + 16} y={top + 42} fontSize={10}>
        {TEMPLATE_LABEL[node.template]}
      </text>

      {/* Insignia de profundidad / sin ruta */}
      <rect
        className={styles.depthBadge}
        x={left + 14}
        y={top + 54}
        width={node.isOrphan ? 66 : 66}
        height={20}
        rx={10}
      />
      <text
        className={styles.depthText}
        x={left + 47}
        y={top + 68}
        textAnchor="middle"
        fontSize={10}
      >
        {node.isOrphan ? "sin ruta" : `${node.depth} clic(s)`}
      </text>

      {/* Indicador huérfana */}
      {node.isOrphan && (
        <text
          className={styles.orphanMark}
          x={right - 12}
          y={top + 68}
          textAnchor="end"
          fontSize={9}
        >
          huérfana
        </text>
      )}

      {/* Indicador de más de 3 clics */}
      {node.isDeep && (
        <text
          className={styles.deepMark}
          x={right - 12}
          y={top + 20}
          textAnchor="end"
          fontSize={9}
        >
          +3 clics
        </text>
      )}
    </g>
  );
}

/** Nodo-resumen visible "+K más" para ramas capadas (T-22-04, sin truncado silencioso). */
function moreCard(key: string, left: number, top: number, count: number) {
  return (
    <g key={key}>
      <rect
        className={styles.moreCardBg}
        x={left}
        y={top}
        width={NODE_W}
        height={NODE_H}
        rx={7}
      />
      <text
        className={styles.moreText}
        x={left + NODE_W / 2}
        y={top + NODE_H / 2 + 4}
        textAnchor="middle"
        fontSize={13}
      >
        +{count} más
      </text>
    </g>
  );
}
