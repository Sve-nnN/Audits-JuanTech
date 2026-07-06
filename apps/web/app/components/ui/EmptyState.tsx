"use client";

import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "./Button";
import styles from "./EmptyState.module.css";

type StateVariant = "empty" | "error";

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
  /** Ícono lucide (aria-hidden). Default: empty→Inbox, error→AlertTriangle. */
  icon?: LucideIcon;
  /** Título. Si se omite, usa el placeholder voceo-free por variante. */
  title?: string;
  /** Descripción. Si se omite, usa el placeholder voceo-free por variante. */
  description?: string;
  /** Acción opcional (renderiza un Button). */
  action?: StateAction;
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
};

/**
 * EmptyState (COMP-07) — mensaje de estado "sin datos" / fallo con forma fija:
 * chip de ícono + título + descripción + acción opcional. Cubre el vacío de
 * cualquier vista (incluido el estado vacío de IssuesTable en wave 4).
 *
 * Accesibilidad:
 *   - El ícono es `aria-hidden` (el texto porta el significado).
 *   - Contenedor `role="status"` (empty) o `role="alert"` (error, anuncia fallo).
 *   - El título es un heading (`role="heading"` nivel 2) para el árbol de a11y.
 *   - La acción es un Button real con anillo de foco visible.
 */
export function EmptyState({
  variant = "empty",
  icon,
  title,
  description,
  action,
}: StateMessageProps) {
  const isError = variant === "error";
  const copy = DEFAULT_COPY[variant];
  const Icon = icon ?? copy.icon;
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;

  const handleAction = action?.onClick
    ? action.onClick
    : action?.href
      ? () => {
          window.location.assign(action.href as string);
        }
      : undefined;

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
      <p className={styles.title} role="heading" aria-level={2}>
        {resolvedTitle}
      </p>
      {resolvedDescription ? (
        <p className={styles.description}>{resolvedDescription}</p>
      ) : null}
      {action ? (
        <Button
          variant={isError ? "secondary" : "primary"}
          onClick={handleAction}
        >
          {action.label}
        </Button>
      ) : null}
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
