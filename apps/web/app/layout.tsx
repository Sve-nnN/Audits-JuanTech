import type { ReactNode } from "react";

export const metadata = {
  title: "Auditor",
  description: "Auditoría web SEO/técnica automatizada",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
