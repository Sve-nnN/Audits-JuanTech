import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@auditor/db";
import { buildReportModel } from "@auditor/report-model";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ArchitectureMap } from "../../../components/ArchitectureMap";
import styles from "./arquitectura.module.css";

// Self-hosted deploy (Dokploy/Nixpacks-or-custom-Dockerfile) builds may run
// isolated from the DB/Redis network -- force dynamic (request-time)
// rendering defensively so `next build` never attempts to touch Prisma/Redis
// during static generation.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Página dedicada al mapa de arquitectura del sitio a pantalla completa. Reusa el
 * mismo `architecture` del reporte (buildReportModel) y lo renderiza dentro de
 * `ArchitectureMap`, un viewport navegable con zoom/pan/reset. Si la auditoría no
 * tiene grafo, muestra un empty state con el link de vuelta al reporte.
 */
export default async function AuditArchitecturePage({ params }: PageProps) {
  const { id: auditId } = await params;

  // WR-02: distinguish "audit doesn't exist" (404) from "audit not done yet"
  // (buildReportModel returns null for both) — an in-progress audit should link
  // back to the report (which shows live progress), not a hard 404.
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { status: true },
  });
  if (!audit) notFound();

  if (audit.status !== "done") {
    return (
      <div className={styles.main}>
        <p className={styles.breadcrumb}>
          <Link href={`/audits/${auditId}`}>&larr; Volver al reporte</Link>
        </p>
        <h1 className={styles.title}>Mapa de arquitectura del sitio</h1>
        <EmptyState
          title="La auditoría todavía está en proceso"
          description="El mapa de arquitectura estará disponible cuando la auditoría termine. Volvé al reporte para ver el progreso."
        />
      </div>
    );
  }

  const model = await buildReportModel(auditId);
  if (!model) notFound();

  return (
    <div className={styles.main}>
      <p className={styles.breadcrumb}>
        <Link href={`/audits/${auditId}`}>&larr; Volver al reporte</Link>
      </p>
      <h1 className={styles.title}>Mapa de arquitectura del sitio</h1>

      {model.architecture ? (
        <>
          <p className={styles.note}>
            Jerarquía de páginas del sitio: cada página cuelga de la de menor profundidad que la
            enlaza desde la portada, con los conectores padre-hijo. Las huérfanas no reciben enlaces internos desde ninguna página del sitio. Usa la rueda o los botones para acercar y alejar, y arrastra para
            desplazarte.
          </p>
          <ArchitectureMap architecture={model.architecture} />
        </>
      ) : (
        <EmptyState
          title="Sin arquitectura del sitio"
          description="Esta auditoría no tiene datos de arquitectura (grafo de enlaces)."
        />
      )}
    </div>
  );
}
