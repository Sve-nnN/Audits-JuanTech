import type { PageCheck, SiteCheck } from "../../types";
import { jsonldPresenceCheck } from "./jsonldPresence";
import { jsonldValidityCheck } from "./jsonldValidity";
import { schemaTypesCheck } from "./schemaTypes";
import { schemaValidateCheck } from "./schemaValidate";
import { entityGraphCheck } from "./entityGraph";
import { danglingIdRefsCheck } from "./danglingIds";

export const schemaPageChecks: PageCheck[] = [
  jsonldPresenceCheck,
  jsonldValidityCheck,
  schemaTypesCheck,
  schemaValidateCheck,
  entityGraphCheck,
];

export const schemaSiteChecks: SiteCheck[] = [danglingIdRefsCheck];

export {
  jsonldPresenceCheck,
  jsonldValidityCheck,
  schemaTypesCheck,
  schemaValidateCheck,
  entityGraphCheck,
  danglingIdRefsCheck,
};

export { SCHEMA_RULES } from "./schemaValidate";
export { buildEntityGraph, computeSchemaGraph, type EntityGraph, type EntityGraphNode, type EntityGraphEdge } from "./entityGraph";
export { extractJsonLdBlocks, flattenNodes, typesOf, hasProp, type JsonLdBlock, type JsonLdNode } from "./extract";
