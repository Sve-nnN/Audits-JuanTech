import { Skeleton } from "../../../components/ui/Skeleton";
import styles from "./pages.module.css";

/**
 * Fallback de Suspense para /audits/[id]/pages (App Router `loading.tsx`).
 *
 * Se renderiza mientras el server component lee las páginas rastreadas en
 * Prisma. Espeja la lista de filas componiendo el Skeleton (COMP-08). El
 * anuncio accesible "Cargando…" vive aquí (role="status"); el Skeleton siempre
 * es decorativo (aria-hidden).
 */
export default function AuditPagesLoading() {
  return (
    <div className={styles.main} role="status" aria-live="polite">
      <span className={styles.srOnly}>Cargando páginas rastreadas…</span>
      <p className={styles.breadcrumb}>
        <Skeleton variant="text" width={64} />
      </p>
      <h1 className={styles.title}>
        <Skeleton variant="block" width={280} height={28} />
      </h1>

      <ul className={styles.list}>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className={styles.row}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width={120} />
          </li>
        ))}
      </ul>
    </div>
  );
}
