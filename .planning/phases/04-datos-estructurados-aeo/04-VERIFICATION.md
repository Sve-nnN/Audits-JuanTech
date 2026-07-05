---
status: passed
phase: 4
verified: 2026-07-05
---

# Phase 4 Verification: Datos Estructurados + AEO

**Result:** ✅ PASSED — 5/5 success criteria verified con auditoría real (juan-tech.com) + 59 unit tests. Un falso positivo de correctness encontrado y arreglado.

## Success Criteria

### 1. Presencia + validez JSON-LD, clasificación de tipo/impacto ✅
- SD-01/02/03: 30/30 páginas con JSON-LD presente, válido, clasificado. Homepage: los 6 tipos del reporte de referencia (Organization, WebSite, FAQPage, Person, ProfessionalService, ItemList).

### 2. Validación schema.org (Classy Schema) — requeridas/recomendadas + @id ✅
- SD-04: mapa local de reglas para 11 tipos. En juan-tech.com: 24 "válidos", 6 warnings legítimos (WebPage/ProfessionalService con props recomendadas faltantes). Cero errores críticos falsos → coincide con el "100/100" del reporte de referencia y agrega el detalle de recomendadas.

### 3. Grafo de entidades por página (@type/@id, aristas @id/sameAs) ✅
- SD-05: 30/30 páginas con `schemaGraph` persistido. Homepage: 8 nodos (6 schemas + 2 externos sameAs), 7 aristas (founder, worksFor, publisher, sameAs). Ruta `/audits/[id]/pages/[pageId]` renderiza el grafo en SVG self-contained (HTTP 200, sin CDN por CSP). Diferenciador del producto entregado.

### 4. Control de acceso de crawlers IA en robots.txt ✅
- AEO-01: 9 bots IA evaluados (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.). juan-tech.com: todos permitidos.

### 5. llms.txt (peso bajo) + formato de contenido para IA ✅
- AEO-02: juan-tech.com AHORA tiene llms.txt (el reporte de referencia era previo). Detectado con estructura Markdown, severidad informativa.
- AEO-03/04: datos estructurados orientados a IA (FAQPage/Article/sameAs) y formato (encabezados como pregunta, listas, tablas, longitud de párrafo) evaluados en 30 páginas.

## Bug encontrado y arreglado (commit 6d72ce8)
- **SD-04 falsos positivos `@id sin resolver`:** el check resolvía referencias `@id` por página. Nodos site-wide (`#person`, `#service` definidos en la home) referenciados desde internas se marcaban colgantes → 28 falsos positivos. Fix: detección movida a site-check que construye un registro de todos los `@id` del audit y resuelve site-wide. 28 → 0.

## Requirements
- SD-01..05 ✅  AEO-01..04 ✅

## Tests
- vitest 59/59 (extracción, validez, validación semántica, grafo, dangling site-wide, AI crawlers, content-format). typecheck + build limpios (6 paquetes).

## Notas / deuda
- Validación schema.org pragmática (11 tipos comunes), extensible. No es el vocabulario completo.
- Grafo con layout circular determinístico (sin librería externa por CSP). Force-directed queda para pulido.

## Human verification
Recomendable (no bloqueante): abrir `/audits/[id]/pages/[pageId]` en el browser para revisar el render visual del grafo. Funcionalmente verificado (HTTP 200 + nodos presentes en el HTML).
