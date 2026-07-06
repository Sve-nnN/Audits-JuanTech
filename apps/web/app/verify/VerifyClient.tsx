"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/EmptyState";
import buttonStyles from "../components/ui/Button.module.css";
import styles from "./verify.module.css";

interface VerifyClientProps {
  token: string | null;
  consentText: string;
}

type Status = "idle" | "verifying" | "done" | "error";
type ErrorKind = "generic" | "expired" | "network";

export function VerifyClient({ token, consentText }: VerifyClientProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
  const [email, setEmail] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorTitleRef = useRef<HTMLParagraphElement>(null);

  // Mueve el foco al heading del resultado al cambiar de estado (a11y).
  // En error, el foco va al propio título de ErrorState (evita duplicar un
  // heading sr-only con el mismo texto que anunciaría el lector dos veces).
  useEffect(() => {
    if (status === "error") {
      errorTitleRef.current?.focus();
    } else if (status === "done") {
      headingRef.current?.focus();
    }
  }, [status]);

  // ── Data-fetching preservado verbatim: máquina Status + único POST /api/verify.
  async function handleConfirm() {
    if (!token || status === "verifying") return;
    setStatus("verifying");
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
        const message: string = data.error ?? "No se pudo verificar el email.";
        setErrorKind(/expir|inv[aá]lid|usado|caduc/i.test(message) ? "expired" : "generic");
        setStatus("error");
      }
    } catch {
      setErrorKind("network");
      setStatus("error");
    }
  }

  // Estado: token faltante en el enlace.
  if (!token) {
    return (
      <div className={styles.state}>
        <ErrorState
          title="Falta el token de verificación"
          description="El enlace está incompleto. Ábrelo de nuevo desde el correo que te enviamos."
          action={{ label: "Volver al inicio", href: "/" }}
        />
      </div>
    );
  }

  // Estado: éxito.
  if (status === "done") {
    return (
      <div className={styles.state} role="status">
        <span className={styles.successChip}>
          <CheckCircle2 size={40} aria-hidden="true" />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
          Correo confirmado
        </h2>
        <p className={styles.body}>
          Listo. Ya puedes lanzar tu auditoría gratuita{email ? ` con ${email}` : ""}.
        </p>
        <Link
          href={`/${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          className={[
            buttonStyles.button,
            buttonStyles.md,
            buttonStyles.primary,
            styles.action,
          ].join(" ")}
        >
          Continuar a mi auditoría
        </Link>
      </div>
    );
  }

  // Estado: error (genérico / expirado / red).
  if (status === "error") {
    const isExpired = errorKind === "expired";
    const title = isExpired
      ? "El enlace ya no es válido"
      : "No pudimos verificar tu correo";
    const description =
      errorKind === "network"
        ? "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
        : isExpired
          ? "Este enlace de verificación expiró o ya se usó. Vuelve al inicio y solicita uno nuevo."
          : "El enlace no se pudo validar. Pide uno nuevo desde el inicio e inténtalo otra vez.";

    return (
      <div className={styles.state}>
        <ErrorState
          title={title}
          description={description}
          titleRef={errorTitleRef}
          titleTabIndex={-1}
          action={{ label: "Volver al inicio", href: "/" }}
        />
      </div>
    );
  }

  // Estado: idle (consentimiento + confirmación explícita) / verifying (loading).
  return (
    <div className={styles.state}>
      <ShieldCheck className={styles.icon} size={32} aria-hidden="true" />
      <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
        Confirma tu correo
      </h2>
      <p className={styles.consent}>{consentText}</p>
      <Button
        className={styles.action}
        onClick={handleConfirm}
        loading={status === "verifying"}
      >
        {status === "verifying" ? "Confirmando…" : "Confirmar y aceptar"}
      </Button>
    </div>
  );
}
