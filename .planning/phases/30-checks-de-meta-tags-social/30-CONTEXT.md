# Phase 30: Checks de meta tags/social - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

El auditor detecta y reporta, por página, los problemas de Open Graph, Twitter Card, charset y duplicados de tags que afectan cómo se ve el sitio al compartirse. Cubre SOCIAL-01..08 (los 8 checks nuevos de la categoría `social`, creada en Phase 29) y el Success Criterion #5 agregado al ROADMAP (guardarraíl anti-duplicados de SOCIAL-09 contra el retirado ONPAGE-05). Sin UI (Phase 30 no tiene panel propio — Phase 32 lo construye).

</domain>

<decisions>
## Implementation Decisions

### Arquitectura del motor de extracción meta/social

- Paquete nuevo `packages/meta-social` — motor puro de extracción (og:title/description/image/url/type, twitter:card, twitter:*, charset + su posición en el HTML crudo), sin dependencias de runtime salvo Cheerio. Mismo patrón desacoplado que `packages/fingerprint` y `packages/cms-adapters` (decisión ya registrada en research v1.6 / STATE.md).
- Expone una función pura tipo `extractMetaSocial($, html): MetaSocialData` que `packages/checks` consume para generar los 8 checks nuevos — el motor no conoce `Issue`/`PageCheck`, sólo devuelve datos extraídos.
- Testeado con fixtures HTML in-memory (mismo patrón que el resto del catálogo: `cheerio.load(html)` + assertions directas sobre el resultado de la función pura).
- Este mismo motor lo va a reusar Phase 32 (panel de preview + snippets) sin necesitar `@auditor/checks`/`@auditor/db` — motivo real de aislarlo en paquete propio en vez de meterlo directo en `packages/checks`.

### checkIds y estructura de checks

- checkIds: `SOCIAL-01` a `SOCIAL-08`, match 1:1 con el requirement ID (sin colisión — confirmado que no existe ningún checkId `SOCIAL-*` en el catálogo actual). Fingerprint compuesto por subtipo donde aplique (ej. `SOCIAL-01:missing`, `SOCIAL-01:too-short`), mismo patrón que `TECH-04:cross-domain`. El test de Phase 29 (`packages/report-model/src/build.test.ts:221`) ya usa el formato `SOCIAL-01:og-title` — mantener consistencia con eso.
- Un `PageCheck` por archivo (mismo patrón "un archivo = un check" que `title.ts`/`metaDescription.ts`/`h1.ts`), no un check monolítico. Carpeta nueva `packages/checks/src/checks/social/`, paralela a `onpage/`/`tech/`/`schema/`/`aeo/`, con su propio `index.ts` (`socialPageChecks`) importado en `packages/checks/src/registry.ts`.
- SOCIAL-04 (og:url coherente con canonical) relee el canonical directo del `$` ya cargado (`$('link[rel="canonical"]').attr('href')`), sin depender del resultado de `TECH-04`/`canonicalCheck` — los `PageCheck` no comparten estado entre sí (`PageCheckCtx` sólo da `page`+`$`). Fallback a `page.finalUrl ?? page.url` si no hay canonical explícito, mismo patrón que `canonicalCheck`.

### Casos borde / anti-falso-positivo

- SOCIAL-07: mapeo `twitter:title`↔`og:title`, `twitter:description`↔`og:description`, `twitter:image`↔`og:image`. `twitter:card` se evalúa siempre (no tiene equivalente OG). Los tres campos secundarios (`twitter:title/description/image`) se evalúan como error SÓLO cuando faltan tanto el `twitter:*` como su equivalente `og:*` — si el OG existe, no se penaliza la ausencia del `twitter:*` correspondiente.
- SOCIAL-06 (duplicados OG): agrupar `meta[property]` por su valor de `property`; marcar issue sólo cuando un grupo tiene >1 tag Y sus `content` difieren entre sí. Duplicados con el mismo valor exacto (redundantes pero sin ambigüedad) NO se marcan como error.
- SOCIAL-08 (charset en el primer 1KB): medir sobre el HTML crudo (`page.html`, no sobre `$` ya parseado, que pierde posición), buscando `<meta charset` o `<meta http-equiv="Content-Type" ... charset=` dentro de los primeros 1024 bytes REALES (`Buffer.byteLength`-acotado, no `.slice(0,1024)` por caracteres) — mismo rigor que Phase 28 aplicó a `htmlBytes` para no subestimar el corte si hay multibyte antes de la declaración de charset.
- SOCIAL-05 (og:type): sólo verifica presencia, sin validar el valor contra una lista de tipos válidos (`website`/`article`/etc.) — el requirement no lo pide.

