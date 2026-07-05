import type { CheerioAPI } from "cheerio";

/** A single `<script type="application/ld+json">` block found on the page. */
export interface JsonLdBlock {
  /** Position among all JSON-LD script tags on the page (0-based). */
  index: number;
  raw: string;
  /** Present when `raw` parsed as valid JSON. */
  parsed?: unknown;
  /** Present when `raw` failed to parse (empty block or invalid JSON). */
  error?: string;
}

/** A single JSON-LD entity, flattened out of top-level objects and `@graph` arrays. */
export interface JsonLdNode {
  /** Which block (by index) this node came from. */
  blockIndex: number;
  data: Record<string, unknown>;
}

function isEntityLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extracts every JSON-LD script block on the page, parsed or not (parse errors captured, not thrown). */
export function extractJsonLdBlocks($: CheerioAPI): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];

  $('script[type="application/ld+json"]').each((index, el) => {
    const raw = $(el).contents().text() ?? "";
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      blocks.push({ index, raw, error: "Bloque JSON-LD vacío" });
      return;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      blocks.push({ index, raw, parsed });
    } catch (err) {
      blocks.push({ index, raw, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return blocks;
}

/**
 * Flattens parsed JSON-LD blocks into a flat entity list: expands top-level
 * arrays and `@graph` arrays into individual nodes. A wrapper object that
 * only carries `@context`/`@graph` (no `@type` of its own) is not emitted as
 * a node — only its `@graph` children are.
 */
export function flattenNodes(blocks: JsonLdBlock[]): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];

  function collect(value: unknown, blockIndex: number): void {
    if (Array.isArray(value)) {
      for (const item of value) collect(item, blockIndex);
      return;
    }
    if (!isEntityLike(value)) return;

    if (Array.isArray(value["@graph"])) {
      for (const item of value["@graph"] as unknown[]) collect(item, blockIndex);
      if (value["@type"]) nodes.push({ blockIndex, data: value });
      return;
    }

    nodes.push({ blockIndex, data: value });
  }

  for (const block of blocks) {
    if (block.parsed !== undefined) collect(block.parsed, block.index);
  }

  return nodes;
}

/** `@type` can be a single string or an array of strings (multi-typed entity). */
export function typesOf(data: Record<string, unknown>): string[] {
  const t = data["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

/** True if `prop` is present on `data` with a non-empty value. */
export function hasProp(data: Record<string, unknown>, prop: string): boolean {
  const v = data[prop];
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
