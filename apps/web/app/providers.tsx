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
 *   - defaultTheme="system" + enableSystem: en la primera visita, sin preferencia
 *     guardada, se respeta prefers-color-scheme del sistema como valor inicial. Si
 *     el sistema no resuelve preferencia, el :root dark-first de tokens.css deja la
 *     app en oscuro (la marca sigue siendo dark-first como fallback efectivo).
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
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
