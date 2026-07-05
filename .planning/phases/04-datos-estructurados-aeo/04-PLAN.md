# Phase 4 Plan: Datos Estructurados + AEO

**Requirements:** SD-01..05, AEO-01..04
**Mode:** mvp

## Tasks

1. **DB** — `Page.schemaGraph Json?` (grafo de entidades por página para render). Opcional: `Audit.aeoStats Json?`. Push a Neon.
2. **`packages/checks` — familia `schema/`:**
   - `extract.ts` — extrae bloques `<script type="application/ld+json">`, parsea, aplana `@graph`.
   - `jsonld-presence.ts` (SD-01), `jsonld-validity.ts` (SD-02: JSON parseable, reporta bloques inválidos), `schema-types.ts` (SD-03: clasifica @type, impacto).
   - `schema-validate.ts` (SD-04): mapa local `SCHEMA_RULES: type -> {required[], recommended[]}` para tipos comunes (Organization, WebSite, WebPage, FAQPage, Person, Article, BlogPosting, ProfessionalService, BreadcrumbList, Product, Offer). Valida: @context/@type presentes, requeridas faltantes (error), recomendadas faltantes (warning), `@id` referenciados no resueltos (warning). Estilo Classy Schema.
   - `entity-graph.ts` (SD-05): construye `{ nodes:[{id,type,label}], edges:[{from,to,rel}] }` desde los nodos JSON-LD (referencias @id, sameAs, props que apuntan a entidades). Persiste en `Page.schemaGraph`.
3. **`packages/checks` — familia `aeo/`:**
   - `ai-crawlers.ts` (AEO-01): parsea robots.txt, reporta allow/deny por bot IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Bytespider, etc.). Site-level.
   - `llms-txt.ts` (AEO-02): fetch `/llms.txt` y `/llms-full.txt`, reporta presencia/estructura, peso bajo. Site-level.
   - `ai-structured-data.ts` (AEO-03): FAQPage, Article con campos, Organization/Person con sameAs.
   - `content-format.ts` (AEO-04): encabezados como preguntas, conteo listas/tablas, longitud párrafo promedio. Page-level agregado.
4. **Registry + worker** — sumar las familias schema/aeo a runAllChecks; persistir schemaGraph por página; issues SD/AEO.
5. **Web — render del grafo:** componente de visualización del grafo de entidades por página (self-contained, sin CDN por CSP), accesible por URL (ej. `/audits/[id]/pages/[pageId]` o embebido en el futuro reporte). Data desde `Page.schemaGraph`.
6. **Verificación** — auditoría real juan-tech.com: detectar los 6 schemas del reporte de referencia, validación sin falsos errores, grafo con conexiones Organization↔Person↔ProfessionalService, AEO (llms.txt ausente, crawlers IA permitidos, formato bueno). Unit tests con fixtures JSON-LD.

## Success Criteria (ROADMAP)
1. Presencia + validez sintáctica de JSON-LD detectada y reportada, clasificando tipo e impacto.
2. Validación schema.org (requeridas/recomendadas, @id no resueltos), errores/warnings por página (Classy Schema).
3. Grafo de entidades por página visualizado (nodos @type/@id, aristas @id/references/sameAs).
4. Control de acceso de crawlers IA en robots.txt evaluado.
5. llms.txt reportado (peso bajo) + formato de contenido para IA evaluado.

## Verification Strategy
- Unit: fixtures JSON-LD (válido, inválido, @id colgante, tipos con faltantes) + robots IA + content-format.
- Integración: auditoría real juan-tech.com; assertions sobre schemas detectados, grafo, AEO.
