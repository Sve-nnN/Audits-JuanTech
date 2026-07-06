import { Skeleton } from "../../components/ui/Skeleton";
import styles from "./report.module.css";

/**
 * Fallback de Suspense para /audits/[id] (App Router `loading.tsx`).
 *
 * Se renderiza mientras el server component hace fetch de la auditoría e issues.
 * Espeja la estructura del reporte (hero con gauge + grid de categorías +
 * filas de issues) componiendo el Skeleton (COMP-08) — no construye placeholders
 * propios. El anuncio accesible "Cargando…" vive aquí (role="status"); el
 * Skeleton siempre es decorativo (aria-hidden).
 */
export default function AuditReportLoading() {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className={styles.srOnly}>Cargando auditoría…</span>
      <div className={styles.container}>
        {/* Breadcrumb */}
        <p className={styles.breadcrumb}>
          <Skeleton variant="text" width={72} />
        </p>

        {/* Header: dominio + meta */}
        <div className={styles.header}>
          <div>
            <Skeleton variant="block" width={260} height={40} />
            <p className={styles.meta}>
              <Skeleton variant="text" width={220} />
            </p>
          </div>
          <Skeleton variant="text" width={200} />
        </div>

        {/* Score hero: gauge + cuerpo */}
        <section className={styles.section}>
          <div className={styles.hero}>
            <div className={styles.heroGauge}>
              <Skeleton variant="gauge" />
            </div>
            <div className={styles.heroBody}>
              <Skeleton variant="block" width={180} height={28} />
              <Skeleton variant="text" lines={3} />
            </div>
          </div>
        </section>

        {/* Scores por categoría */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Skeleton variant="block" width={220} height={24} />
          </h3>
          <div className={styles.categoryGrid}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        </section>

        {/* Issues prioritarios */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Skeleton variant="block" width={200} height={24} />
          </h3>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.loadingRow}>
              <Skeleton variant="row" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
