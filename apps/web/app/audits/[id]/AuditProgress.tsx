"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./report.module.css";

interface AuditStats {
  discovered?: number;
  crawled?: number;
  total?: number;
  failed?: number;
  phase?: "crawling" | "analyzing" | "performance";
}

const PHASE_LABEL: Record<string, string> = {
  crawling: "Rastreando páginas…",
  analyzing: "Analizando checks (SEO técnico, on-page, datos estructurados, AEO)…",
  performance: "Midiendo rendimiento y Core Web Vitals (PageSpeed Insights)…",
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
      const res = await fetch(`/api/audits/${auditId}`);
      if (!res.ok) return;
      const data: AuditPollResponse = await res.json();
      setPoll(data);
      if (data.status === "done" || data.status === "failed") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.location.reload();
      }
    }
    void tick();
    intervalRef.current = setInterval(() => void tick(), 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [auditId]);

  const stats = poll?.stats;

  return (
    <div className={styles.hero}>
      <div className={styles.heroBody}>
        <h2>Auditando el sitio…</h2>
        <p>
          Estamos rastreando las páginas, corriendo los checks y midiendo el rendimiento. Esto
          puede tardar varios minutos en sitios grandes.
        </p>
        {stats && (
          <>
            <p style={{ marginTop: 14, fontSize: 15, fontWeight: 600 }}>
              {PHASE_LABEL[stats.phase ?? "crawling"] ?? "Procesando…"}
            </p>
            {stats.phase === "analyzing" || stats.phase === "performance" ? (
              <p style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                Ya rastreamos {stats.crawled ?? 0} página(s). Esta etapa no tiene barra de progreso
                y puede tardar un poco; no cierres la página.
              </p>
            ) : (
              <p style={{ marginTop: 6, fontSize: 14 }}>
                {stats.crawled ?? 0}/{stats.total ?? "?"} páginas rastreadas
                {typeof stats.discovered === "number" ? ` · ${stats.discovered} descubiertas` : ""}
                {typeof stats.failed === "number" && stats.failed > 0 ? ` · ${stats.failed} fallidas` : ""}
              </p>
            )}
          </>
        )}
        {poll?.status === "failed" && (
          <p style={{ marginTop: 10, color: "#dc2626" }}>Error: {poll.error ?? "la auditoría falló"}</p>
        )}
      </div>
    </div>
  );
}
