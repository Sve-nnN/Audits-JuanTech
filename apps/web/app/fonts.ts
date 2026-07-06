import localFont from "next/font/local";
import { Khand } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

/**
 * Módulo central de tipografías de marca.
 *
 * Declara las cuatro familias con su CSS variable y `font-display: swap`.
 * Este módulo NO aplica las fuentes al DOM: solo las define. El wiring de las
 * `.variable` al `<html>` ocurre en layout.tsx (plan 08-03).
 *
 * Todas son self-hosted por `next/font` en build (Array vía woff2 local, Khand
 * vía next/font/google que self-hostea el binario, Geist vía el paquete `geist`).
 * No hay ningún `<link>` a CDN de fuentes en runtime (intención CSP-safe del repo).
 */

// Array — display, un solo peso (400). woff2 self-hosted bajo app/fonts/.
export const array = localFont({
  src: [
    {
      path: "./fonts/Array-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-array",
  display: "swap",
  fallback: ["Khand", "system-ui", "sans-serif"],
});

// Khand — headings / UI. Pesos 400/500/600/700 (self-hosted por next/font/google en build).
export const khand = Khand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-khand",
  display: "swap",
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});

// Geist Sans / Mono — vienen del paquete `geist`, que ya fija internamente
// `--font-geist-sans` / `--font-geist-mono` con `display: swap`. Se re-exportan
// tal cual para que layout.tsx aplique sus `.variable`.
export const geistSans = GeistSans;
export const geistMono = GeistMono;
