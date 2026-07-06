"use client";

import type { ScoreStatus } from "@auditor/scoring";
import styles from "./ScoreGauge.module.css";

interface ScoreGaugeProps {
  /** Valor 0–max. `null` → estado "sin datos" (solo track, guion). */
  value: number | null;
  /** Máximo de la escala. Default 100. */
  max?: number;
  /** Estado semántico que colorea el arco. `null` → color muted. */
  status: ScoreStatus | null;
  /** md=96px (categoría) · lg=132px (hero general). Default "lg". */
  size?: "md" | "lg";
  /** Caption opcional debajo del número (Geist Sans 14). */
  label?: string;
  /** Etiqueta accesible; si falta se deriva de value + status. */
  "aria-label"?: string;
}

/** Geometría por tamaño: dimensión del svg y grosor del anillo. */
const DIMENSIONS = {
  lg: { size: 132, strokeWidth: 8 },
  md: { size: 96, strokeWidth: 6 },
} as const;

/** Estado → clase de color (currentColor del arco). */
const STATUS_CLASS: Record<
  "good" | "needs_improvement" | "critical",
  string | undefined
> = {
  good: styles.good,
  needs_improvement: styles.needs_improvement,
  critical: styles.critical,
};

const STATUS_WORD: Record<"good" | "needs_improvement" | "critical", string> = {
  good: "estado bueno",
  needs_improvement: "necesita mejora",
  critical: "estado crítico",
};

/**
 * ScoreGauge (COMP-01) — indicador circular de score en un anillo SVG.
 *
 * Renderiza dos círculos concéntricos: un track de fondo y un arco de progreso
 * cuyo color lo determina el estado (good/needs_improvement/critical) reusando
 * los tokens de severidad (DS-02). El número central va en Geist Mono con
 * cifras tabulares. Con `value=null` muestra solo el track y un guion, sin color
 * de estado.
 *
 * Motion-ready: el `stroke-dashoffset` del arco se expone como custom prop
 * `--gauge-offset` para que la Fase 10 lo anime; aquí se entrega en su valor
 * final SIN transition.
 *
 * Accesibilidad:
 *   - El `<svg>` lleva `role="img"` + `aria-label` con número y estado en
 *     palabras (el color nunca es la única señal).
 *   - Track y arco son decorativos (`aria-hidden`); el svg no es focusable.
 */
export function ScoreGauge({
  value,
  max = 100,
  status,
  size = "lg",
  label,
  "aria-label": ariaLabelProp,
}: ScoreGaugeProps) {
  const { size: dim, strokeWidth } = DIMENSIONS[size];
  const center = dim / 2;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const hasValue = value !== null && value !== undefined;
  // Evita `0 / 0 = NaN` cuando `max <= 0`: normaliza el denominador antes de
  // dividir para que un score de 0 (o max=0) dibuje un arco VACÍO, no lleno.
  const safeMax = max > 0 ? max : 1;
  const ratio = hasValue ? Math.min(Math.max(value / safeMax, 0), 1) : 0;
  const offset = circumference * (1 - ratio);

  const statusClass = status ? STATUS_CLASS[status] : styles.unknown;

  const ariaLabel =
    ariaLabelProp ??
    (hasValue
      ? `Score ${value} de ${max}${status ? `, ${STATUS_WORD[status]}` : ""}`
      : "Score sin datos");

  return (
    <div className={`${styles.root} ${styles[size]}`}>
      <div className={`${styles.gauge} ${statusClass}`}>
        <svg
          className={styles.svg}
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            className={styles.track}
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
            aria-hidden="true"
          />
          {hasValue && (
            <circle
              className={styles.arc}
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ "--gauge-offset": offset } as React.CSSProperties}
              aria-hidden="true"
            />
          )}
        </svg>
        <div className={styles.readout} aria-hidden="true">
          <span className={styles.number}>{hasValue ? value : "—"}</span>
          {hasValue && <span className={styles.max}>/ {max}</span>}
        </div>
      </div>
      {label && <span className={styles.caption}>{label}</span>}
    </div>
  );
}
