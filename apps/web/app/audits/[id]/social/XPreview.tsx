import type { SocialPreviewData } from "@auditor/report-model";
import { PreviewImage } from "./PreviewImage";
import { SocialCardLayout, SocialCardText } from "./SocialCardPreview";
import styles from "./XPreview.module.css";

interface XPreviewProps {
  data: SocialPreviewData;
  auditId: string;
}

/**
 * Preview de X (PREVIEW-03). La variante la dicta el valor real de
 * `twitter:card`: `socialPreview.ts` ya resolvió el respaldo OG→Twitter y sólo
 * marca `summary_large_image` cuando la página lo declara explícitamente. Acá
 * nunca se fuerza la tarjeta ancha.
 *
 * Sin `twitter:card` declarado se pinta `summary` (lo que asumen los clientes
 * reales) y se marca el campo ausente, para que la ausencia no se lea como una
 * decisión del sitio.
 */
export function XPreview({ data, auditId }: XPreviewProps) {
  const note =
    data.twitterCardDeclared === null ? (
      <span className={styles.missingCard}>Sin twitter:card</span>
    ) : undefined;

  // Los campos `twitter*`, no los `og*` planos: el fallback ya está resuelto
  // aguas arriba y volver a mirar los OG acá lo duplicaría con otro criterio.
  const text = {
    domain: data.domain,
    title: data.twitterTitle,
    description: data.twitterDescription,
    note,
  };

  if (data.twitterCardVariant === "summary_large_image") {
    return (
      <SocialCardLayout
        auditId={auditId}
        image={data.twitterImage}
        imageStatus={data.imageStatus}
        {...text}
      />
    );
  }

  return (
    <div className={styles.summaryCard}>
      <div className={styles.thumb}>
        <PreviewImage
          auditId={auditId}
          ogImage={data.twitterImage}
          imageStatus={data.imageStatus}
          aspectRatio="1 / 1"
        />
      </div>
      <SocialCardText {...text} />
    </div>
  );
}
