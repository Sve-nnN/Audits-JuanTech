import type { PageCheck, SiteCheck } from "../../types";
import { jsonldPresenceCheck } from "./jsonldPresence";
import { jsonldValidityCheck } from "./jsonldValidity";
import { schemaTypesCheck } from "./schemaTypes";
import { schemaValidateCheck } from "./schemaValidate";
import { schemaEntityValidateCheck } from "./schemaEntityValidate";
import { entityGraphCheck } from "./entityGraph";
import { danglingIdRefsCheck } from "./danglingIds";
import { schemaContentMismatchCheck } from "./contentMismatch";

// NOTA: SD-04 (schemaValidateCheck) se retira de la validación por-propiedad del
// score y lo reemplaza SD-07 (schemaEntityValidateCheck), que envuelve el mismo
// motor sin emitir critical (evita doble conteo y el "fallo duro" del score). El
// símbolo schemaValidateCheck sigue exportado para consumidores externos/tests.
export const schemaPageChecks: PageCheck[] = [
  jsonldPresenceCheck,
  jsonldValidityCheck,
  schemaTypesCheck,
  schemaEntityValidateCheck,
  entityGraphCheck,
];

export const schemaSiteChecks: SiteCheck[] = [danglingIdRefsCheck, schemaContentMismatchCheck];

export {
  jsonldPresenceCheck,
  jsonldValidityCheck,
  schemaTypesCheck,
  schemaValidateCheck,
  schemaEntityValidateCheck,
  entityGraphCheck,
  danglingIdRefsCheck,
  schemaContentMismatchCheck,
};

export { SCHEMA_RULES } from "./schemaValidate";
export {
  validateEntities,
  type EntityValidation,
  type PropertyResult,
  type EntityIssue,
  type EntityStatus,
} from "./validateEntities";
export { buildEntityGraph, computeSchemaGraph, type EntityGraph, type EntityGraphNode, type EntityGraphEdge } from "./entityGraph";
export { extractJsonLdBlocks, flattenNodes, typesOf, hasProp, type JsonLdBlock, type JsonLdNode } from "./extract";
