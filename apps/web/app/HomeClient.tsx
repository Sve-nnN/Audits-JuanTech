"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./home.module.css";

type Step = "email" | "check-email" | "url";

interface HomeClientProps {
  initialEmail: string;
}

export function HomeClient({ initialEmail }: HomeClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialEmail ? "url" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar el email.");
        setSubmitting(false);
        return;
      }
      if (data.verified) {
        setStep("url");
      } else {
        setDevVerifyUrl(data.devVerifyUrl ?? null);
        setStep("check-email");
      }
      setSubmitting(false);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSubmitting(false);
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/audits/${data.auditId}`);
        return;
      }
      if (res.status === 403 && data.needsVerification) {
        setError("Tu email todavía no está verificado. Volvé a pedir el enlace de confirmación.");
        setStep("email");
      } else {
        setError(data.error ?? "No se pudo iniciar la auditoría.");
      }
      setSubmitting(false);
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
          Ingresá tu email y la URL de tu sitio y te damos un reporte completo: SEO técnico,
          on-page, datos estructurados, rendimiento (Core Web Vitals) y visibilidad en IA.
        </p>

        {step === "email" && (
          <form className={styles.form} onSubmit={handleEmailSubmit}>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              type="email"
              required
            />
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Enviando…" : "Continuar"}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}

        {step === "check-email" && (
          <div className={styles.form}>
            <p className={styles.success}>
              Te enviamos un enlace de confirmación a <strong>{email}</strong>. Abrilo para
              verificar tu email y poder lanzar tu auditoría.
            </p>
            {devVerifyUrl && (
              <p className={styles.hint}>
                Modo desarrollo (sin RESEND_API_KEY): <a href={devVerifyUrl}>{devVerifyUrl}</a>
              </p>
            )}
            <button className={styles.linkButton} onClick={() => setStep("email")} type="button">
              &larr; Usar otro email
            </button>
          </div>
        )}

        {step === "url" && (
          <form className={styles.form} onSubmit={handleUrlSubmit}>
            <p className={styles.success}>Email: {email}</p>
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
        )}

        <p className={styles.footnote}>
          Rastreamos hasta 500 URLs por sitio. El reporte se genera en una URL única que podés
          consultar o compartir en cualquier momento. 1 auditoría gratuita por semana por email.{" "}
          <Link href="/history">Ver historial &rarr;</Link>
        </p>
      </div>
    </main>
  );
}
