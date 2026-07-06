"use client";

import { Loader2, type LucideIcon } from "lucide-react";
import styles from "./Button.module.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Estilo visual del botón. Default "primary". */
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  /** Tamaño (altura mínima 36/44/48). Default "md". */
  size?: "sm" | "md" | "lg";
  /** Muestra spinner, marca `aria-busy` y deshabilita el botón. */
  loading?: boolean;
  /** Icono lucide a la izquierda del label (hereda currentColor). */
  iconLeft?: LucideIcon;
  /** Icono lucide a la derecha del label (hereda currentColor). */
  iconRight?: LucideIcon;
}

const VARIANT_CLASS: Record<
  NonNullable<ButtonProps["variant"]>,
  string | undefined
> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  destructive: styles.destructive,
};

const SIZE_CLASS: Record<NonNullable<ButtonProps["size"]>, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * Button (COMP-06) — primitivo de acción con 4 variantes, 3 tamaños y estado
 * loading. Base de todas las acciones (CTAs de home en Fase 10, EmptyState /
 * ErrorState en wave 3).
 *
 * Estados: hover (por variante), focus-visible (anillo lima de marca), disabled
 * (atributo real `disabled`, no solo visual) y loading (spinner `Loader2` con
 * `aria-busy`, botón deshabilitado y label conservado para estabilidad de ancho).
 *
 * Accesibilidad:
 *   - `<button type>` real; default "button" para no disparar submits accidentales.
 *   - Anillo de foco siempre visible.
 *   - Botón icon-only requiere `aria-label` (min 44×44 por tamaño md/lg).
 *   - La animación del spinner y las transiciones se anulan bajo
 *     `prefers-reduced-motion`.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? 18 : 16;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        styles.button,
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 className={styles.spinner} size={iconSize} aria-hidden="true" />
      ) : (
        IconLeft && <IconLeft size={iconSize} aria-hidden="true" />
      )}
      {children}
      {!loading && IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </button>
  );
}
