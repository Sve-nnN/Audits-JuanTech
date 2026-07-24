import type { Confidence, ReportStack, ReportStackAxis } from "@auditor/report-model";
import { Badge, ConfidenceBadge, type BadgeVariant } from "./Badge";
import { AXIS_LABEL, CONFIDENCE_LABEL } from "./labels";
import styles from "./StackTable.module.css";

/**
 * Confianza de detección → variante de Badge (STACKUI-02 / FPRINT-08).
 *
 * `critical` (rojo) queda EXCLUIDO por contrato: la confianza no es una
 * severidad de error de auditoría. Exportado para que el test asegure el
 * mapeo y que ninguna variante emitida sea "critical".
 *
 * Solo la variante (un string) vive acá — el ícono lucide correspondiente
 * vive en Badge.tsx (Client Component). Un componente de ícono es una
 * función; este archivo es un Server Component, y React no puede serializar
 * funciones pasadas como prop hacia un Client Component (confirmado en
 * runtime: "Functions cannot be passed directly to Client Components").
 */
export const CONFIDENCE_BADGE: Record<Confidence, BadgeVariant> = {
  alto: "ok",
  medio: "warning",
  bajo: "warningSubtle",
  "no-detectado": "neutral",
};

/** Texto de la celda cuando un eje no tiene señal (no es un error, es informativo). */
const NOT_DETECTED_TEXT = "No detectado con certeza";

/** Celda de "no detectado con certeza" + Badge neutral, reutilizada por todos los ejes. */
function NotDetected() {
  return (
    <>
      <span className={styles.muted}>{NOT_DETECTED_TEXT}</span>
      <Badge variant="neutral">{CONFIDENCE_LABEL["no-detectado"]}</Badge>
    </>
  );
}

/** Chip de confianza para un value único (React escapa el texto por defecto). */
function ConfidenceValue({ value, confidence }: ReportStackAxis) {
  return (
    <>
      <span className={styles.value}>{value}</span>
      <ConfidenceBadge confidence={confidence}>{CONFIDENCE_LABEL[confidence]}</ConfidenceBadge>
    </>
  );
}

/** Fila de un eje single-value (CMS, CDN, Hosting, Framework JS). */
function AxisRow({ label, axis }: { label: string; axis: ReportStackAxis }) {
  const undetected = axis.value === null || axis.confidence === "no-detectado";
  return (
    <tr className={styles.row} role="row">
      <th scope="row" role="rowheader" className={styles.axis}>
        {label}
      </th>
      <td role="cell" className={styles.detection}>
        <div className={styles.detectionInner}>
          {undetected ? <NotDetected /> : <ConfidenceValue {...axis} />}
        </div>
      </td>
    </tr>
  );
}

/**
 * StackTable (STACKUI-01/02/03) — tabla "Stack técnico detectado" del reporte.
 *
 * Server Component estático (SIN "use client"): compone `Badge` (client) sin
 * fricción, igual que page.tsx compone Badge/DiffBadge. Tabla semántica de 2
 * columnas × 5 filas fijas (CMS, CDN / proxy, Hosting, Framework JS, Analytics);
 * ningún eje se oculta. La confianza se mapea a las 4 variantes visuales de
 * Badge (nunca `critical`) con texto + icono redundante (color nunca es señal
 * única). Responsive por colapso vertical (sin scroll horizontal). El guard de
 * render vive en page.tsx: este componente asume `stack` no nulo.
 *
 * Seguridad (T-26-05-01): todos los `value` (incluido "WordPress (Elementor)" y
 * los nombres de analytics) se pintan como texto plano en JSX — React escapa por
 * defecto. NUNCA `dangerouslySetInnerHTML`.
 */
export function StackTable({ stack }: { stack: ReportStack }) {
  return (
    <>
      <h3 className={styles.title}>Stack técnico detectado</h3>
      <div className={styles.container}>
        <table className={styles.table} role="table">
          <caption className={styles.caption}>
            Stack técnico detectado por eje y nivel de confianza
          </caption>
          <tbody role="rowgroup">
            <AxisRow label={AXIS_LABEL.cms} axis={stack.cms} />
            <AxisRow label={AXIS_LABEL.cdn} axis={stack.cdn} />
            <AxisRow label={AXIS_LABEL.hosting} axis={stack.hosting} />
            <AxisRow label={AXIS_LABEL.jsFramework} axis={stack.jsFramework} />
            <tr className={styles.row} role="row">
              <th scope="row" role="rowheader" className={styles.axis}>
                {AXIS_LABEL.analytics}
              </th>
              <td role="cell" className={styles.detection}>
                <div className={styles.detectionInner}>
                  {stack.analytics.length === 0 ? (
                    <NotDetected />
                  ) : (
                    stack.analytics.map((tool, i) => (
                      <ConfidenceBadge key={`${tool.value}-${i}`} confidence={tool.confidence}>
                        {tool.value}
                        <span className={styles.srOnly}>
                          {" "}
                          ({CONFIDENCE_LABEL[tool.confidence]})
                        </span>
                      </ConfidenceBadge>
                    ))
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
