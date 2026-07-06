"use client";

import type { ReactNode } from "react";
import styles from "./IssuesTable.module.css";

/**
 * Columna de la tabla de issues. `sticky` fija la columna a la izquierda
 * (la de URL/Página); `mono` la renderiza en Geist Mono + tnum (valores medidos).
 */
export interface IssuesTableColumn {
  key: string;
  header: string;
  align?: "left" | "right";
  mono?: boolean;
  sticky?: boolean;
}

export interface IssuesTableProps {
  columns: IssuesTableColumn[];
  /** Celdas renderables por fila, alineadas 1:1 con `columns` por índice. */
  rows: ReactNode[][];
  caption?: string;
  note?: string;
  emptyLabel?: string;
}

/**
 * IssuesTable (COMP-04) — tabla de issues prioritarios del reporte.
 *
 * Responsive por scroll horizontal (NO colapsa a cards): el `<table>` conserva
 * un `min-width` y el wrapper hace `overflow-x:auto`. La región de scroll es
 * enfocable por teclado (`tabindex=0` + `role="region"` + `aria-label`) para que
 * quien navega con teclado pueda desplazarla.
 *
 * Accesibilidad:
 *   - `<table>` real con `<caption>`, `<thead>` y `<th scope="col">`.
 *   - Header pegajoso en scroll vertical (`position:sticky; top:0`).
 *   - Ningún contenido se trunca sin un `title` que exponga el valor completo.
 */
export function IssuesTable({ columns, rows, caption, note }: IssuesTableProps) {
  return (
    <div className={styles.wrapper}>
      <div
        className={styles.scroll}
        tabIndex={0}
        role="region"
        aria-label={caption ?? "Tabla de issues"}
      >
        <table className={styles.table}>
          {caption ? <caption className={styles.caption}>{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    col.align === "right" ? styles.alignRight : null,
                    col.mono ? styles.mono : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    className={[
                      col.align === "right" ? styles.alignRight : null,
                      col.mono ? styles.mono : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row[colIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}
