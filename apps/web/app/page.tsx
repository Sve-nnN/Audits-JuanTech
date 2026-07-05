"use client";

import { useState, useRef } from "react";

type AuditStatus = "queued" | "running" | "done" | "failed";

interface AuditResponse {
  id: string;
  status: AuditStatus;
  error?: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export default function HomePage() {
  const [domain, setDomain] = useState("example.com");
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
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuditId(data.auditId);
        startPolling(data.auditId);
      } else {
        setAudit({ id: "", status: "failed", error: data.error, createdAt: "", startedAt: null, finishedAt: null });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 480 }}>
      <h1>Auditor — wiring de prueba</h1>
      <p>Encola un job no-op y muestra la transición de estado en vivo.</p>
      <input
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="dominio.com"
        style={{ padding: 8, width: "100%", marginBottom: 12 }}
      />
      <button onClick={handleSubmit} disabled={submitting} style={{ padding: "8px 16px" }}>
        {submitting ? "Encolando..." : "Auditar (test)"}
      </button>

      {auditId && (
        <div style={{ marginTop: 24 }}>
          <p>
            <strong>Audit ID:</strong> {auditId}
          </p>
          <p>
            <strong>Status:</strong> {audit?.status ?? "esperando..."}
          </p>
          {audit?.error && <p style={{ color: "red" }}>Error: {audit.error}</p>}
        </div>
      )}
    </main>
  );
}
