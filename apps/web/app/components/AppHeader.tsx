"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./shell.module.css";

/**
 * AppHeader — cabecera sticky compartida por todas las pantallas.
 *
 * Cliente porque monta el ThemeToggle (control de tema con estado de cliente).
 * Contenido de izquierda a derecha: wordmark de marca que enlaza al inicio,
 * navegación primaria (Auditar / Historial), spacer y el control de tema.
 * Textos en español neutro, sin voceo.
 */
export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link
          href="/"
          className={styles.wordmark}
          aria-label="Auditor, ir al inicio"
        >
          <span>Auditor</span>
          <span className={styles.wordmarkAccent} aria-hidden="true">
            .
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Navegación principal">
          <Link href="/" className={styles.navLink}>
            Auditar
          </Link>
          <Link href="/history" className={styles.navLink}>
            Historial
          </Link>
        </nav>

        <span className={styles.spacer} aria-hidden="true" />

        <ThemeToggle />
      </div>
    </header>
  );
}
