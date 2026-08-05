"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ClipboardCopy, Download } from "lucide-react";
import styles from "./FixSnippet.module.css";

const HEADING = "Etiquetas que faltan";
const HELP = "Pega estas etiquetas dentro del <head> de la página.";
const COPY_LABEL = "Copiar snippet";
const DOWNLOAD_LABEL = "Descargar snippet";
/** Mismo literal y misma ventana que `ExportMenu`, deliberadamente. */
const COPIED_MSG = "Copiado al portapapeles";
const COPIED_TTL_MS = 4000;
const FILENAME = "snippet-meta-tags.html";

function clipboardWriter(): ((text: string) => Promise<void>) | null {
  if (typeof navigator === "undefined") return null;
  // El tipo declara `navigator.clipboard` como siempre presente, pero en un
  // contexto inseguro (http://) el runtime no lo define.
  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (typeof clipboard?.writeText !== "function") return null;
  return (text: string) => clipboard.writeText(text);
}

interface FixSnippetProps {
  /** Bloque `<meta>` ya construido. El padre no monta este componente si es `null`. */
  snippet: string;
}

/**
 * FixSnippet (FIX-01/02) — bloque de código copiable con las etiquetas que
 * faltan en la página, prellenadas con sus valores reales.
 *
 * El snippet se pinta como children de `<code>`, así que React lo escapa y el
 * markup que contiene nunca se interpreta dentro de nuestra página (T-32-12).
 *
 * Copiar degrada a descarga en dos casos: cuando la Clipboard API no existe
 * (contexto inseguro) y cuando `writeText` rechaza (permiso denegado). El
 * primero se detecta al montar para que la etiqueta del botón nunca prometa
 * algo que no va a pasar. La detección arranca optimista ("Copiar snippet") y
 * se corrige en el efecto de montaje: así el HTML del servidor y el primer
 * render del cliente coinciden y no hay desajuste de hidratación.
 */
export function FixSnippet({ snippet }: FixSnippetProps) {
  const [canCopy, setCanCopy] = useState(true);
  const [copied, setCopied] = useState(false);
  const headingId = useId();

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setCanCopy(clipboardWriter() !== null);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    };
  }, []);

  // Descarga vía enlace temporal con revoke diferido (patrón WR-02 de
  // ExportMenu.tsx, replicado inline para no acoplar dos componentes sin
  // relación).
  const triggerDownload = useCallback(() => {
    const objectUrl = URL.createObjectURL(new Blob([snippet], { type: "text/html" }));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    pendingUrlRef.current = objectUrl;
    revokeTimerRef.current = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      pendingUrlRef.current = null;
      revokeTimerRef.current = null;
    }, 1000);
  }, [snippet]);

  const onCopy = useCallback(async () => {
    const write = clipboardWriter();
    if (write) {
      try {
        await write(snippet);
        setCopied(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => {
          setCopied(false);
          copiedTimerRef.current = null;
        }, COPIED_TTL_MS);
        return;
      } catch {
        // Permiso denegado o contexto inseguro: el usuario igual se lleva el
        // snippet, como archivo.
      }
    }
    triggerDownload();
  }, [snippet, triggerDownload]);

  const Icon = canCopy ? ClipboardCopy : Download;

  return (
    <section className={styles.wrapper} aria-labelledby={headingId}>
      <h4 id={headingId} className={styles.heading}>
        {HEADING}
      </h4>
      <p className={styles.help}>{HELP}</p>

      <pre className={styles.code}>
        <code>{snippet}</code>
      </pre>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => void onCopy()}>
          <Icon size={16} aria-hidden="true" />
          {canCopy ? COPY_LABEL : DOWNLOAD_LABEL}
        </button>

        <p className={styles.status} role="status" aria-live="polite">
          {copied && (
            <>
              <Check size={16} aria-hidden="true" />
              {COPIED_MSG}
            </>
          )}
        </p>
      </div>
    </section>
  );
}
