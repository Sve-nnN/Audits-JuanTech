"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

/**
 * Providers — envoltorio de contextos cliente a nivel de app.
 *
 * Monta el ThemeProvider de next-themes con la estrategia de theming del design
 * system (DS-03):
 *   - attribute="data-theme": el tema se aplica como [data-theme="..."] en <html>,
 *     coincidiendo con los overrides de tokens.css ([data-theme="light"]).
 *   - defaultTheme="dark": la marca es dark-first; sin preferencia guardada ni de
 *     sistema, la app arranca en oscuro.
 *   - enableSystem: respeta prefers-color-scheme como valor inicial.
 *   - disableTransitionOnChange: evita transiciones de color al alternar tema.
 *
 * La persistencia en localStorage es el comportamiento por defecto de next-themes.
 * El script de resolución que inyecta next-themes corre antes del paint, por lo que
 * no hay flash de tema incorrecto (requiere suppressHydrationWarning en <html>).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
