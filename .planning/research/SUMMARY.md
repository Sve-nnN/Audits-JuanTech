# Project Research Summary

**Project:** Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com
**Domain:** Extensión de un auditor SEO en producción (5 features nuevas sobre pipeline validado v1.0-v1.2)
**Researched:** 2026-07-08
**Confidence:** HIGH

## Executive Summary

Las 5 features de v1.3 (schema-contenido, profundidad de clics, diagnósticos Lighthouse, agrupación por plantilla, visualizador de arquitectura) son aditivas sobre un pipeline ya validado y **no requieren ninguna dependencia nueva** — ni librería de grafos, ni Lighthouse local, ni migración de storage. Los cuatro research files coinciden en que el trabajo real es de integración cuidadosa dentro de los límites arquitectónicos ya establecidos (`packages/checks`, `packages/psi`, `packages/report-model`), no de exploración tecnológica.

El hallazgo más importante de la investigación es una corrección a la premisa del propio milestone: **`Page.depth` no sirve para el check de profundidad de clics** en el modo de crawl dominante (sitemap-seeded), porque el BFS que lo calcula sólo corre en el fallback de link-crawl puro (verificado línea por línea en `crawl.ts`). Esto obliga a calcular un BFS real desde el home sobre el grafo de enlaces internos — el mismo cómputo que ya necesita el visualizador de arquitectura (feature 5). Estas dos features deben compartir una sola pasada de parseo de enlaces (reusando el patrón de `orphanPages.ts`), calculada una vez en el worker y persistida en `Audit.stats`, nunca recomputada en el camino de lectura del reporte (violaría la filosofía "sólo datos persistidos" de `buildReportModel` y sería perceptiblemente lento a 500 páginas).

Los otros riesgos identificados son de scoring e integridad de datos, no de arquitectura: los diagnósticos de Lighthouse deben extraerse en `client.ts`/`parser.ts` antes del punto donde hoy se descartan (si no, "gratis" se vuelve imposible de recuperar sin una segunda llamada a PSI), deben entrar con severidad informativa (`ok`) para no doblar el conteo del score de `perf` ya validado, y necesitan fingerprints sub-tipados por tipo de diagnóstico (repitiendo la lección de Phase 11). El check de schema-contenido y la agrupación por plantilla son heurísticos por naturaleza y deben degradar con gracia (severidad tope `warning`, bucket "desconocido" explícito) para no erosionar la confianza del usuario en un producto lead-magnet.

## Key Findings

### Recommended Stack

Sin cambios de core stack ni instalaciones nuevas. La única decisión de stack real es el visualizador de arquitectura (feature 5): usar SVG nativo + React, replicando el patrón ya validado en producción de `apps/web/app/components/EntityGraphSvg.tsx` ("self-contained SVG renderer, no external libs — strict CSP"). Se descarta explícitamente `@xyflow/react` (55-70kB gzip, pensado para grafos interactivos con drag/zoom), `d3-hierarchy`/`@visx/hierarchy` (peso injustificado para una jerarquía fija de 4 niveles) y `react-arborist`/`react-d3-tree` (pensados para árboles editables/virtualizados de miles de nodos). Esto cierra la pregunta abierta que ARCHITECTURE.md había dejado pendiente ("open stack decision, flag for dedicated library-research pass").

**Core technologies (sin cambios):**
- Cheerio (vía `@auditor/checks`/`@auditor/crawler`) — parseo de HTML crudo, ya en uso para todos los checks nuevos
- PSI response ya obtenida — fuente de los diagnósticos Lighthouse, cero llamadas extra si se extrae en el punto correcto del pipeline
- SVG nativo + React — visualizador de arquitectura, cero dependencias nuevas, respeta el CSP estricto y el presupuesto de bundle del reporte

### Expected Features

