---
status: passed
phase: 3
verified: 2026-07-05
---

# Phase 3 Verification: SEO Técnico + On-Page

**Result:** ✅ PASSED — 4/4 success criteria verified con auditorías reales (juan-tech.com, 40 y 120 URLs) + 32 unit tests. Dos bugs de correctness encontrados y arreglados durante la verificación.

## Success Criteria

### 1. HTTP/canonical/indexabilidad/redirects por página; 4xx/5xx marcados ✅
- TECH-03,04,05,06,07 corren por página (120/120 evaluadas). El fix de Fase 2 (statusCode en 4xx/5xx) alimenta TECH-03.

### 2. Duplicados/near-duplicate, huérfanas, hreflang, mixed content (site-level) ✅
- **TECH-08** near-duplicate detectado en corrida de 120: pares es/en (tablas-hash, estrategia-seo, seo-off-page) con distancia Hamming 1-3/64 — coincide con el reporte de referencia. SimHash 64-bit, umbral Hamming ≤3 (tuneable, validado empíricamente).
- **TECH-09** huérfanas: 3 detectadas (tras fix).
- **TECH-10** hreflang: 0 violaciones en datos reales (reciprocidad correcta del sitio; unit-tested para casos rotos). Los "70" del reporte de referencia eran ruido de normalización de URL (trailing slash), que nuestra normalización evita.
- **TECH-11** mixed content evaluado por página (120/120).

### 3. Enlaces externos rotos y recursos rotos ✅
- TECH-12 (1 enlace externo roto) y TECH-13 (1 recurso roto) detectados — coincide con el reporte de referencia (1 y 1). HEAD→GET, dedupe, concurrencia baja.

### 4. Title, meta desc, H1, alt, OG, longitud, lang por página ✅
- ONPAGE-01..07 evaluados en 120 páginas. Ejemplos reales: titles cortos (warning), contenido escaso <100 palabras (critical en 6 páginas), OG incompleto (falta og:image).

## Bugs encontrados y arreglados (commit ae4927a)
1. **TECH-09 falsos positivos:** comparaba el sitemap completo (152) contra inlinks de sólo las páginas crawleadas (40) → 66 falsas huérfanas. Fix: candidatos restringidos a páginas efectivamente rastreadas. 66 → 3.
2. **BullMQ "Lock mismatch" en jobs largos:** la fase de checks (Cheerio + SimHash sobre 120 páginas) bloquea el event loop > `lockDuration` (30s) → lock expira → doble procesamiento → stats corruptas. Fix: `lockDuration` por encima de `JOB_TIMEOUT`. Reintento de 120 URLs: cero errores de lock. (deleteMany+createMany ya era idempotente.)

## Requirements
- TECH-01..13 ✅  ONPAGE-01..07 ✅

## Tests
- vitest 32/32 (title, meta, H1, alt, canonical, hreflang reciprocity/conflicto, duplicados+SimHash, mixed content). typecheck + build limpios (6 paquetes).

## Notas / deuda
- SimHash umbral Hamming ≤3: flaggea pares es/en como near-dup (igual que el reporte de referencia). Revisar si se quiere excluir variantes de idioma legítimas (tienen hreflang) del check de duplicados — decisión de producto para Fase 6 scoring.
- Indexabilidad (TECH-05) sólo lee meta robots, no X-Robots-Tag header (no persistido). Deuda menor.
- Checks site-level (08/09/10) no emiten fila "ok" cuando están limpios (sólo hallazgos); el scoring de Fase 6 los tratará como "sin issues = bueno".

## Human verification
Ninguna pendiente — verificado automáticamente contra el sitio real.
