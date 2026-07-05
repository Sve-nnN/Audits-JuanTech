import type { PageCheck } from "../../types";
import { jsonldPresenceCheck } from "./jsonldPresence";
import { jsonldValidityCheck } from "./jsonldValidity";
import { schemaTypesCheck } from "./schemaTypes";
import { schemaValidateCheck } from "./schemaValidate";
import { entityGraphCheck } from "./entityGraph";

export const schemaPageChecks: PageCheck[] = [
  jsonldPresenceCheck,
  jsonldValidityCheck,
  schemaTypesCheck,
  schemaValidateCheck,
  entityGraphCheck,
];

export {
  jsonldPresenceCheck,
  jsonldValidityCheck,
  schemaTypesCheck,
  schemaValidateCheck,
  entityGraphCheck,
};

export { SCHEMA_RULES } from "./schemaValidate";
export { buildEntityGraph, computeSchemaGraph, type EntityGraph, type EntityGraphNode, type EntityGraphEdge } from "./entityGraph";
export { extractJsonLdBlocks, flattenNodes, typesOf, hasProp, type JsonLdBlock, type JsonLdNode } from "./extract";