**Must have (las 5 ya bloqueadas por el milestone, "MVP" = versión más lean y correcta de cada una):**
- Check de profundidad de clics (`Page.depth > 3` recalculado vía BFS real, no leído del campo persistido) — severidad `warning`, agregado además de por-página para no inundar la lista de prioridad
- Diagnósticos de Lighthouse curados (5-7 audit IDs: WebP/formatos modernos, CSS/JS sin usar, render-blocking, imágenes correctamente dimensionadas) — severidad informativa, nunca `critical`
- Agrupación por plantilla (home/categoría/producto/artículo/desconocido) — segundo eje junto a `groupIssuesByType` de v1.2
- Check schema-contenido (FAQPage/HowTo/Product+AggregateRating sin contenido visible correspondiente) — severidad tope `warning`, cruzado contra la muestra CSR/SSR de v1.2 antes de marcar mismatch
- Visualizador de arquitectura (árbol jerárquico por profundidad, bucket "3+", grafo de enlaces on-demand pero **precomputado y persistido**, no recalculado por request)

**Explícitamente fuera de alcance (anti-features confirmadas por research):**
- Grafo interactivo completo con aristas persistidas y fuerzas físicas — balonaría scope y storage sin aportar señal extra sobre el árbol jerárquico
- Lighthouse completo (40+ audits) por página — contradice el principio "no ahogar a una audiencia de lead-magnet en minucias"
- Clasificación de plantilla por taxonomía rígida específica de CMS — genera falsa confianza en sitios que no siguen esas convenciones; usar heurística de patrones + fallback "desconocido"

### Architecture Approach

El pipeline (crawl → `runAllChecks` → PSI sample → render sample → persist → `buildReportModel` → UI/exports) queda intacto; todas las adiciones son aditivas. Los componentes existentes que se tocan: `packages/checks/src/checks/{tech,schema}` (dos `PageCheck`s nuevos), `packages/psi` (extensión de `parser.ts`/`types.ts` + nuevo `diagnostics.ts` paralelo, nunca fusionado en `PsiMetrics`), `packages/report-model` (nuevo `template.ts` y, según la reconciliación de este milestone, un módulo compartido de grafo/BFS), y una ruta nueva `apps/web/app/audits/[id]/architecture/page.tsx`.

**Major components (según la reconciliación arquitectura+pitfalls):**
1. **Módulo compartido de grafo de enlaces** (nuevo, en el worker) — una sola pasada de Cheerio sobre las hasta 500 páginas de `page.html`, produciendo BFS real de profundidad de clics + adjacency list para el árbol de arquitectura. Se persiste en `Audit.stats` (mismo mecanismo que `stats.perf`). Reemplaza la idea original de "el check de profundidad lee `Page.depth`" y la idea original de "el visualizador reparsea HTML on-demand en el reporte" — ambas quedaban invalidadas por PITFALLS.md.
2. **`packages/psi` extendido** — `parser.ts`/`types.ts` capturan diagnósticos en el momento en que la respuesta cruda de PSI existe en memoria (dentro de `client.ts`, antes del cacheo reducido actual); nuevo `diagnostics.ts` con `mapDiagnosticIssues`, estructura paralela a `PsiMetrics`, nunca fusionada en ella.
3. **`packages/report-model` como única fuente de verdad** — `template.ts` (clasificación + agrupación por plantilla) y el consumo del grafo ya persistido en `Audit.stats`; `buildReportModel` sigue sin tocar `Page.html` directamente (evita repetir la fragilidad ya documentada de v1.2 de queries paralelas fuera de `report-model`).
4. **UI del reporte** — generalizar `IssueTypeGroup` para aceptar grupos precomputados (reusado por template y por tipo), y nueva ruta `/architecture` que sólo lee JSON ya calculado, sin Cheerio en `apps/web`.

### Critical Pitfalls

