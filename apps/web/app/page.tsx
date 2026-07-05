"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/audits/${data.auditId}`);
      } else {
        setError(data.error ?? "No se pudo iniciar la auditoría.");
        setSubmitting(false);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Auditor SEO</h1>
        <p className={styles.subtitle}>
          Ingresá la URL de tu sitio y te damos un reporte completo: SEO técnico, on-page, datos
          estructurados, rendimiento (Core Web Vitals) y visibilidad en IA.
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tu-dominio.com"
            type="text"
            required
          />
          <button className={styles.button} type="submit" disabled={submitting}>
            {submitting ? "Encolando auditoría…" : "Auditar mi sitio"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
        <p className={styles.footnote}>
          Rastreamos hasta 500 URLs por sitio. El reporte se genera en una URL única que podés
          consultar o compartir en cualquier momento.
        </p>
      </div>
    </main>
  );
}
