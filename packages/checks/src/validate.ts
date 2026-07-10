// Narrow, browser-safe entrypoint for the frontend (apps/web): exposes only the
// pure JSON-LD extraction + entity-validation engine, which depends solely on
// cheerio types — never on @auditor/crawler (Crawlee/Playwright peer chain).
// Import from "@auditor/checks/validate" (NOT the "." barrel) in web code so
// Next never pulls the crawler subtree into the Vercel bundle.
export {
  validateEntities,
  type EntityValidation,
  type PropertyResult,
  type EntityIssue,
  type EntityStatus,
} from "./checks/schema/validateEntities";
export {
  extractJsonLdBlocks,
  flattenNodes,
  typesOf,
  hasProp,
  type JsonLdBlock,
  type JsonLdNode,
} from "./checks/schema/extract";

import * as cheerio from "cheerio";
import { extractJsonLdBlocks, flattenNodes } from "./checks/schema/extract";

/**
 * Fallback para audits viejos sin `Page.schemaJson`: re-extrae las entidades
 * JSON-LD planas desde el HTML crudo con cheerio (parser server-safe, nunca
 * Playwright). Mantiene la dependencia de cheerio dentro de @auditor/checks, así
 * el frontend (apps/web) no la importa directo.
 */
export function extractEntitiesFromHtml(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  return flattenNodes(extractJsonLdBlocks($)).map((n) => n.data);
}
