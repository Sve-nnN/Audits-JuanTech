"use client";

import { cloneElement, isValidElement } from "react";
import { AlertCircle } from "lucide-react";
import styles from "./Field.module.css";

interface FieldProps {
  /** Texto del label asociado al control. */
  label: string;
  /** `id` del control hijo; se usa para `htmlFor` y para inyectar `id`. */
  htmlFor: string;
  /** Ayuda contextual. Se oculta cuando hay `error`. */
  hint?: string;
  /** Mensaje de error; reemplaza al hint y activa el estado inválido. */
  error?: string;
  /** Marca el campo como obligatorio (marcador visual + texto accesible). */
  required?: boolean;
  /** El control del formulario (se espera un `Input`). */
  children: React.ReactNode;
}

/** Props que se inyectan al control hijo vía cloneElement. */
type InjectedControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  invalid?: boolean;
};

/**
 * Field (COMP-06) — wrapper de formulario accesible: label + hint/error + control.
 *
 * Asocia el `<label htmlFor>` al control y enlaza hint o error mediante
 * `aria-describedby`. Cuando hay `error`, reemplaza al hint, lo anuncia con
 * `role="alert"` y marca el control con `aria-invalid="true"` — nunca depende
 * solo del borde rojo: el texto de error es obligatorio.
 *
 * El control llega como `children`; se clona con `React.cloneElement` para
 * inyectarle `id={htmlFor}`, `aria-describedby` (id del hint/error) y, en error,
 * `aria-invalid`/`invalid`. El hijo esperado es un `Input` (o control nativo que
 * acepte esas props).
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
}: FieldProps) {
  const hasError = Boolean(error);
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = hasError ? `${htmlFor}-error` : undefined;
  const describedBy = hasError ? errorId : hintId;

  let control: React.ReactNode = children;
  if (isValidElement(children)) {
    const childProps = (children as React.ReactElement<InjectedControlProps>)
      .props;
    // Fusiona (no sobrescribe) el `aria-describedby` que el hijo ya trajera con
    // los ids de hint/error; si no hay ninguno queda `undefined` en vez de "".
    const childDescribedBy = childProps["aria-describedby"];
    const mergedDescribedBy =
      [describedBy, childDescribedBy].filter(Boolean).join(" ") || undefined;
    control = cloneElement(
      children as React.ReactElement<InjectedControlProps>,
      {
        // Preserva el id propio del hijo; solo genera uno si falta.
        id: childProps.id ?? htmlFor,
        "aria-describedby": mergedDescribedBy,
        ...(hasError ? { "aria-invalid": true, invalid: true } : {}),
      },
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required && (
          <>
            <span className={styles.required} aria-hidden="true">
              {" "}
              *
            </span>
            <span className={styles.srOnly}> obligatorio</span>
          </>
        )}
      </label>

      {control}

      {hasError ? (
        <p id={errorId} role="alert" className={styles.error}>
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
