"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { SocialImageStatus } from "@auditor/report-model";
import styles from "./PreviewImage.module.css";

interface PreviewImageProps {
  auditId: string;
  ogImage: string | null;
  imageStatus: SocialImageStatus;
  /** Proporción que la plataforma simulada renderiza (1.91:1 en tarjeta ancha, 1:1 en `summary`). */
  aspectRatio: "1.91 / 1" | "1 / 1";
}

/**
 * Imagen del preview social (PREVIEW-04).
 *
 * Nunca hace hotlink al sitio auditado: el `src` apunta siempre a nuestro
 * propio proxy, que es la única puerta con allowlist de origen y guardia SSRF.
 *
 * Y nunca pide una imagen que Phase 31 (IMG-01) ya marcó rota o no
 * verificable: con `imageStatus` distinto de `"ok"` no hay elemento de imagen
 * en el árbol, así que no sale ni un request. Reintentar contra un destino que
 * el sondeo ya declaró inalcanzable sería carga inútil contra el sitio
 * auditado y un ícono de imagen rota garantizado.
 */
export function PreviewImage({ auditId, ogImage, imageStatus, aspectRatio }: PreviewImageProps) {
  // El proxy puede fallar en ejecución aunque IMG-01 haya dado `ok`: la imagen
  // pudo caerse entre el crawl y la lectura del reporte. El navegador nunca se
  // queda con su ícono de rota; se conmuta al mismo bloque de placeholder.
  const [errored, setErrored] = useState(false);

  if (imageStatus === "none" || !ogImage) {
    return <span className={styles.missing}>Sin imagen</span>;
  }

  if (imageStatus === "unavailable" || errored) {
    return (
      <div className={styles.placeholder} style={{ aspectRatio }}>
        <ImageOff size={24} aria-hidden="true" className={styles.icon} />
        <span className={styles.placeholderTitle}>Imagen no disponible</span>
        <span className={styles.placeholderBody}>
          {errored
            ? "No se pudo cargar la imagen."
            : "La imagen declarada en og:image no se pudo verificar. Revisa el issue de esta página."}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.frame} style={{ aspectRatio }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- el optimizador de
          Next resolvería el remoto por su cuenta; acá el proxy propio es la
          única puerta admitida hacia una imagen de terceros. */}
      <img
        // `encodeURIComponent` y no interpolación cruda: un `&` en la URL
        // declarada partiría el query string de nuestra propia ruta (T-32-10).
        src={`/api/audits/${auditId}/preview-image?url=${encodeURIComponent(ogImage)}`}
        alt=""
        role="presentation"
        loading="lazy"
        className={styles.image}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
