"use client";

import styles from "./Skeleton.module.css";

type SkeletonVariant = "text" | "block" | "circle" | "gauge" | "card" | "row";

interface SkeletonProps {
  /** Forma del placeholder (default `text`). */
  variant?: SkeletonVariant;
  /** Ancho explícito (px numérico o valor CSS). Override del default. */
  width?: string | number;
  /** Alto explícito (px numérico o valor CSS). Override del default. */
  height?: string | number;
  /** Solo para `text`: número de líneas (última al 60% de ancho). */
  lines?: number;
}

/** variante → clase del CSS Module. */
const VARIANT_CLASS: Record<SkeletonVariant, string | undefined> = {
  text: styles.text,
  block: styles.block,
  circle: styles.circle,
  gauge: styles.gauge,
  card: styles.card,
  row: styles.row,
};

/** Normaliza width/height a valor CSS (número → px). */
function toCss(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Skeleton (COMP-08) — placeholder de carga con shimmer accesible.
 *
 * Siempre decorativo: se fuerza `aria-hidden="true"` (no se confía en el
 * consumidor). El anuncio "Cargando…" en `role="status"` es responsabilidad de
 * la pantalla que lo usa (Fase 10).
 *
 * El shimmer es una animación CSS liviana sobre `::after`; bajo
 * `prefers-reduced-motion: reduce` se anula y el bloque queda estático.
 *
 * `variant="text"` con `lines > 1` renderiza N líneas apiladas; la última al
 * 60% de ancho para simular un párrafo real.
 */
export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const style = {
    ...(toCss(width) ? { width: toCss(width) } : {}),
    ...(toCss(height) ? { height: toCss(height) } : {}),
  };

  if (variant === "card") {
    return (
      <span className={styles.card} style={style} aria-hidden="true">
        <span className={`${styles.skeleton} ${styles.cardTitle}`} />
        <span className={`${styles.skeleton} ${styles.cardScore}`} />
      </span>
    );
  }

  if (variant === "text" && lines > 1) {
    return (
      <span className={styles.lines} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={`${styles.skeleton} ${styles.text} ${
              i === lines - 1 ? styles.lastLine : ""
            }`}
            style={i === lines - 1 ? {} : style}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className={`${styles.skeleton} ${VARIANT_CLASS[variant]}`}
      style={style}
      aria-hidden="true"
    />
  );
}
