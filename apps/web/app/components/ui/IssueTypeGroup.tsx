"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { groupIssuesByType, type ReportIssue } from "@auditor/report-model";
import { SeverityBadge, DiffBadge } from "./Badge";
import { shortUrl } from "./url";
import styles from "./IssueTypeGroup.module.css";

interface IssueTypeGroupProps {
  /** Issues a agrupar por tipo (`checkId` + `title`) vía `groupIssuesByType`. */
  issues: ReportIssue[];
  /** Dominio auditado: enlaces del mismo host muestran solo la ruta; los externos, host+ruta. */
  siteHost?: string | null;
}

/** Conteo de páginas afectadas con singular/plural. */
function pageCount(count: number): string {
  return `${count} ${count === 1 ? "página" : "páginas"}`;
}

/**
 * Celda "Página / URL": enlace real solo si empieza por http/https (misma
 * salvaguarda de esquema que IssuesTable, T-15-02); en otro caso texto plano
 * que React escapa. Se muestra la ruta compacta (`shortUrl`).
 */
function urlCell(url: string | null, siteHost?: string | null): ReactNode {
  if (url && /^https?:\/\//i.test(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={url}
        className={styles.link}
      >
        {shortUrl(url, siteHost)}
      </a>
    );
  }
  return <span className={styles.plain}>{shortUrl(url, siteHost)}</span>;
}

/**
 * IssueTypeGroup (REPORT-01 / REPORT-02) — grupos colapsables por tipo de
 * issue, construidos sobre `<details>`/`<summary>` nativos (mismo patrón que
 * CategoryAccordion: teclado y AT gratis, sin estado JS ni `aria-expanded`
 * manual). Reusado idéntico en "Issues prioritarios" y dentro de cada categoría
 * en "Detalle por categoría".
 *
 * El orden (severidad peor-primero → cantidad descendente) es única fuente de
 * verdad de `groupIssuesByType`; la UI solo renderiza, no reordena.
 */
export function IssueTypeGroup({ issues, siteHost }: IssueTypeGroupProps) {
  const groups = groupIssuesByType(issues);

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <details className={styles.group} key={`${group.checkId} ${group.title}`}>
          <summary className={styles.summary}>
            <span className={styles.groupTitle} data-testid="issue-group-title">
              {group.title}
            </span>
            <span className={styles.meta}>
              <SeverityBadge severity={group.severity} />
              <span className={styles.count}>{pageCount(group.count)}</span>
              <ChevronDown className={styles.chevron} size={20} aria-hidden="true" />
            </span>
          </summary>
          {/*
            Sin role="region": aplicarlo a cada grupo saturaba el árbol de
            landmarks cuando hay decenas de tipos de issue (UI-2). El disclosure
            nativo <details>/<summary> ya comunica la semántica; el SeverityBadge
            + título del summary nombran cada grupo.
          */}
          <div className={styles.body}>
            {group.issues.map((issue) => (
              <div className={styles.row} key={issue.id}>
                <span className={styles.cell}>
                  <span className={styles.cellLabel}>Página / URL</span>
                  <span className={styles.cellValue}>{urlCell(issue.url, siteHost)}</span>
                </span>
                <span className={styles.cell}>
                  <span className={styles.cellLabel}>Valor medido</span>
                  <span className={styles.cellValueMono}>
                    {issue.measuredValue ?? "—"}
                  </span>
                </span>
                {issue.diffStatus ? <DiffBadge diff={issue.diffStatus} /> : null}
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
