"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import styles from "./GroupingToggle.module.css";

interface GroupingToggleProps {
  /** Bloque "Detalle por categoría" ya renderizado por el server component. */
  byType: ReactNode;
  /** Bloque "Detalle por plantilla" ya renderizado por el server component. */
  byTemplate: ReactNode;
}

/**
 * GroupingToggle — alterna entre dos árboles ya renderizados server-side
 * (issuesByCategory / issuesByTemplate) sin disparar ningún fetch: ambos
 * datasets ya llegaron en el ReportModel serializado con la página (T-19-03).
 */
export function GroupingToggle({ byType, byTemplate }: GroupingToggleProps) {
  const [mode, setMode] = useState<"type" | "template">("type");

  return (
    <div>
      <div role="tablist" aria-label="Agrupar issues por" className={styles.tabs}>
        <Button
          type="button"
          role="tab"
          aria-selected={mode === "type"}
          variant={mode === "type" ? "primary" : "secondary"}
          onClick={() => setMode("type")}
        >
          Por tipo de error
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={mode === "template"}
          variant={mode === "template" ? "primary" : "secondary"}
          onClick={() => setMode("template")}
        >
          Por plantilla
        </Button>
      </div>
      <div role="tabpanel">{mode === "type" ? byType : byTemplate}</div>
    </div>
  );
}
