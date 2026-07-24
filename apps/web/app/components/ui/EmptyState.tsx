"use client";

import type { Ref } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "./Button";
import buttonStyles from "./Button.module.css";
import styles from "./EmptyState.module.css";

type StateVariant = "empty" | "error" | "success";

interface StateAction {
  /** Texto visible de la acción. */
  label: string;
  /** Handler de click (acción in-app). */
  onClick?: () => void;
  /** Destino de navegación (ruta de app provista por el consumidor interno). */
  href?: string;
}

interface StateMessageProps {
  /** Eje visual y semántico. Default "empty". */
  variant?: StateVariant;
  /**
   * Ícono lucide (aria-hidden). Default: empty→Inbox, error→AlertTriangle,
   * success→CheckCircle2.
   *
   * SOLO pásalo explícito desde un Client Component ("use client"). Un
   * Server Component NUNCA debe pasar esto -- un componente lucide es una
   * función, y React no puede serializar funciones como prop hacia un Client
   * Component como este. Si necesitas otro ícono por defecto desde un Server
   * Component, usa `variant="success"` (o agrega un variant nuevo) en vez de
   * pasar `icon`. Confirmado en runtime ("Functions cannot be passed
   * directly to Client Components") la primera vez que una auditoría real
   * renderizó el caso "sin issues" de audits/[id]/page.tsx.
   */
  icon?: LucideIcon;
  /** Título. Si se omite, usa el placeholder voceo-free por variante. */
  title?: string;
  /** Descripción. Si se omite, usa el placeholder voceo-free por variante. */
  description?: string;
  /**
   * Nivel del heading del título (aria-level). Default 2. Permite anidar el
   * estado dentro de secciones del reporte (p. ej. paneles de categoría con
   * h3/h4) sin romper la jerarquía monotónica de encabezados.
   */
  titleLevel?: 2 | 3;
  /** Acción opcional (renderiza un Button). */
  action?: StateAction;
  /**
   * Ref opcional al heading del título. Permite que el consumidor mueva el
   * foco al propio título del estado (gestión de foco a11y) sin duplicar un
   * heading sr-only aparte.
   */
  titleRef?: Ref<HTMLParagraphElement>;
  /** tabIndex opcional del heading (p. ej. -1 para foco programático). */
  titleTabIndex?: number;
}

/**
 * Copy placeholders voceo-free (UI-SPEC COMP-07 L385-393). Sin em/en dashes.
 * La redacción final humanizada aterriza en Fase 10 (COPY-01/02).
 */
const DEFAULT_COPY: Record<
  StateVariant,
  { icon: LucideIcon; title: string; description: string }
> = {
  empty: {
    icon: Inbox,
    title: "Todavia no hay nada por aca",
    description:
      "Cuando tengas datos para mostrar, van a aparecer en esta seccion. Empieza una auditoria para verlos.",
  },
  error: {
    icon: AlertTriangle,
    title: "Algo salio mal",
    description:
      "No pudimos cargar esta informacion. Recarga e intentalo de nuevo; si sigue fallando, escribenos.",
  },
  success: {
    icon: CheckCircle2,
    title: "Todo en orden",
    description: "",
  },
};

/**
 * EmptyState (COMP-07) — mensaje de estado "sin datos" / fallo con forma fija:
 * chip de ícono + título + descripción + acción opcional. Cubre el vacío de
 * cualquier vista (incluido el estado vacío de IssuesTable en wave 4).
 *
 * Accesibilidad:
 *   - El ícono es `aria-hidden` (el texto porta el significado).
 *   - Contenedor `role="status"` (empty) o `role="alert"` (error, anuncia fallo).
 *   - El título es un heading (`role="heading"`, nivel configurable vía
 *     `titleLevel`, default 2) para el árbol de a11y.
 *   - La acción es un Button real con anillo de foco visible.
 */
export function EmptyState({
  variant = "empty",
  icon,
  title,
  description,
  titleLevel = 2,
  action,
  titleRef,
  titleTabIndex,
}: StateMessageProps) {
  const isError = variant === "error";
  const copy = DEFAULT_COPY[variant];
  const Icon = icon ?? copy.icon;
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const buttonVariant = isError ? "secondary" : "primary";

  /**
   * Renderiza la acción opcional respetando el router de Next:
   *   - `onClick` → `<Button>` real (precedencia sobre `href`).
   *   - `href` interno (empieza con "/") → `<Link>` estilizado como Button
   *     (navegación SPA, sin recarga completa ni pérdida de estado).
   *   - `href` externo http(s) → `<a target="_blank" rel="noreferrer">`.
   *   - Cualquier otro esquema (javascript:, data:, mailto:, etc.) se descarta
   *     por seguridad: no se renderiza la acción.
   */
  const renderAction = () => {
    if (!action) return null;

    if (action.onClick) {
      return (
        <Button variant={buttonVariant} onClick={action.onClick}>
          {action.label}
        </Button>
      );
    }

    if (action.href) {
      const href = action.href;
      const buttonClassName = [
        buttonStyles.button,
        buttonStyles.md,
        buttonStyles[buttonVariant],
      ]
        .filter(Boolean)
        .join(" ");

      if (href.startsWith("/")) {
        return (
          <Link href={href} className={buttonClassName}>
            {action.label}
          </Link>
        );
      }

      if (/^https?:\/\//i.test(href)) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName}
          >
            {action.label}
          </a>
        );
      }

      // Esquema no permitido: se omite la acción (evita vector javascript:).
      return null;
    }

    return null;
  };

  return (
    <div
      className={[styles.container, isError ? styles.error : null]
        .filter(Boolean)
        .join(" ")}
      role={isError ? "alert" : "status"}
    >
      <span className={styles.chip} aria-hidden="true">
        <Icon size={32} />
      </span>
      <p
        className={styles.title}
        role="heading"
        aria-level={titleLevel}
        ref={titleRef}
        tabIndex={titleTabIndex}
      >
        {resolvedTitle}
      </p>
      {resolvedDescription ? (
        <p className={styles.description}>{resolvedDescription}</p>
      ) : null}
      {renderAction()}
    </div>
  );
}

/**
 * ErrorState (COMP-07) — atajo tipado de `EmptyState` con `variant="error"`.
 * Anuncia el fallo (`role="alert"`) y usa el color crítico en el chip.
 */
export function ErrorState(props: Omit<StateMessageProps, "variant">) {
  return <EmptyState variant="error" {...props} />;
}
