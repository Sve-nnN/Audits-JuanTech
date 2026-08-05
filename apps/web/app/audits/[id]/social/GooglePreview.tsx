import { Globe } from "lucide-react";
import type { SocialPreviewData } from "@auditor/report-model";
import styles from "./GooglePreview.module.css";

interface GooglePreviewProps {
  data: SocialPreviewData;
}

/**
 * Simulación del resultado de búsqueda (PREVIEW-01). Imita la JERARQUÍA de un
 * SERP (título > URL > descripción) con la escala tipográfica del proyecto,
 * nunca la tipografía ni los colores de marca de Google (bloqueado en
 * 32-CONTEXT.md: mockup con tokens, jamás clon pixel-perfect).
 *
 * Todo el texto del sitio auditado se renderiza como children de React, que lo
 * escapa; ningún `dangerouslySetInnerHTML` entra a este árbol (T-32-01).
 */
export function GooglePreview({ data }: GooglePreviewProps) {
  return (
    <div className={styles.card}>
      <div className={styles.site}>
        {/* Ícono genérico, no el favicon real del sitio: IMG-05 (favicon
            alcanzable) está diferido y no se fetchea nada de terceros acá. */}
        <Globe size={16} aria-hidden="true" className={styles.favicon} />
        <span className={styles.domain}>{data.domain}</span>
      </div>
      {data.title ? (
        <span className={styles.title}>{data.title}</span>
      ) : (
        <span className={styles.missing}>Sin título</span>
      )}
      {/* Siempre la URL real rastreada, nunca el valor crudo de og:url — que
          puede no coincidir y ya lo audita SOCIAL-04 por separado. */}
      <span className={styles.url}>{data.pageUrl}</span>
      {data.description ? (
        <p className={styles.description}>{data.description}</p>
      ) : (
        <p className={styles.missingDescription}>Sin descripción</p>
      )}
    </div>
  );
}
