/**
 * 64-bit SimHash for near-duplicate content detection (TECH-08).
 *
 * Standard shingling + SimHash: tokenize text into word-level shingles,
 * hash each shingle to a 64-bit value, then combine via the classic
 * "weighted majority vote per bit" algorithm. Two documents whose SimHash
 * values differ by a small Hamming distance are near-duplicates.
 */

const SHINGLE_SIZE = 3;

/** Tuneable threshold: fingerprints with Hamming distance <= this are flagged
 * as near-duplicates. 3 is a conservative starting point (out of 64 bits,
 * ~95% similarity) — validate empirically against real sites and adjust if
 * it proves too strict/loose (see 03-CONTEXT.md pitfall note). */
export const SIMHASH_HAMMING_THRESHOLD = 3;

/** Normalizes text for shingling: lowercase, collapse whitespace, strip punctuation. */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

function shingles(tokens: string[], size: number): string[] {
  if (tokens.length < size) return tokens.length > 0 ? [tokens.join(" ")] : [];
  const result: string[] = [];
  for (let i = 0; i <= tokens.length - size; i++) {
    result.push(tokens.slice(i, i + size).join(" "));
  }
  return result;
}

/** FNV-1a-like 64-bit hash (as bigint) — deterministic, fast, no crypto needed. */
function hash64(str: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash;
}

/**
 * Computes the 64-bit SimHash fingerprint of `text`, returned as a BigInt.
 * Returns `null` for text with no extractable tokens (empty/whitespace-only).
 */
export function simhash(text: string): bigint | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  const grams = shingles(tokens, SHINGLE_SIZE);
  if (grams.length === 0) return null;

  const bitWeights = new Array<number>(64).fill(0);

  for (const gram of grams) {
    const h = hash64(gram);
    for (let bit = 0; bit < 64; bit++) {
      const isSet = (h >> BigInt(bit)) & 1n;
      bitWeights[bit] = (bitWeights[bit] ?? 0) + (isSet === 1n ? 1 : -1);
    }
  }

  let result = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if ((bitWeights[bit] ?? 0) > 0) {
      result |= 1n << BigInt(bit);
    }
  }
  return result;
}

/** Hamming distance between two 64-bit SimHash values. */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  while (xor !== 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

/** Simple stable hash for exact-duplicate detection (normalized text equality). */
export function exactContentHash(text: string): string {
  const normalized = normalizeText(text);
  return hash64(normalized).toString(16);
}
