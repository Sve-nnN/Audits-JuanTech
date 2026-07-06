import type { ReactNode } from "react";
import { array, khand, geistSans, geistMono } from "./fonts";
import { Providers } from "./providers";
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
