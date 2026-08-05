import type { ReactNode } from "react";
import type { SocialImageStatus, SocialPreviewData } from "@auditor/report-model";
import { PreviewImage } from "./PreviewImage";
import styles from "./SocialCardPreview.module.css";

interface SocialCardTextProps {
  domain: string;
  title: string | null;
  description: string | null;
  /** Ranura entre el dominio y el título. La usa XPreview para "Sin twitter:card". */
  note?: ReactNode;
}

/**
 * Bloque textual compartido por las tres tarjetas sociales (Facebook/LinkedIn y
 * las dos variantes de X). Vive acá para que la lógica de truncado exista una
 * sola vez: el clamp es una regla de CSS y duplicarla en dos módulos es la
 * forma más fácil de que se desincronicen.
 */
export function SocialCardText({ domain, title, description, note }: SocialCardTextProps) {
  return (
    <div className={styles.body}>
      <span className={styles.domain}>{domain}</span>
      {note}
      {title ? (
        <span className={styles.title}>{title}</span>
      ) : (
        <span className={styles.missingTitle}>Sin título</span>
      )}
      {description ? (
        <p className={styles.description}>{description}</p>
      ) : (
        <p className={styles.missingDescription}>Sin descripción</p>
      )}
    </div>
  );
}

interface SocialCardLayoutProps extends SocialCardTextProps {
  auditId: string;
  image: string | null;
  imageStatus: SocialImageStatus;
}

/**
 * Tarjeta ancha: imagen 1.91:1 arriba, texto abajo. Es el layout que comparten
 * Facebook, LinkedIn y X en su variante `summary_large_image`.
 */
export function SocialCardLayout({
  auditId,
  image,
  imageStatus,
  ...text
}: SocialCardLayoutProps) {
  return (
    <div className={styles.card}>
      <PreviewImage
        auditId={auditId}
        ogImage={image}
        imageStatus={imageStatus}
        aspectRatio="1.91 / 1"
      />
      <SocialCardText {...text} />
    </div>
  );
}

interface SocialCardPreviewProps {
  data: SocialPreviewData;
  auditId: string;
}

/**
 * Preview de Facebook/LinkedIn (PREVIEW-02). Ambas plataformas renderizan la
 * misma tarjeta 1.91:1 a partir de las mismas etiquetas Open Graph, así que
 * comparten un único componente.
 *
 * Todo el texto del sitio auditado entra como children de React, que lo escapa;
 * ningún `dangerouslySetInnerHTML` toca este árbol (T-32-14).
 */
export function SocialCardPreview({ data, auditId }: SocialCardPreviewProps) {
  return (
    <SocialCardLayout
      auditId={auditId}
      image={data.ogImage}
      imageStatus={data.imageStatus}
      domain={data.domain}
      title={data.title}
      description={data.description}
    />
  );
}