### Claude's Discretion

- Nombre exacto del export del paquete (`extractMetaSocial` como punto de partida, ajustable) y forma exacta del tipo `MetaSocialData`.
- Redacción exacta de `title`/`criterion`/`recommendation` de cada uno de los 8 checks — seguir el tono ya validado (español neutro, sin voceo, imperativo impersonal, ver `title.ts`/`contentLength.ts` como referencia).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/onpage/title.ts` — referencia de patrón `PageCheck` con longitud mín/máx + severidad de 2 niveles + issue "ok" explícito.
- `packages/checks/src/checks/tech/canonical.ts` — patrón de lectura de `link[rel="canonical"]` vía `$`, con fallback `page.finalUrl ?? page.url`.
- `packages/checks/src/checks/phase11-guardrail.test.ts` — patrón de test de no-colisión de fingerprint entre checks de categorías distintas sobre la misma página (referencia directa para el guardarraíl de SOCIAL-09/Success Criterion #5 de esta fase).
- `packages/report-model/src/build.test.ts:217-236` — ya ejercita un issue sintético `checkId: "SOCIAL-01:og-title"`, `category: "social"` end-to-end contra `model.issuesByCategory.social` (de Phase 29) — confirma que el pipeline de agregación ya está listo para recibir estos checks reales sin cambios adicionales.
- `packages/checks/src/checks/onpage/openGraph.ts` (ya retirado en Phase 29) — el código fuente sigue disponible en el historial de git (`git show cdf9fb1^:packages/checks/src/checks/onpage/openGraph.ts`) como referencia de qué tags OG básicos evaluaba antes, útil para no repetir el mismo enfoque simplificado.

### Established Patterns
- Categoría `"social"` y sus pesos ya existen en `packages/scoring/src/overallScore.ts` desde Phase 29 — esta fase sólo necesita que los `IssueDraft` usen `category: "social"` literal (ahora con guard defensivo en `scoreOverall` desde el fix W-01 de Phase 29 — un typo ya no rompe el score general, pero igual hay que escribir el literal correcto).
- `packages/checks/src/registry.ts` sigue el patrón array-plano + import de barrel por categoría (`onPageChecks`, `techPageChecks`, etc.) — agregar `socialPageChecks` ahí es el único punto de integración con el catálogo global.

### Integration Points
- `packages/checks/src/registry.ts` — agregar import + spread de `socialPageChecks` en el array `pageChecks`.
- `packages/checks/package.json` — nueva dependencia de workspace en `@auditor/meta-social`.
- `.planning/ROADMAP.md` Phase 30 — Success Criterion #5 (guardarraíl anti-duplicados SOCIAL-09) ya agregado por decisión de Phase 29 (W-06), debe cubrirse explícitamente con un test en esta fase.

</code_context>

<specifics>
## Specific Ideas

Ninguna referencia específica adicional — las 3 áreas grises fueron aceptadas con la respuesta recomendada en las 3 rondas.

</specifics>

<deferred>
## Deferred Ideas

- Validación de valores específicos de `og:type` contra una lista cerrada (`website`, `article`, etc.) — fuera de scope, el requirement sólo pide presencia.
- Todos los `twitter:*` como obligatorios — explícitamente descartado en REQUIREMENTS.md (Out of Scope) por generar falsos positivos masivos.

</deferred>
