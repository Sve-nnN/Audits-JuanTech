"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import styles from "./ThemeToggle.module.css";

/**
 * ThemeToggle — botón icon-only que alterna entre modo claro y oscuro.
 *
 * Usa next-themes (useTheme) para leer el tema resuelto y persistir el cambio.
 * Guard de hidratación con un flag `mounted`: hasta montar en cliente no se conoce
 * el tema real (el server no puede saber la preferencia de localStorage/sistema),
 * así que se renderiza un placeholder inerte para evitar hydration mismatch y FOUC
 * del propio control.
 *
 * Accesibilidad:
 *   - <button> nativo → operable por teclado.
 *   - aria-label describe la acción según el tema activo (español neutro, sin voceo).
 *   - target ≥44×44px y focus-visible con ring de marca.
 *   - respeta prefers-reduced-motion (sin animación de íconos si el usuario lo pide).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Antes de montar: placeholder del mismo tamaño, sin estado de tema ni label
  // accionable (evita mismatch servidor/cliente).
  if (!mounted) {
    return (
      <button
        type="button"
        className={styles.toggle}
        aria-hidden="true"
        tabIndex={-1}
        disabled
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        // Ícono sol (acción: ir a claro)
        <svg
          className={styles.icon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Ícono luna (acción: ir a oscuro)
        <svg
          className={styles.icon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
