import { hasProp, typesOf } from "./extract";
import { SCHEMA_RULES } from "./schemaValidate";

/**
 * Estado de validación de una propiedad o de una entidad completa.
 * - "ok": presente / sin observaciones.
 * - "warning": recomendada faltante o anti-patrón de alto valor.
 * - "error": requerida faltante.
 */
export type EntityStatus = "ok" | "warning" | "error";

/** Resultado por propiedad evaluada (una fila por cada required/recommended del/los tipo/s). */
export interface PropertyResult {
  name: string;
  status: EntityStatus;
  message?: string;
}

/** Observación agregada de la entidad: requerida faltante (error) o anti-patrón (warning). */
export interface EntityIssue {
  status: "warning" | "error";
  message: string;
}

/** Resultado de validación por entidad, listo para scoring y para la UI del detalle de página. */
export interface EntityValidation {
  /** Tipos conocidos evaluados (unidos), o el @type crudo si no hay tipo conocido. */
  type: string;
  /** `@id` de la entidad cuando existe (referencia estable en el grafo). */
  id?: string;
  status: EntityStatus;
  properties: PropertyResult[];
  issues: EntityIssue[];
}

/** Devuelve el status agregado a partir de propiedades e issues (error > warning > ok). */
function aggregate(properties: PropertyResult[], issues: EntityIssue[]): EntityStatus {
  const hasError = properties.some((p) => p.status === "error") || issues.some((i) => i.status === "error");
  if (hasError) return "error";
  const hasWarning = properties.some((p) => p.status === "warning") || issues.some((i) => i.status === "warning");
  if (hasWarning) return "warning";
  return "ok";
}

/** Normaliza un valor que puede ser objeto o array de objetos a una lista de sub-objetos. */
function asObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v));
  }
  if (typeof value === "object" && value !== null) return [value as Record<string, unknown>];
  return [];
}

/**
 * Detecta anti-patrones de alto valor SEO/rich-results que NO se capturan con
 * required/recommended. Todos degradan a warning — nunca a error (schema no
 * puede tumbar duro el score, decisión de la fase).
 */
function antiPatterns(data: Record<string, unknown>, types: string[]): EntityIssue[] {
  const issues: EntityIssue[] = [];

  // Product con AggregateRating declarado pero incompleto: Google exige
  // reviewCount/ratingCount + ratingValue para el rich result de estrellas.
  if (types.includes("Product") && hasProp(data, "aggregateRating")) {
    for (const agg of asObjects(data["aggregateRating"])) {
      const faltantes: string[] = [];
      if (!hasProp(agg, "ratingValue")) faltantes.push("ratingValue");
      if (!hasProp(agg, "reviewCount") && !hasProp(agg, "ratingCount")) faltantes.push("reviewCount");
      if (faltantes.length > 0) {
        issues.push({
          status: "warning",
          message: `AggregateRating incompleto: falta ${faltantes.join(" y ")}. Google no muestra estrellas sin estos campos.`,
        });
      }
    }
  }

  return issues;
}

/**
 * MOTOR PURO de validación por entidad/propiedad. Recibe entidades JSON-LD ya
 * planas (los `JsonLdNode.data` de `flattenNodes`) y devuelve, por entidad, el
 * estado de cada propiedad requerida/recomendada de su/s tipo/s conocido/s, más
 * las observaciones agregadas (requeridas faltantes + anti-patrones).
 *
 * Determinista y sin IO: no usa cheerio, React ni fuentes de entropía/tiempo. Las
 * propiedades desconocidas no se listan ni se marcan (evita ruido). Una entidad
 * cuyo @type está fuera del subconjunto conocido no se valida ni penaliza.
 */
export function validateEntities(entities: Record<string, unknown>[]): EntityValidation[] {
  return entities.map((data) => {
    const types = typesOf(data);
    const knownTypes = types.filter((t) => SCHEMA_RULES[t]);
    const id = typeof data["@id"] === "string" ? (data["@id"] as string) : undefined;

    if (knownTypes.length === 0) {
      return { type: types[0] ?? "", id, status: "ok", properties: [], issues: [] };
    }

    // Acumula reglas de todos los tipos conocidos: required primero (gana sobre
    // recommended si un mismo campo aparece en ambos), luego recommended.
    const required: string[] = [];
    const recommended: string[] = [];
    for (const t of knownTypes) {
      for (const p of SCHEMA_RULES[t]!.required) if (!required.includes(p)) required.push(p);
    }
    for (const t of knownTypes) {
      for (const p of SCHEMA_RULES[t]!.recommended) {
        if (!required.includes(p) && !recommended.includes(p)) recommended.push(p);
      }
    }

    const properties: PropertyResult[] = [];
    const issues: EntityIssue[] = [];

    for (const name of required) {
      if (hasProp(data, name)) {
        properties.push({ name, status: "ok" });
      } else {
        properties.push({ name, status: "error", message: "Propiedad requerida faltante" });
        issues.push({ status: "error", message: `Falta la propiedad requerida "${name}".` });
      }
    }

    for (const name of recommended) {
      if (hasProp(data, name)) {
        properties.push({ name, status: "ok" });
      } else {
        properties.push({ name, status: "warning", message: "Propiedad recomendada faltante" });
        issues.push({ status: "warning", message: `Se recomienda agregar la propiedad "${name}".` });
      }
    }

    for (const issue of antiPatterns(data, knownTypes)) issues.push(issue);

    return { type: knownTypes.join(", "), id, status: aggregate(properties, issues), properties, issues };
  });
}
