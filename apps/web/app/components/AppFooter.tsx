import Link from "next/link";
import styles from "./shell.module.css";

/**
 * AppFooter — pie compartido por todas las pantallas.
 *
 * Server component (sin estado ni interacción): wordmark de marca, enlaces
 * mínimos de navegación y la línea de copyright. Contenido constreñido al
 * contenedor con el gutter del shell. Textos en español neutro, sin voceo.
 */
export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <Link href="/" className={styles.wordmark}>
          <span>Auditor</span>
          <span className={styles.wordmarkAccent} aria-hidden="true">
            .
          </span>
        </Link>

        <nav className={styles.footerLinks} aria-label="Enlaces del pie">
          <Link href="/" className={styles.footerLink}>
            Auditar
          </Link>
          <Link href="/history" className={styles.footerLink}>
            Historial
          </Link>
        </nav>

        <span className={styles.spacer} aria-hidden="true" />

        <p className={styles.copyright}>
          © 2026 juan-tech.com. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