1. **`Page.depth` no es profundidad de clics real en crawls sembrados por sitemap** (modo dominante en producción) — el BFS que lo incrementa está guardado detrás de `if (!seedFromSitemap)` y nunca corre en ese modo. Evitarlo calculando un BFS real desde el home sobre el grafo de enlaces, sin sobrescribir `Page.depth`.
2. **Diagnósticos de Lighthouse "gratis" sólo si se extraen antes del cacheo actual** — `parser.ts` descarta hoy todo excepto 5 campos y `cache.ts` sólo persiste ese objeto reducido en Redis. Extraer en `client.ts` en el punto donde la respuesta cruda aún existe; aceptar degradación graciosa para el caché ya poblado (TTL 24h) sin invalidación manual.
3. **Doble conteo de severidad entre diagnósticos nuevos y las 4 métricas de perf ya scoreadas** — `scoreCategory` promedia salud sin ponderar causa raíz; diagnósticos redundantes con LCP/CLS penalizarían dos veces. Mitigar con severidad `ok`/exclusión del cómputo de score, nunca `critical`.
4. **Falsos positivos sistemáticos en schema-contenido para páginas CSR fuera de la muestra renderizada o con markup no estándar** (`<details>/<summary>`). Tope `warning`, cruzar con RENDER-01..03 antes de marcar mismatch, ampliar detección más allá de `div/dt/dd`.
5. **Fingerprints sin sub-tipo colapsan hallazgos múltiples por página** — repetición del bug de Phase 11 si un solo `checkId` cubre varios tipos de diagnóstico. Sub-tipar `${checkId}-${tipo}:${url}`.
6. **(Reconciliado) El visualizador on-demand tal como estaba descrito en ARCHITECTURE.md rompería la filosofía "sólo datos persistidos" y sería lento a 500 páginas** — resuelto compartiendo el cómputo de grafo/BFS con el check de profundidad de clics, calculado una vez en el worker y persistido en `Audit.stats`.

## Implications for Roadmap

Basado en la investigación combinada (incluyendo la reconciliación explícita del conflicto Page.depth/BFS y la resolución de la librería de grafos), la secuencia sugerida respeta: (a) riesgo ascendente (patrón ya usado en v1.2), (b) la sinergia BFS compartida entre profundidad de clics y visualizador, y (c) desacoplar decisiones de UI compartida (generalización de `IssueTypeGroup`) antes de construir sobre ellas.

### Phase 1: Grafo de enlaces compartido + check de profundidad de clics real
**Rationale:** Es el fundamento técnico que tanto el check de profundidad como el visualizador (Phase 5) necesitan; construirlo primero evita que cada feature reparse el HTML de las 500 páginas por separado (pitfall de performance identificado). También es donde vive la corrección más importante encontrada en research (Page.depth no sirve tal cual).
**Delivers:** Módulo de cómputo de grafo/BFS en el worker (reusa el patrón de `orphanPages.ts`), persistido en `Audit.stats`; nuevo check `TECH-1x` de profundidad de clics (severidad warning, agregado + por-página) leyendo el BFS recién calculado, no `Page.depth`.
**Addresses:** Feature "Check profundidad de clics" de FEATURES.md/PROJECT.md.
**Avoids:** Pitfall 1 (Page.depth falso) y Pitfall 6 (recomputación cara en el camino de lectura del reporte).

### Phase 2: Check schema-contenido mismatch
**Rationale:** Mismo patrón `PageCheck` que profundidad de clics pero sin dependencia de la Phase 1; construible en paralelo o justo después, reusa `extract.ts` ya maduro. Secuenciarlo temprano porque su principal riesgo (falsos positivos) requiere validación de test explícita antes de exponerse en producción.
**Delivers:** Nuevo `PageCheck` en `packages/checks/src/checks/schema/schemaContentMismatch.ts`, severidad tope `warning`, cruzado con muestra CSR/SSR (v1.2) antes de marcar mismatch, detección ampliada a `<details>/<summary>` y roles ARIA.
**Addresses:** Feature "Check schema-contenido" de PROJECT.md.
**Avoids:** Pitfall 4 (falsos positivos sistemáticos en CSR fuera de muestra / markup no estándar).

### Phase 3: Diagnósticos de Lighthouse desde PSI
**Rationale:** Aislado en `packages/psi`, sin dependencia funcional de las fases anteriores; secuenciar aquí para no competir por el mismo archivo `apps/worker/src/index.ts` con Phases 1-2 en el mismo commit.
**Delivers:** Extensión de `parser.ts`/`types.ts` (extracción en el punto correcto, antes del cacheo reducido), nuevo `diagnostics.ts` con `mapDiagnosticIssues`, fingerprints sub-tipados por tipo de diagnóstico, severidad informativa (`ok`) excluida del cómputo de score de `perf`.
**Uses:** JSON de PSI ya obtenido (STACK.md, tabla de audit IDs confirmados).
**Avoids:** Pitfall 2 (datos ya descartados en el punto donde se intentaría leerlos), Pitfall 3 (doble conteo de score), Pitfall 5 (fingerprints colapsados).

