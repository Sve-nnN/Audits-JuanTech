"use client";

import { useId, useRef, useState } from "react";
import type { SocialPreviewData } from "@auditor/report-model";
import { FixSnippet } from "./FixSnippet";
import { GooglePreview } from "./GooglePreview";
import { SocialCardPreview } from "./SocialCardPreview";
import { XPreview } from "./XPreview";
import styles from "./SocialPreviewPanel.module.css";

const TAB_LABELS = ["Google", "Facebook / LinkedIn", "X"] as const;

interface SocialPreviewPanelProps {
  /** Una sola página: cada instancia del panel representa exactamente una. */
  data: SocialPreviewData;
  /** Auditoría dueña de la página; la consume el proxy de imágenes del preview. */
  auditId: string;
}

/**
 * Contenedor del panel de preview social: los tres layouts de la misma página
 * como sub-vistas mutuamente excluyentes de un `tablist` WAI-ARIA
 * (roving tabindex, flechas con wrap, Home/End).
 *
 * Los tres paneles se renderizan siempre y los inactivos usan el atributo
 * `hidden`, no una clase con `display:none`: así el orden de lectura para
 * tecnologías de asistencia se mantiene y el contenido no depende de un
 * remontaje.
 *
 * El manejo de teclado se ata a cada `role="tab"`, nunca a `document`: un
 * listener global interceptaría flechas del resto del reporte (T-32-15).
 */
export function SocialPreviewPanel({ data, auditId }: SocialPreviewPanelProps) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = (i: number) => `${baseId}-panel-${i}`;

  function select(index: number) {
    setActive(index);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TAB_LABELS.length - 1;
    switch (event.key) {
      case "ArrowRight":
        select(index === last ? 0 : index + 1);
        break;
      case "ArrowLeft":
        select(index === 0 ? last : index - 1);
        break;
      case "Home":
        select(0);
        break;
      case "End":
        select(last);
        break;
      case "Enter":
      case " ":
        select(index);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const views = [
    <GooglePreview key="google" data={data} />,
    <SocialCardPreview key="social" data={data} auditId={auditId} />,
    <XPreview key="x" data={data} auditId={auditId} />,
  ];

  return (
    <section className={styles.panel}>
      <h4 className={styles.heading}>Vista previa al compartir</h4>
      <p className={styles.subtitle}>Así se ve esta página cuando alguien la comparte.</p>

      <div role="tablist" aria-label="Vista previa al compartir" className={styles.tablist}>
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            id={tabId(i)}
            aria-controls={panelId(i)}
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            className={active === i ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActive(i)}
            onKeyDown={(event) => onKeyDown(event, i)}
          >
            {label}
          </button>
        ))}
      </div>

      {views.map((view, i) => (
        <div
          key={TAB_LABELS[i]}
          role="tabpanel"
          id={panelId(i)}
          aria-labelledby={tabId(i)}
          tabIndex={0}
          hidden={active !== i}
          className={styles.tabpanel}
        >
          {view}
        </div>
      ))}

      {data.fixSnippet !== null && (
        <div className={styles.fix}>
          <FixSnippet snippet={data.fixSnippet} />
        </div>
      )}
    </section>
  );
}
