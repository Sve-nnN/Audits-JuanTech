"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type AuditStatus = "queued" | "running" | "done" | "failed";

interface AuditStats {
  discovered?: number;
  crawled?: number;
  total?: number;
  failed?: number;
}

interface AuditResponse {
  id: string;
  status: AuditStatus;
  error?: string | null;
  urlLimit?: number;
  stats?: AuditStats | null;
  pageCount?: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export default function HomePage() {
  const [url, setUrl] = useState("https://example.com");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(id: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/audits/${id}`);
      if (!res.ok) return;
      const data: AuditResponse = await res.json();
      setAudit(data);
      if (data.status === "done" || data.status === "failed") {
        stopPolling();
      }
    }, 2000);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setAudit(null);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuditId(data.auditId);
        startPolling(data.auditId);
      } else {
        setAudit({
          id: "",
          status: "failed",
          error: data.error,
          createdAt: "",
          startedAt: null,
          finishedAt: null,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const stats = audit?.stats;

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 480 }}>
      <h1>Auditor</h1>
      <p>Ingresa una URL para lanzar una auditoría de rastreo (crawl).</p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://dominio.com"
        style={{ padding: 8, width: "100%", marginBottom: 12 }}
      />
      <button onClick={handleSubmit} disabled={submitting} style={{ padding: "8px 16px" }}>
        {submitting ? "Encolando..." : "Auditar"}
      </button>

      {auditId && (
        <div style={{ marginTop: 24 }}>
          <p>
            <strong>Audit ID:</strong> {auditId}
          </p>
          <p>
            <strong>Status:</strong> {audit?.status ?? "esperando..."}
          </p>
          {stats && (
            <p>
              <strong>Progreso:</strong> {stats.crawled ?? 0}/{stats.total ?? audit?.urlLimit ?? "?"} páginas
              rastreadas
              {typeof stats.discovered === "number" ? ` (descubiertas: ${stats.discovered})` : ""}
              {typeof stats.failed === "number" && stats.failed > 0 ? ` — fallidas: ${stats.failed}` : ""}
            </p>
          )}
          {typeof audit?.pageCount === "number" && (
            <p>
              <strong>Páginas guardadas:</strong> {audit.pageCount}
            </p>
          )}
          {audit?.error && <p style={{ color: "red" }}>Error: {audit.error}</p>}
          {audit?.status === "done" && (
            <p>
              <Link href={`/audits/${auditId}/pages`}>Ver páginas y datos estructurados &rarr;</Link>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