### Phase 4: Agrupación por plantilla + generalización de `IssueTypeGroup`
**Rationale:** Requiere primero decidir si se generaliza el componente compartido de agrupación (recomendado) o se duplica — esta decisión de UI debe tomarse antes de construir la superficie final, para evitar rework. No depende de las fases anteriores.
**Delivers:** `packages/report-model/src/template.ts` (clasificación heurística con bucket "desconocido" explícito + `groupIssuesByTemplate`), generalización de `IssueTypeGroup` para aceptar grupos precomputados, nueva sección/tab en el reporte.
**Implements:** Segundo eje de agrupación (report-model como fuente única, no lógica en `apps/web`).
**Avoids:** Pitfall 7 (etiquetas de plantilla incorrectas sin fallback).

### Phase 5: Visualizador de arquitectura
**Rationale:** Última fase — mayor superficie nueva (ruta, componente SVG nuevo) y depende del grafo/BFS ya calculado y persistido en Phase 1 (no de las Phases 2-4, pero secuenciarla al final deja el patrón de grafo compartido validado y estable, y permite opcionalmente mostrar el badge de plantilla de Phase 4 en cada nodo).
**Delivers:** Ruta `apps/web/app/audits/[id]/architecture/page.tsx` (Server Component, lee sólo `Audit.stats` ya calculado), componente `ArchitectureTreeSvg` (SVG nativo + React, patrón de `EntityGraphSvg.tsx`, cero dependencias nuevas), buckets de profundidad 0/1/2/3+, colapso/expansión con `useState`, scroll horizontal nativo en vez de pan/zoom de librería.
**Uses:** Grafo/BFS de Phase 1 (compartido, no recalculado); SVG nativo confirmado por STACK.md.
**Avoids:** Pitfall 6 (Cheerio/HTML crudo nunca entra al camino de lectura del reporte en `apps/web`).

### Phase Ordering Rationale

- Phase 1 primero porque desbloquea tanto el check de profundidad como el fundamento de datos de Phase 5 — construirlo tarde forzaría refactor de cualquiera de las dos features que se implementara primero de forma aislada.
- Phases 2 y 3 son independientes entre sí y de Phase 1 — se ordenan por riesgo de falsos positivos (Phase 2, requiere más validación de test) antes que por riesgo técnico puro (Phase 3, es principalmente disciplina de dónde extraer datos).
- Phase 4 se sitúa antes de Phase 5 porque, aunque no es una dependencia dura, permite que el visualizador muestre el badge de plantilla sin trabajo adicional si se construye después.
- Phase 5 al final: mayor superficie nueva, único punto con una decisión de librería (ya resuelta: SVG nativo) y el que más se beneficia de que el patrón de grafo compartido (Phase 1) ya esté probado en producción con el check de profundidad de clics.

### Research Flags

Phases con research adicional recomendado durante planning:
- **Ninguna requiere una ronda de research-phase completa** — los 4 documentos de research (stack, features, architecture, pitfalls) ya resolvieron las preguntas abiertas identificadas originalmente (librería de grafos: resuelta; semántica de Page.depth: resuelta y reconciliada). El único punto a verificar en fase de ejecución (no de research) es la vigencia de `overallSavingsMs` vs `metricSavings` en la versión exacta de Lighthouse detrás de PSI v5 (nota MEDIUM confidence en STACK.md) — validar con un log/print de la respuesta real durante la Phase 3, no requiere research previo.

