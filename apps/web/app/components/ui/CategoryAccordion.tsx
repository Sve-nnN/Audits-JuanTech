"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "./Badge";
import styles from "./CategoryAccordion.module.css";

interface AccordionProps {
  /** Etiqueta de categoría (rol Khand h4). */
  title: string;
  /** Resumen corto, p. ej. "3 problema(s) · 12 correcto(s)". */
  count?: string;
  /** Abre el detalle por defecto (atributo `open` nativo). */
  defaultOpen?: boolean;
  /** Filas de detalle (subgrupos e issues; el consumidor arma el contenido). */
  children: ReactNode;
}

/**
 * CategoryAccordion (COMP-05) — disclosure por categoría (Problemas vs
 * Correcto) construido sobre `<details>`/`<summary>` nativos: sin estado JS,
 * soporte de teclado (Enter/Space) y de tecnología asistida gratis.
 *
 * Accesibilidad:
 *   - `<summary>` es un botón en el árbol de a11y; el estado expandido se
 *     expone automáticamente.
 *   - Chevron decorativo `aria-hidden`; su rotación va guardada por
 *     `prefers-reduced-motion` (instantánea bajo reduced-motion).
 *   - Foco visible inset (`outline-offset:-2px`) dentro del grupo redondeado.
 *   - El color nunca es señal única: los Badges de los subgrupos llevan texto.
 */
export function CategoryAccordion({
  title,
  count,
  defaultOpen = false,
  children,
}: AccordionProps) {
  return (
    <details className={styles.group} open={defaultOpen || undefined}>
      <summary className={styles.summary}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>
          {count ? <span className={styles.count}>{count}</span> : null}
          <ChevronDown className={styles.chevron} size={20} aria-hidden="true" />
        </span>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}

interface AccordionSubgroupProps {
  /** "problems" → Badge critical; "correct" → Badge ok. */
  kind: "problems" | "correct";
  /** Cantidad de items del subgrupo (controla el vacío). */
  count: number;
  /** Filas issue-detail; si `count` es 0 se muestra el vacío. */
  children?: ReactNode;
}

/**
 * AccordionSubgroup (COMP-05) — subgrupo "Problemas" / "Correcto" con un Badge
 * de severidad y un conteo. Muestra un vacío en `--text-muted` cuando no hay
 * items. Estructura reutilizable que el ensamblado de Fase 10 rellena.
 */
export function AccordionSubgroup({
  kind,
  count,
  children,
}: AccordionSubgroupProps) {
  const isProblems = kind === "problems";
  return (
    <section className={styles.subgroup}>
      <div className={styles.subgroupHeader}>
        <Badge variant={isProblems ? "critical" : "ok"}>
          {isProblems ? "Problemas" : "Correcto"}
        </Badge>
        <span className={styles.subgroupCount}>{count}</span>
      </div>
      {count > 0 ? (
        children
      ) : (
        <p className={styles.subgroupEmpty}>
          {isProblems
            ? "Sin problemas en esta categoria."
            : "Sin checks correctos."}
        </p>
      )}
    </section>
  );
}

interface IssueField {
  /** Etiqueta del campo (uppercase 11px). */
  label: string;
  /** Valor del campo. El 2.º campo se renderiza en Geist Mono (valor medido). */
  value: ReactNode;
}

interface IssueDetailProps {
  /** Identificador del check (mono), mostrado como `[checkId]`. */
  checkId: string;
  /** Título legible del issue. */
  title: string;
  /** Badges de severidad/diff provistos por el consumidor. */
  badges?: ReactNode;
  /**
   * Campos del issue en un grid `<dl>`. Por convención el 2.º campo es el
   * "Valor medido" y se estiliza en Geist Mono + tnum (regla nth-of-type).
   */
  fields?: IssueField[];
}

/**
 * IssueDetail (COMP-05) — fila de detalle de un issue: título `[checkId]` +
 * Badges + grid `<dl>` de campos. Estructura y estilos reutilizables; el
 * contenido concreto lo aporta el consumidor en Fase 10.
 */
export function IssueDetail({
  checkId,
  title,
  badges,
  fields,
}: IssueDetailProps) {
  return (
    <div className={styles.issue}>
      <div className={styles.issueHeader}>
        <span className={styles.issueTitle}>
          <span className={styles.issueCheckId}>[{checkId}]</span> {title}
        </span>
        {badges}
      </div>
      {fields && fields.length > 0 ? (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div className={styles.field} key={field.label}>
              <dt className={styles.fieldLabel}>{field.label}</dt>
              <dd className={styles.fieldValue}>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
