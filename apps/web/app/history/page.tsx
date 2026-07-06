import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@auditor/db";
import { normalizeEmail } from "@auditor/email";
import type { ScoreStatus } from "@auditor/scoring";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeVariant } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { STATUS_LABEL } from "../components/ui/labels";
import { Reveal } from "../components/motion/useReveal";
import styles from "./history.module.css";

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

/** Mapa estado de score → variante de Badge (DS-02: good/warning/critical). */
const STATUS_BADGE: Record<ScoreStatus, BadgeVariant> = {
  good: "ok",
  needs_improvement: "warning",
  critical: "critical",
};

/** Fecha en locale "es" neutro (no rioplatense), igual que el reporte. */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HistoryPage({ searchParams }: PageProps) {
  // Data-fetching v1.0 preservado: normalizeEmail + reads Prisma + form GET.
  const { email: rawEmail } = await searchParams;
  const trimmed = rawEmail?.trim() ?? "";
  const normalized = trimmed.length > 0 ? normalizeEmail(trimmed) : null;

  const emailRecord =
    normalized && normalized.valid
      ? await prisma.email.findUnique({
          where: { normalizedAddress: normalized.normalizedAddress },
        })
      : null;

  const audits = emailRecord
    ? await prisma.audit.findMany({
        where: { emailId: emailRecord.id },
        include: { site: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const hasSearched = trimmed.length > 0;
  const notFound = hasSearched && audits.length === 0;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Historial de auditorías</h1>
        <p className={styles.subtitle}>
          Consulta las auditorías asociadas a tu correo.
        </p>

        <form className={styles.form} method="get">
          <div className={styles.fieldWrap}>
            <Field label="Correo" htmlFor="email">
              <Input
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                defaultValue={trimmed}
                className={styles.searchInput}
                required
              />
            </Field>
          </div>
          <Button type="submit" className={styles.searchButton}>
            Buscar
          </Button>
        </form>

        <div className={styles.results}>
          {audits.length > 0 ? (
            <Reveal
              as="div"
              className={styles.scroll}
              tabIndex={0}
              role="region"
              aria-label="Historial de auditorías"
            >
              <table className={styles.table}>
                <caption className={styles.caption}>
                  Historial de auditorías
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Sitio</th>
                    <th scope="col">Score</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">
                      <span className={styles.caption}>Reporte</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((audit) => {
                    const scores = audit.scores as {
                      overall?: number;
                      status?: ScoreStatus;
                    } | null;
                    const status = scores?.status;
                    return (
                      <tr key={audit.id}>
                        <td>{audit.site.domain}</td>
                        <td className={styles.mono}>{scores?.overall ?? "—"}</td>
                        <td>
                          {status ? (
                            <Badge variant={STATUS_BADGE[status]}>
                              {STATUS_LABEL[status]}
                            </Badge>
                          ) : (
                            audit.status
                          )}
                        </td>
                        <td className={styles.mono}>
                          {formatDate(audit.createdAt)}
                        </td>
                        <td>
                          <Link
                            href={`/audits/${audit.id}`}
                            className={styles.reportLink}
                          >
                            Ver reporte
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Reveal>
          ) : notFound ? (
            <EmptyState
              title="No encontramos auditorías para ese correo."
              description=""
            />
          ) : (
            <EmptyState
              title="Ingresa tu correo para ver tus auditorías anteriores."
              description=""
            />
          )}
        </div>

        <p className={styles.footnote}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
