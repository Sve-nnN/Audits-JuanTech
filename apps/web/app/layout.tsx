import type { ReactNode } from "react";
import { array, khand, geistSans, geistMono } from "./fonts";
import { Providers } from "./providers";
import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";
import shell from "./components/shell.module.css";
import "./globals.css";

export const metadata = {
  title: "Auditor",
  description: "Auditoría web SEO/técnica automatizada",
};

const fontVariables = [
  array.variable,
  khand.variable,
  geistSans.variable,
  geistMono.variable,
].join(" ");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers>
          {/* Skip-to-content (A11Y-03): primer elemento enfocable; salta el
           * header y lleva el foco al contenido principal. Oculto hasta recibir
           * foco por teclado (ver .skipLink en globals.css). */}
          <a href="#main-content" className="skipLink">
            Saltar al contenido
          </a>
          <div className={shell.shell}>
            <AppHeader />
            <main id="main-content" className={shell.main}>
              {children}
            </main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
