import { Skeleton } from "../components/ui/Skeleton";
import styles from "./history.module.css";

/**
 * Fallback de Suspense para /history (App Router `loading.tsx`).
 *
 * Se renderiza mientras el server component normaliza el correo y lee el
 * historial de auditorías en Prisma. Espeja la tabla de resultados componiendo
 * el Skeleton (COMP-08). El anuncio accesible "Cargando…" vive aquí
 * (role="status"); el Skeleton siempre es decorativo (aria-hidden).
 */
export default function HistoryLoading() {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className={styles.caption}>Cargando historial de auditorías…</span>
      <div className={styles.container}>
        <h1 className={styles.title}>Historial de auditorías</h1>
        <p className={styles.subtitle}>
          Consulta las auditorías asociadas a tu correo.
        </p>

        <div className={styles.results}>
          <div className={styles.scroll}>
            <table className={styles.table}>
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
                {Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td>
                      <Skeleton variant="text" width={180} />
                    </td>
                    <td className={styles.mono}>
                      <Skeleton variant="text" width={32} />
                    </td>
                    <td>
                      <Skeleton variant="text" width={96} />
                    </td>
                    <td className={styles.mono}>
                      <Skeleton variant="text" width={140} />
                    </td>
                    <td>
                      <Skeleton variant="text" width={88} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
