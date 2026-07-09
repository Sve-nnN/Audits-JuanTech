"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./progress.module.css";

interface AuditStats {
  discovered?: number;
  crawled?: number;
  total?: number;
  failed?: number;
  phase?: "crawling" | "rendering" | "analyzing" | "performance";
}

type Phase = "crawling" | "rendering" | "analyzing" | "performance";

const PHASE_ORDER: Phase[] = ["crawling", "rendering", "analyzing", "performance"];

const PHASE_LABEL: Record<Phase, string> = {
  crawling: "Rastreando páginas",
  rendering: "Verificando renderizado (JS) en una muestra de páginas",
  analyzing: "Analizando checks (SEO técnico, on-page, datos estructurados y AEO)",
  performance: "Midiendo rendimiento y Core Web Vitals (PageSpeed Insights)",
};

interface AuditPollResponse {
  status: "queued" | "running" | "done" | "failed";
  error?: string | null;
  stats?: AuditStats | null;
}

/**
 * Polls `/api/audits/[id]` while the crawl/checks/scoring run in the
 * background, then reloads the page once the audit reaches a terminal
 * state so the server component can render the full report.
 */
export function AuditProgress({ auditId }: { auditId: string }) {
  const [poll, setPoll] = useState<AuditPollResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function tick() {
      try {
        const res = await fetch(`/api/audits/${auditId}`);
        if (!res.ok) return;
        const data: AuditPollResponse = await res.json();
        setPoll(data);
        if (data.status === "done") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          window.location.reload();
        } else if (data.status === "failed") {
          // Terminal, pero mantenemos la SPA: paramos el polling y dejamos que el
          // componente renderice su rama de error (role="alert"). Recargar aquí
          // volvería a montar AuditProgress (page.tsx renderiza este componente
          // para cualquier status !== "done") y crearía un bucle de recargas.
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Fallo transitorio de red o body no-JSON mientras el worker aún no
        // responde: lo tragamos y dejamos que el siguiente intervalo reintente,
        // en vez de escapar como unhandled promise rejection.
      }
    }
    void tick();
    intervalRef.current = setInterval(() => void tick(), 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [auditId]);

  const stats = poll?.stats;
  const failed = poll?.status === "failed";
  const phase: Phase = stats?.phase ?? "crawling";
  const currentIndex = PHASE_ORDER.indexOf(phase);

  const crawled = stats?.crawled ?? 0;
  const total = typeof stats?.total === "number" ? stats.total : undefined;
  const isCrawlingDeterminate =
    phase === "crawling" && typeof total === "number" && total > 0;
  const ratio = isCrawlingDeterminate
    ? Math.min(1, Math.max(0, crawled / (total as number)))
    : 0;

  const phaseLabel = PHASE_LABEL[phase] ?? "Procesando";

  // Semántica del progressbar: durante crawling con ratio conocido exponemos
  // aria-valuenow/min/max; en fases indeterminadas queda aria-busy sin valuenow.
  const progressbarProps = isCrawlingDeterminate
    ? {
        "aria-valuenow": crawled,
        "aria-valuemin": 0,
        "aria-valuemax": total,
      }
    : { "aria-busy": true as const };

  function segmentClass(index: number): string | undefined {
    if (failed) {
      return index <= currentIndex
        ? `${styles.segment} ${styles.segmentFailed}`
        : styles.segment;
    }
    if (index < currentIndex) return `${styles.segment} ${styles.segmentComplete}`;
    if (index === currentIndex) {
      return isCrawlingDeterminate
        ? `${styles.segment} ${styles.segmentActive}`
        : `${styles.segment} ${styles.segmentBusy}`;
    }
    return styles.segment;
  }

  return (
    <div className={styles.hero}>
      <h2 className={styles.title}>Auditando tu sitio</h2>
      <p className={styles.body}>
        Estamos rastreando las páginas, corriendo los checks y midiendo el rendimiento. En
        sitios grandes esto puede tardar varios minutos.
      </p>

      <div
        className={styles.stepper}
        role="progressbar"
        aria-label={failed ? "La auditoría falló" : phaseLabel}
        {...progressbarProps}
      >
        {PHASE_ORDER.map((p, index) => {
          const fillVar =
            !failed && index === currentIndex && isCrawlingDeterminate
              ? ({ "--fill": `${Math.round(ratio * 100)}%` } as CSSProperties)
              : undefined;
          return (
            <div key={p} className={segmentClass(index)}>
              <span className={styles.segmentFill} style={fillVar} />
            </div>
          );
        })}
      </div>

      {!failed && (
        <>
          <p className={styles.phaseLabel} role="status" aria-live="polite">
            {phaseLabel}
          </p>
          {phase === "rendering" || phase === "analyzing" || phase === "performance" ? (
            <p className={styles.phaseCaption}>
              Ya rastreamos {crawled} página(s). Esta etapa no tiene barra de progreso y puede
              tardar un poco. No cierres esta página.
            </p>
          ) : (
            <p className={styles.readout}>
              {crawled}/{typeof total === "number" ? total : "?"} páginas rastreadas
              {typeof stats?.discovered === "number" ? ` · ${stats.discovered} descubiertas` : ""}
              {typeof stats?.failed === "number" && stats.failed > 0
                ? ` · ${stats.failed} fallidas`
                : ""}
            </p>
          )}
        </>
      )}

      {failed && (
        <p className={styles.errorText} role="alert">
          La auditoría falló: {poll?.error ?? "error desconocido"}. Vuelve al inicio e
          inténtalo de nuevo; si sigue fallando, escríbenos.
        </p>
      )}
    </div>
  );
}
