"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, MailCheck } from "lucide-react";
import { Field } from "./components/ui/Field";
import { Input } from "./components/ui/Input";
import { Button } from "./components/ui/Button";
import { Badge } from "./components/ui/Badge";
import { Reveal, useReveal } from "./components/motion/useReveal";
import styles from "./home.module.css";

type Step = "email" | "check-email" | "url";

/** Error del flujo: `field` se muestra en el Field del control; `form` es un
 * error de nivel superior (fallo de red o de verificación) anunciado arriba. */
type FlowError = { scope: "field" | "form"; message: string } | null;

/** Chips de densidad "qué revisamos" (no interactivos, decorativos). */
const CATEGORY_CHIPS = [
  "SEO Técnico",
  "On-Page",
  "Datos Estructurados",
  "Rendimiento",
  "AEO",
];

interface HomeClientProps {
  initialEmail: string;
}

export function HomeClient({ initialEmail }: HomeClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialEmail ? "url" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FlowError>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  const heroRef = useReveal<HTMLElement>();
  const cardRef = useReveal<HTMLElement>();

  const checkHeadingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // Al avanzar de paso, mover foco al primer control/heading del nuevo paso.
  // No robar el foco en el render inicial (evita saltos al cargar la página).
  // Field inyecta el id ("email"/"url") en el Input hijo, así que resolvemos el
  // control por id en vez de un ref (InputProps no expone `ref` en su tipo).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (step === "email") document.getElementById("email")?.focus();
    else if (step === "check-email") checkHeadingRef.current?.focus();
    else if (step === "url") document.getElementById("url")?.focus();
  }, [step]);

  // --- Data-fetching preservado de v1.0 (misma máquina de estados y ramas) ---

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
        setError({
          scope: "field",
          message:
            data.error ??
            "No pudimos procesar el correo. Revísalo e inténtalo de nuevo.",
        });
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
      setError({
        scope: "form",
        message:
          "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
      });
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
        setError({
          scope: "form",
          message:
            "Tu correo todavía no está verificado. Pide de nuevo el enlace de confirmación.",
        });
        setStep("email");
      } else {
        setError({
          scope: "field",
          message:
            data.error ??
            "No pudimos iniciar la auditoría. Inténtalo de nuevo en un momento.",
        });
      }
      setSubmitting(false);
    } catch {
      setError({
        scope: "form",
        message:
          "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
      });
      setSubmitting(false);
    }
  }

  const fieldError = error?.scope === "field" ? error.message : undefined;
  const formError = error?.scope === "form" ? error.message : null;

  return (
    <main className={styles.home}>
      <div className={styles.shell}>
        <header ref={heroRef} data-reveal="" className={styles.hero}>
          <h1 className={styles.heroTitle}>Audita tu sitio en minutos</h1>
          <p className={styles.heroSubtitle}>
            Ingresa tu correo y la URL de tu sitio para recibir un reporte
            completo: SEO técnico, on-page, datos estructurados, rendimiento
            (Core Web Vitals) y visibilidad en IA.
          </p>
        </header>

        <section
          ref={cardRef}
          data-reveal=""
          className={styles.flowCard}
          aria-label="Flujo de auditoría"
        >
          <div key={step} className={styles.stepBody}>
            {formError && (
              <p role="alert" className={styles.formError}>
                {formError}
              </p>
            )}

            {step === "email" && (
              <form className={styles.homeForm} onSubmit={handleEmailSubmit}>
                <Field
                  label="Correo"
                  htmlFor="email"
                  hint="Te enviamos un enlace de verificación para confirmarlo."
                  error={fieldError}
                >
                  <Input
                    type="email"
                    inputSize="lg"
                    className={styles.mono}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                    required
                  />
                </Field>
                <Button size="lg" loading={submitting} type="submit">
                  {submitting ? "Enviando…" : "Continuar"}
                </Button>
              </form>
            )}

            {step === "check-email" && (
              <div className={styles.checkPanel}>
                <MailCheck
                  size={32}
                  className={styles.checkIcon}
                  aria-hidden="true"
                />
                <h2
                  ref={checkHeadingRef}
                  tabIndex={-1}
                  className={styles.checkTitle}
                >
                  Revisa tu correo
                </h2>
                <p className={styles.checkBody}>
                  Enviamos un enlace de confirmación a <strong>{email}</strong>.
                  Ábrelo para verificar tu correo y lanzar tu auditoría.
                </p>
                {devVerifyUrl && (
                  <p className={styles.devNote}>
                    Modo desarrollo (sin RESEND_API_KEY):{" "}
                    <a className={styles.devLink} href={devVerifyUrl}>
                      {devVerifyUrl}
                    </a>
                  </p>
                )}
                <Button
                  variant="ghost"
                  iconLeft={ArrowLeft}
                  onClick={() => setStep("email")}
                  type="button"
                >
                  Usar otro correo
                </Button>
              </div>
            )}

            {step === "url" && (
              <form className={styles.homeForm} onSubmit={handleUrlSubmit}>
                <p className={styles.confirmedLine}>
                  <CheckCircle2
                    size={16}
                    className={styles.confirmedIcon}
                    aria-hidden="true"
                  />
                  Correo verificado: {email}
                </p>
                <Field label="URL del sitio" htmlFor="url" error={fieldError}>
                  <Input
                    type="url"
                    inputSize="lg"
                    className={styles.mono}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://tu-dominio.com"
                    required
                  />
                </Field>
                <Button size="lg" loading={submitting} type="submit">
                  {submitting ? "Encolando tu auditoría…" : "Auditar mi sitio"}
                </Button>
              </form>
            )}
          </div>
        </section>

        <div className={styles.chips}>
          {CATEGORY_CHIPS.map((label, i) => (
            <Reveal
              as="span"
              key={label}
              delay={i * 60}
              className={styles.chip}
            >
              <Badge variant="neutral">{label}</Badge>
            </Reveal>
          ))}
        </div>

        <p className={styles.foot}>
          Rastreamos hasta 500 URLs por sitio. El reporte queda en una URL única
          que puedes consultar o compartir cuando quieras. Incluye 1 auditoría
          gratuita por semana por correo.{" "}
          <Link className={styles.footLink} href="/history">
            Ver historial
          </Link>
        </p>
      </div>
    </main>
  );
}
