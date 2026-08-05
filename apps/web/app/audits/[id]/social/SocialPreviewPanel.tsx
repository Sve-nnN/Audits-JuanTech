"use client";

import type { SocialPreviewData } from "@auditor/report-model";
import { GooglePreview } from "./GooglePreview";
import styles from "./SocialPreviewPanel.module.css";

interface SocialPreviewPanelProps {
  /** Una sola página: cada instancia del panel representa exactamente una. */
  data: SocialPreviewData;
  /**
   * Auditoría dueña de la página. Todavía sin uso: lo consume el proxy de
   * imágenes del Plan 32-02; se recibe desde ahora para no cambiar la firma
   * del componente en una wave posterior.
   */
  auditId: string;
}

/**
 * Contenedor del panel de preview social (PREVIEW-01). En esta wave muestra un
 * único layout (Google); el Plan 32-04 agrega Facebook/LinkedIn y X sobre esta
 * misma estructura con el wrapper de tabs WAI-ARIA.
 */
export function SocialPreviewPanel({ data }: SocialPreviewPanelProps) {
  return (
    <section className={styles.panel}>
      <h4 className={styles.heading}>Vista previa al compartir</h4>
      <p className={styles.subtitle}>Así se ve esta página cuando alguien la comparte.</p>
      <GooglePreview data={data} />
    </section>
  );
}
