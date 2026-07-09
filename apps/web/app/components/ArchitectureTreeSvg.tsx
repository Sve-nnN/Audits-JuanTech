import type { ReportArchitecture, ArchNode, PageTemplate } from "@auditor/report-model";
import { TEMPLATE_LABEL } from "./ui/labels";
import styles from "./ArchitectureTreeSvg.module.css";

interface ArchitectureTreeSvgProps {
  architecture: ReportArchitecture;
}

/** Orden fijo de los buckets de profundidad (una fila por nivel). */
const DEPTH_ORDER = ["0", "1", "2", "3+"] as const;

/** Máximo de nodos dibujados por fila; el resto se resume con "+N más". */
const MAX_NODES_PER_ROW = 12;

/* Geometría estática (sin motor de layout en cliente — CSP estricta). */
const PAD = 16;
const NODE_W = 148;
const NODE_H = 76;
const GAP_X = 14;
const GAP_Y = 30;
const ROW_LABEL_H = 22;
const MORE_W = 74;

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

function truncate(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

interface Row {
  label: string;
  nodes: ArchNode[];
  isOrphanRow: boolean;
}

/**
 * Árbol de arquitectura del sitio, auto-contenido en SVG (sin librerías
 * externas ni CDN — la deploy tiene CSP estricta). Agrupa los nodos del grafo
 * persistido (Plan 20-02) por profundidad de clics (0/1/2/3+) más una fila de
 * páginas huérfanas, con layout determinista (sin motor de layout en cliente).
 */
export function ArchitectureTreeSvg({ architecture }: ArchitectureTreeSvgProps) {
  const { nodesByDepth, orphans } = architecture;

  const rows: Row[] = DEPTH_ORDER.map((key) => ({
    label: `Profundidad ${key}`,
    nodes: nodesByDepth[key] ?? [],
    isOrphanRow: false,
  }));
  if (orphans.length > 0) {
    rows.push({ label: "Huérfanas", nodes: orphans, isOrphanRow: true });
  }

  const totalNodes = rows.reduce((sum, row) => sum + row.nodes.length, 0);

  if (totalNodes === 0) {
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

  const maxCols = Math.max(
    1,
    ...rows.map((row) => Math.min(row.nodes.length, MAX_NODES_PER_ROW))
  );
  const anyTruncated = rows.some((row) => row.nodes.length > MAX_NODES_PER_ROW);

  const contentW = maxCols * NODE_W + (maxCols - 1) * GAP_X;
  const width = PAD * 2 + contentW + (anyTruncated ? MORE_W : 0);
  const rowBlockH = ROW_LABEL_H + NODE_H;
  const height = PAD * 2 + rows.length * rowBlockH + (rows.length - 1) * GAP_Y;

  return (
    <svg
      className={styles.canvas}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Árbol de arquitectura del sitio por profundidad de clics"
    >
      {rows.map((row, r) => {
        const rowTop = PAD + r * (rowBlockH + GAP_Y);
        const cardTop = rowTop + ROW_LABEL_H;
        const visible = row.nodes.slice(0, MAX_NODES_PER_ROW);
        const hidden = row.nodes.length - visible.length;

        return (
          <g key={row.label}>
            <text className={styles.rowLabel} x={PAD} y={rowTop + 15} fontSize={13}>
              {row.label} · {row.nodes.length}
            </text>

            {row.nodes.length === 0 ? (
              <text
                className={styles.placeholderText}
                x={PAD}
                y={cardTop + NODE_H / 2}
                fontSize={12}
              >
                Sin páginas en este nivel.
              </text>
            ) : (
              visible.map((node, c) => {
                const x = PAD + c * (NODE_W + GAP_X);
                const right = x + NODE_W;
                const label = node.title ?? node.url;
                return (
                  <g key={`${row.label}-${node.url}-${c}`}>
                    <rect
                      className={styles.cardBg}
                      x={x}
                      y={cardTop}
                      width={NODE_W}
                      height={NODE_H}
                      rx={6}
                    />
                    <rect
                      className={classForTemplate(node.template)}
                      x={x}
                      y={cardTop}
                      width={5}
                      height={NODE_H}
                    />
                    <text className={styles.cardTitle} x={x + 14} y={cardTop + 20} fontSize={11}>
                      {truncate(label, 22)}
                    </text>
                    <text
                      className={styles.cardTemplate}
                      x={x + 14}
                      y={cardTop + 36}
                      fontSize={9}
                    >
                      {TEMPLATE_LABEL[node.template]}
                    </text>

                    {/* Indicador de profundidad / huérfana */}
                    <rect
                      className={styles.depthBadge}
                      x={x + 12}
                      y={cardTop + 46}
                      width={node.isOrphan ? 62 : 58}
                      height={18}
                      rx={9}
                    />
                    <text
                      className={styles.depthText}
                      x={x + 41}
                      y={cardTop + 59}
                      textAnchor="middle"
                      fontSize={9}
                    >
                      {node.isOrphan ? "sin ruta" : `${node.depth} clic(s)`}
                    </text>

                    {/* Indicador huérfana */}
                    {node.isOrphan && (
                      <text
                        className={styles.orphanMark}
                        x={right - 10}
                        y={cardTop + 60}
                        textAnchor="end"
                        fontSize={8}
                      >
                        huérfana
                      </text>
                    )}

                    {/* Indicador de más de 3 clics */}
                    {node.isDeep && (
                      <text
                        className={styles.deepMark}
                        x={right - 10}
                        y={cardTop + 16}
                        textAnchor="end"
                        fontSize={8}
                      >
                        +3 clics
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {hidden > 0 && (
              <text
                className={styles.moreText}
                x={PAD + visible.length * (NODE_W + GAP_X) + 4}
                y={cardTop + NODE_H / 2}
                fontSize={11}
              >
                +{hidden} más
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
