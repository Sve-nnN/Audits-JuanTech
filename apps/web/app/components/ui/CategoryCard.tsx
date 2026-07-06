"use client";

import Link from "next/link";
import type { ScoreStatus } from "@auditor/scoring";
import { STATUS_LABEL } from "./labels";
import styles from "./CategoryCard.module.css";

interface CategoryCardProps {
  /** Nombre de la categoría, p. ej. "SEO Técnico". */
  label: string;
  /** Score 0–100. `null` → estado "sin datos" (guion muted). */
  score: number | null;
  /** Estado semántico que colorea score y caption. */
  status: ScoreStatus | null;
  /** Texto del estado, p. ej. "Bueno" | "Necesita mejora" | "Crítico". */
  statusLabel?: string;
  /** Si se provee, toda la card se vuelve un único enlace. */
  href?: string;
}

/** Estado → clase de color (mismo mapa que ScoreGauge, DS-02). */
const STATUS_CLASS: Record<
  "good" | "needs_improvement" | "critical",
  string | undefined
> = {
  good: styles.good,
  needs_improvement: styles.needs_improvement,
  critical: styles.critical,
};

/**
 * CategoryCard (COMP-02) — card compacta por categoría: etiqueta + score + estado.
 *
 * Consistente para las 5 categorías del reporte. El score y el caption de estado
 * comparten el mapa estado→color del ScoreGauge (good/needs_improvement/critical
 * → success/warning/critical). Con `score=null` muestra un guion y "sin datos" en
 * tono muted, sin acento de color.
 *
 * La etiqueta usa `var(--text-secondary)` (no `--text-muted`) para sostener
 * contraste AA en texto con significado.
 *
 * Accesibilidad:
 *   - Con `href`, toda la card se envuelve en un único `<a>` (un solo tab stop,
 *     sin interactivos anidados) con hover y focus-visible de marca.
 *   - Sin `href`, es una card estática sin hover.
 *   - El estado se comunica por color y por la palabra del estado, nunca solo
 *     por color. La etiqueta es un `<p>`, no un heading.
 */
export function CategoryCard({
  label,
  score,
  status,
  statusLabel,
  href,
}: CategoryCardProps) {
  const hasValue = score !== null && score !== undefined;
  const statusClass = status ? STATUS_CLASS[status] : styles.unknown;

  // Con status no-null pero sin statusLabel, derivamos la palabra del estado
  // desde el mapa compartido STATUS_LABEL para que el color nunca sea la única
  // señal (contrato "color is never the only signal").
  const resolvedStatusLabel =
    statusLabel ?? (status ? STATUS_LABEL[status] : hasValue ? "" : "sin datos");

  const content = (
    <>
      <p className={styles.label}>{label}</p>
      <p className={`${styles.score} ${statusClass}`}>{hasValue ? score : "—"}</p>
      <p className={`${styles.status} ${statusClass}`}>{resolvedStatusLabel}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.card} ${styles.link}`}>
        {content}
      </Link>
    );
  }

  return <div className={styles.card}>{content}</div>;
}