Phases con patrones estándar (ya bien documentados, ejecutar directo):
- **Phase 1:** patrón `orphanPages.ts` ya validado en producción, sólo se extiende a BFS + persistencia en `Audit.stats` (mecanismo ya usado por `stats.perf`).
- **Phase 2:** patrón `PageCheck` sobre Cheerio ya establecido, reusa `extract.ts` existente.
- **Phase 3:** patrón `METRIC_SPECS`/`issues.ts` ya establecido, sólo se añade una estructura paralela.
- **Phase 5:** patrón `EntityGraphSvg.tsx` ya validado en producción, cero dependencia nueva.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Cero paquetes nuevos; decisión de SVG nativo verificada contra código real ya en producción (`EntityGraphSvg.tsx`) y contra pesos de bundle de npm registry actuales |
| Features | MEDIUM-HIGH | Basado en fuentes oficiales de Google (structured data policy) + convención de mercado (Screaming Frog/Semrush/Sitebulb) para "3-click rule", que es heurística de industria, no spec técnica |
| Architecture | HIGH | Verificado leyendo directamente el código fuente actual (`types.ts`, `registry.ts`, `build.ts`, `orphanPages.ts`) — ground truth, no inferencia |
| Pitfalls | HIGH | Todos los hallazgos verificados línea por línea contra `crawl.ts`, `parser.ts`/`cache.ts`, `categoryScore.ts`/`diff.ts`, `schema.prisma` — incluye el hallazgo crítico que reconcilia la premisa original del milestone sobre `Page.depth` |

**Overall confidence:** HIGH

### Gaps to Address

- **Umbral exacto de severidad para profundidad de clics** (ok ≤3, warning en 4, critical en ≥5 — sugerido en ARCHITECTURE.md pero no confirmado con Juan): decidir en la fase de planning de Phase 1, es un detalle de producto de bajo riesgo.
- **`overallSavingsMs` vs `metricSavings` en Lighthouse/PSI v5:** verificar contra la respuesta real de PSI durante la implementación de Phase 3 (no bloquea el diseño, sólo el mapeo exacto de campos).
- **Señal de contenido más allá de patrones de markup fijos para schema-contenido:** el enfoque de "coincidencia aproximada de texto entre JSON-LD y cualquier texto visible" (PITFALLS.md) es más robusto que patrones `div/dt/dd`, pero su umbral de "coincidencia suficiente" es una decisión de producto a afinar con casos de prueba reales durante la ejecución de Phase 2, no en research.
- **Backfill de audits previos a v1.3** para el grafo/BFS persistido en `Audit.stats`: los audits ya existentes no tendrán este dato — decidir en Phase 1 si se degrada con gracia ("no disponible para auditorías previas a esta versión") o se backfillea; PITFALLS.md ya sugiere degradar sin backfill como opción de bajo costo.

## Sources

### Primary (HIGH confidence)
- Lectura directa del código fuente del repo: `packages/crawler/src/crawl.ts`, `packages/psi/src/{client,parser,cache,types,issues}.ts`, `packages/checks/src/{types,registry}.ts`, `packages/checks/src/checks/tech/orphanPages.ts`, `packages/checks/src/checks/schema/{extract,schemaTypes}.ts`, `packages/report-model/src/{build,grouping,jsonld,index}.ts`, `packages/scoring/src/{categoryScore,diff}.ts`, `packages/db/prisma/schema.prisma`, `apps/web/app/components/EntityGraphSvg.tsx`, `apps/web/app/audits/[id]/{page.tsx,pages/page.tsx}`, `apps/web/app/components/ui/IssueTypeGroup.tsx`, `apps/worker/src/index.ts`
- [Google Search Central — General Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) y [FAQPage docs](https://developers.google.com/search/docs/appearance/structured-data/faqpage) — política oficial de manual action por schema sin contenido visible
- [GoogleChrome/lighthouse — types/lhr/audit-details.d.ts y audit-result.d.ts](https://github.com/GoogleChrome/lighthouse) — shape oficial de audits de Lighthouse/PSI
- npm registry (consulta directa, 2026-07-08) — versiones y pesos gzip de librerías de grafos evaluadas y descartadas

### Secondary (MEDIUM confidence)
- WebSearch sobre "3-click rule" como convención de industria (Semrush, Screaming Frog, Sitebulb) — consenso de mercado, no spec técnica única
- WebSearch sobre deprecación de `overallSavingsMs` en favor de `metricSavings` en Lighthouse — requiere verificación puntual en Phase 3

### Tertiary (LOW confidence)
- Ninguna fuente de baja confianza usada en decisiones clave de este milestone

---
*Research completed: 2026-07-08*
*Ready for roadmap: yes*
