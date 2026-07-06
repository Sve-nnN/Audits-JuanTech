"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../home.module.css";

interface VerifyClientProps {
  token: string | null;
  consentText: string;
}

type Status = "idle" | "verifying" | "done" | "error";

export function VerifyClient({ token, consentText }: VerifyClientProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function handleConfirm() {
    if (!token || status === "verifying") return;
    setStatus("verifying");
    setError(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consentText }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(data.email ?? null);
        setStatus("done");
      } else {
        setError(data.error ?? "No se pudo verificar el email.");
        setStatus("error");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("error");
    }
  }

  if (!token) {
    return <p className={styles.subtitle}>Falta el token de verificación en el enlace.</p>;
  }

  if (status === "done") {
    return (
      <>
        <p className={styles.subtitle}>
          Email confirmado{email ? ` (${email})` : ""}. Ya podés lanzar tu auditoría gratuita.
        </p>
        <Link className={styles.button} style={{ display: "inline-block", textAlign: "center" }} href={`/${email ? `?email=${encodeURIComponent(email)}` : ""}`}>
          Continuar a mi auditoría &rarr;
        </Link>
      </>
    );
  }

  return (
    <>
      <p className={styles.subtitle}>{consentText}</p>
      <button className={styles.button} onClick={handleConfirm} disabled={status === "verifying"}>
        {status === "verifying" ? "Confirmando…" : "Confirmar y aceptar"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
