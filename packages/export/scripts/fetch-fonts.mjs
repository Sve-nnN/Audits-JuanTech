#!/usr/bin/env node
/**
 * fetch-fonts.mjs — materializa (reproducible) los TTF que embebe el PDF.
 *
 * Roles tipográficos v1.1 (memoria validada `array-no-titulos`):
 *   - headings/títulos = Khand (Google Fonts, OFL) — pesos 400 y 600
 *   - body             = Geist Sans (paquete `geist`, OFL) — peso 400
 * Array NO se usa en títulos y NO se materializa aquí (queda reservada a
 * display puntual en la web). @react-pdf/renderer solo acepta TTF/OTF (NO
 * woff2), por eso vendorizamos los .ttf en src/fonts/.
 *
 * Estrategia por fuente (preferir TTF directo, sfnt sin recomprimir):
 *   1. Khand: descargar el TTF estático oficial desde google/fonts (ofl/khand).
 *   2. Geist Sans: copiar el TTF que ya trae el paquete `geist` en node_modules
 *      (Geist-Regular.ttf). Fallbacks: descargar el TTF del repo vercel/geist-font,
 *      o —último recurso— descomprimir un woff2 a sfnt con `wawoff2`.
 *
 * Cada archivo se valida como sfnt (firma 0x00010000 / "OTTO" / "true").
 *
 * Uso: node packages/export/scripts/fetch-fonts.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = resolve(__dirname, "..", "src", "fonts");
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

const SFNT_SIGS = new Set(["00010000", "4f54544f", "74727565"]); // TTF, OTTO, "true"

function assertSfnt(name, buf) {
  const sig = buf.subarray(0, 4).toString("hex");
  if (!SFNT_SIGS.has(sig)) {
    throw new Error(`${name}: firma sfnt inválida (${sig}); no es un TTF/OTF válido`);
  }
  return buf;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Localiza el TTF de Geist Sans dentro de node_modules (paquete `geist`). */
function findLocalGeistTtf() {
  // 1) Resolución directa del paquete.
  try {
    const pkg = require.resolve("geist/package.json");
    const cand = join(dirname(pkg), "dist", "fonts", "geist-sans", "Geist-Regular.ttf");
    if (existsSync(cand)) return cand;
  } catch {
    /* geist no resoluble desde aquí; probamos el store pnpm */
  }
  // 2) Barrido del store pnpm (layout con hash en el nombre del directorio).
  const store = join(REPO_ROOT, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const entry of readdirSync(store)) {
      if (!entry.toLowerCase().startsWith("geist@")) continue;
      const cand = join(
        store,
        entry,
        "node_modules",
        "geist",
        "dist",
        "fonts",
        "geist-sans",
        "Geist-Regular.ttf"
      );
      if (existsSync(cand)) return cand;
    }
  }
  return null;
}

async function woff2ToTtf(woff2Buf) {
  // wawoff2 es devDependency: descomprime woff2 → sfnt (TTF). Solo fallback.
  const wawoff2 = await import("wawoff2");
  const out = await wawoff2.decompress(woff2Buf);
  return Buffer.from(out);
}

async function materializeKhand() {
  const base = "https://raw.githubusercontent.com/google/fonts/main/ofl/khand";
  const jobs = [
    ["Khand-Regular.ttf", `${base}/Khand-Regular.ttf`],
    ["Khand-SemiBold.ttf", `${base}/Khand-SemiBold.ttf`],
  ];
  for (const [name, url] of jobs) {
    const buf = assertSfnt(name, await download(url));
    writeFileSync(join(FONTS_DIR, name), buf);
    console.log(`✓ ${name} (${buf.length} bytes) ← google/fonts ofl/khand`);
  }
}

async function materializeGeistSans() {
  const name = "GeistSans-Regular.ttf";
  const local = findLocalGeistTtf();
  if (local) {
    const buf = assertSfnt(name, readFileSync(local));
    writeFileSync(join(FONTS_DIR, name), buf);
    console.log(`✓ ${name} (${buf.length} bytes) ← paquete geist (local)`);
    return;
  }
  // Fallback 1: TTF directo del repo oficial de la fuente Geist.
  try {
    const url =
      "https://raw.githubusercontent.com/vercel/geist-font/main/packages/next/dist/fonts/geist-sans/Geist-Regular.ttf";
    const buf = assertSfnt(name, await download(url));
    writeFileSync(join(FONTS_DIR, name), buf);
    console.log(`✓ ${name} (${buf.length} bytes) ← vercel/geist-font (TTF)`);
    return;
  } catch (err) {
    console.warn(`geist TTF directo no disponible (${err.message}); probando woff2→TTF`);
  }
  // Fallback 2: woff2 → sfnt vía wawoff2.
  const woff2Url =
    "https://raw.githubusercontent.com/vercel/geist-font/main/packages/next/dist/fonts/geist-sans/Geist-Regular.woff2";
  const woff2 = await download(woff2Url);
  const ttf = assertSfnt(name, await woff2ToTtf(woff2));
  writeFileSync(join(FONTS_DIR, name), ttf);
  console.log(`✓ ${name} (${ttf.length} bytes) ← vercel/geist-font (woff2→TTF vía wawoff2)`);
}

async function main() {
  mkdirSync(FONTS_DIR, { recursive: true });
  await materializeKhand();
  await materializeGeistSans();
  console.log("\nFuentes vendorizadas en src/fonts/. Array NO se toca (reservada a display).");
}

main().catch((err) => {
  console.error("fetch-fonts falló:", err.message);
  process.exitCode = 1;
});
