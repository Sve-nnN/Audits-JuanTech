import Link from "next/link";
import { notFound } from "next/navigation";
import { buildReportModel } from "@auditor/report-model";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ArchitectureMap } from "../../../components/ArchitectureMap";
import styles from "./arquitectura.module.css";

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
            enlaza desde la portada, con los conectores padre-hijo. Las huérfanas no tienen ruta de
            enlaces desde la home. Usa la rueda o los botones para acercar y alejar, y arrastra para
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
