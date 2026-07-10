"use client";

import { useState } from "react";
import type { BadgeVariant } from "./ui/Badge";
import { Badge } from "./ui/Badge";
import type { EntityStatus, EntityValidation } from "@auditor/checks/validate";
import { typesOf } from "@auditor/checks/validate";
import styles from "./SchemaEntities.module.css";

interface SchemaEntitiesProps {
  entities: Record<string, unknown>[];
  validations: EntityValidation[];
}

/** Profundidad máxima del árbol antes de degradar a `@id`/valor crudo (T-24-06). */
const MAX_DEPTH = 4;

/** Claves de metadatos JSON-LD que se muestran en el header, no como filas. */
const HEADER_KEYS = new Set(["@context", "@type", "@id"]);

/** EntityStatus → variante del Badge existente (sin colores nuevos). */
const STATUS_VARIANT: Record<EntityStatus, BadgeVariant> = {
  error: "critical",
  warning: "warning",
  ok: "ok",
};

const STATUS_LABEL: Record<EntityStatus, string> = {
  error: "Error",
  warning: "Advertencia",
  ok: "OK",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `@type` de un sub-objeto anidado como texto legible, o cadena vacía. */
function typeLabel(data: Record<string, unknown>): string {
  const t = typesOf(data);
  return t.join(", ");
}

function StatusBadge({ status }: { status: EntityStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Renderiza el valor de una propiedad según su forma (primitivo / array / objeto anidado). */
function PropertyValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className={styles.propValue}>—</span>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className={styles.propValue}>{String(value)}</span>;
  }

  // Tope de profundidad ANTES de recursar en cualquier estructura (array u objeto):
  // corta arrays y objetos anidados arbitrariamente profundos (T-24-06), incluidas
  // cadenas de arrays de arrays y refs @id circulares, degradando a código crudo.
  if (depth >= MAX_DEPTH) {
    return <pre className={styles.rawCode}>{JSON.stringify(value, null, 2)}</pre>;
  }

  if (Array.isArray(value)) {
    const allPrimitive = value.every(
      (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
    );
    if (allPrimitive) {
      return <span className={styles.propValue}>{value.map((v) => String(v)).join("; ")}</span>;
    }
    return (
      <div className={styles.nested}>
        {value.map((item, i) => (
          <PropertyValue key={i} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const id = typeof value["@id"] === "string" ? value["@id"] : undefined;
    const label = typeLabel(value);

    // Referencia por @id sin más contenido propio: mostrar chip tenue.
    const ownKeys = Object.keys(value).filter((k) => !HEADER_KEYS.has(k));
    if (id && ownKeys.length === 0) {
      return <span className={styles.chip}>{id}</span>;
    }

    return (
      <div className={styles.nested}>
        {label ? (
          <p className={styles.nestedType}>
            {label}
            {id ? <span className={styles.entityId}> {id}</span> : null}
          </p>
        ) : null}
        <PropertyRows data={value} statusByProp={new Map()} depth={depth + 1} />
      </div>
    );
  }

  return <span className={styles.propValue}>—</span>;
}

/** Filas propiedad → valor de un objeto (excluye claves de header). */
function PropertyRows({
  data,
  statusByProp,
  depth,
}: {
  data: Record<string, unknown>;
  statusByProp: Map<string, EntityStatus>;
  depth: number;
}) {
  const keys = Object.keys(data).filter((k) => !HEADER_KEYS.has(k));

  if (keys.length === 0) {
    return <p className={styles.emptyProps}>Sin propiedades.</p>;
  }

  return (
    <div className={styles.propRows}>
      {keys.map((key) => {
        const status = statusByProp.get(key);
        return (
          <div key={key} className={styles.propRow}>
            <div className={styles.propNameCell}>
              <span className={styles.propName}>{key}</span>
              {status ? <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge> : null}
            </div>
            <PropertyValue value={data[key]} depth={depth} />
          </div>
        );
      })}
    </div>
  );
}

function EntityCard({
  entity,
  validation,
}: {
  entity: Record<string, unknown>;
  validation: EntityValidation | undefined;
}) {
  const [showRaw, setShowRaw] = useState(false);

  const type = validation?.type || typeLabel(entity) || "(sin @type)";
  const id = validation?.id ?? (typeof entity["@id"] === "string" ? entity["@id"] : undefined);

  // Estado por propiedad conocida (present-ok / required-error / recommended-warning).
  const statusByProp = new Map<string, EntityStatus>();
  for (const p of validation?.properties ?? []) statusByProp.set(p.name, p.status);

  const issues = validation?.issues ?? [];

  return (
    <div className={styles.entityCard}>
      <div className={styles.entityHeader}>
        <span className={styles.entityType}>{type}</span>
        {validation ? <StatusBadge status={validation.status} /> : null}
        {id ? <span className={styles.entityId}>{id}</span> : null}
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setShowRaw((v) => !v)}
          aria-pressed={showRaw}
        >
          {showRaw ? "Ver árbol" : "Ver código"}
        </button>
      </div>

      {showRaw ? (
        <pre className={styles.rawCode}>{JSON.stringify(entity, null, 2)}</pre>
      ) : (
        <>
          <PropertyRows data={entity} statusByProp={statusByProp} depth={0} />
          {issues.length > 0 ? (
            <ul className={styles.issueList}>
              {issues.map((issue, i) => (
                <li key={i} className={styles.issueLine}>
                  <Badge variant={STATUS_VARIANT[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
                  <span className={styles.issueMessage}>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * SchemaEntities (SDVIZ-02/03) — panel estilo Classy Schema: una card por
 * entidad JSON-LD con árbol de propiedades, badges de estado por propiedad y por
 * entidad (motor `validateEntities`), lista de anti-patrones/faltantes, y toggle
 * a código crudo. Sólo pinta texto (React auto-escapa); sin HTML crudo ni deps
 * nuevas. Las entidades se emparejan con `validations` por índice.
 */
export function SchemaEntities({ entities, validations }: SchemaEntitiesProps) {
  if (entities.length === 0) return null;

  return (
    <div className={styles.entities}>
      {entities.map((entity, i) => (
        <EntityCard key={i} entity={entity} validation={validations[i]} />
      ))}
    </div>
  );
}
