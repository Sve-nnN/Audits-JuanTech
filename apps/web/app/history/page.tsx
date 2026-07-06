import Link from "next/link";
import { prisma } from "@auditor/db";
import { normalizeEmail } from "@auditor/email";
import type { ScoreStatus } from "@auditor/scoring";
import styles from "../home.module.css";

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

const STATUS_LABEL: Record<ScoreStatus, string> = {
  good: "Bueno",
  needs_improvement: "Necesita mejora",
  critical: "Crítico",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const { email: rawEmail } = await searchParams;
  const trimmed = rawEmail?.trim() ?? "";
  const normalized = trimmed.length > 0 ? normalizeEmail(trimmed) : null;

  const emailRecord =
    normalized && normalized.valid
      ? await prisma.email.findUnique({ where: { normalizedAddress: normalized.normalizedAddress } })
      : null;

  const audits = emailRecord
    ? await prisma.audit.findMany({
        where: { emailId: emailRecord.id },
        include: { site: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 640 }}>
        <h1 className={styles.title}>Historial de auditorías</h1>
        <p className={styles.subtitle}>Consultá las auditorías previas asociadas a tu email.</p>

        <form className={styles.form} method="get">
          <input
            className={styles.input}
            name="email"
            type="email"
            placeholder="tu@email.com"
            defaultValue={trimmed}
            required
          />
          <button className={styles.button} type="submit">
            Buscar
          </button>
        </form>

        {trimmed.length > 0 && !emailRecord && (
          <p className={styles.error} style={{ marginTop: 16 }}>
            No encontramos auditorías para ese email.
          </p>
        )}

        {audits.length > 0 && (
          <table className={styles.table} style={{ marginTop: 20 }}>
            <thead>
              <tr>
                <th>Sitio</th>
                <th>Score</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => {
                const scores = audit.scores as { overall?: number; status?: ScoreStatus } | null;
                return (
                  <tr key={audit.id}>
                    <td>{audit.site.domain}</td>
                    <td>{scores?.overall ?? "—"}</td>
                    <td>{scores?.status ? STATUS_LABEL[scores.status] : audit.status}</td>
                    <td>{formatDate(audit.createdAt)}</td>
                    <td>
                      <Link href={`/audits/${audit.id}`}>Ver reporte &rarr;</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className={styles.footnote}>
          <Link href="/">&larr; Volver al inicio</Link>
        </p>
      </div>
    </main>
  );
}
