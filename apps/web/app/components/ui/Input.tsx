"use client";

import styles from "./Input.module.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Aplica estilo de error y emite `aria-invalid="true"`. */
  invalid?: boolean;
  /** Tamaño del control. Default "md". */
  inputSize?: "md" | "lg";
}

/**
 * Input (COMP-06) — control de texto con estados default/hover/focus/disabled/
 * error. Base de los formularios de la app (email/URL en Fase 10).
 *
 * `font-size` de 16px (`--font-size-base`) para prevenir el zoom automático de
 * iOS al enfocar. El estado de error (`invalid`) pinta el borde en `--critical`
 * y emite `aria-invalid="true"`; el mensaje de error debe vivir en el `Field`
 * contenedor (nunca borde rojo solo).
 *
 * Reenvía `ref` y el resto de props al `<input>` nativo (React 19: `ref` es prop).
 */
export function Input({
  invalid = false,
  inputSize = "md",
  className,
  ...rest
}: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={[
        styles.input,
        inputSize === "lg" ? styles.lg : styles.md,
        invalid ? styles.invalid : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
