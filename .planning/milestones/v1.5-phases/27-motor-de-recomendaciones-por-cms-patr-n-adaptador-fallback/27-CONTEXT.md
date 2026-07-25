# Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Los issues de los checks de mayor volumen (alt text, title/meta, H1, Open Graph, canonical, JSON-LD, sitemap/robots.txt) muestran instrucciones de fix personalizadas según el CMS y builder detectados del sitio auditado, con un fallback genérico garantizado cuando no aplica un adaptador específico. La personalización se resuelve al construir el modelo de reporte (nunca persistida pre-calculada), por lo que aparece también en las exportaciones sin trabajo adicional.

</domain>

<decisions>
## Implementation Decisions

### Arquitectura del motor de resolución
- Catálogo por adaptador como `Record<checkId, string>` plano — una instrucción "dónde/cómo editar" por checkId. Los sub-casos de un mismo checkId (ej. title muy corto vs muy largo) comparten instrucción; el WHY/QUÉ específico ya lo muestran `title`/`measuredValue`/`criterion` en la tabla de issues existente, sin cambios.
- Umbral de confianza que activa un adaptador de plataforma: `alto` **y** `medio`. Solo `bajo`/`no-detectado` fuerzan el fallback genérico.
- WordPress con builder `no-detectado` (CMS confirmado, sin builder claro): copy con ramas ("Si usás el editor nativo de WordPress... Si usás Elementor/Divi/WPBakery...") — cubre casos sin afirmar certeza de detección, mismo patrón ya calibrado en research (FEATURES.md, ejemplo alt text).
- Wix y Squarespace: mismo módulo técnico (`wix-squarespace/`) pero copy interno distinto por label detectado (Wix vs Squarespace tienen UI de edición bastante diferente) — no un texto único genérico para ambos.

### Cobertura de checks y granularidad
- 10 checkIds objetivo confirmados en código: `ONPAGE-01` (title), `ONPAGE-02` (meta description), `ONPAGE-03` (H1), `ONPAGE-04` (alt text), `ONPAGE-05` (Open Graph), `TECH-01` (robots.txt), `TECH-02` (sitemap), `TECH-04` (canonical), `SD-01` (JSON-LD presencia), `SD-02` (JSON-LD validez). Title y meta description quedan como entradas separadas (no combinadas) aunque compartan panel de plugin SEO en WordPress.
- Granularidad por builder de WordPress solo en **alt text** y **JSON-LD** (donde el builder realmente cambia el "cómo" se edita/agrega). El resto de los checks WordPress queda a nivel plataforma (sin variantes por builder).
- Los checks fuera de esta lista (hreflang, mixed content, enlaces rotos, profundidad de clics, etc.) **nunca** pasan por `resolveCmsRecommendation` — mantienen su `recommendation` genérica intacta, sin excepción (CMSFIX-04).
- El copy nuevo para los checks aún no calibrados en research (title, meta description, H1, Open Graph, robots.txt, sitemap — solo alt text/canonical/JSON-LD tienen ejemplo en FEATURES.md) se investiga contra documentación oficial de cada plataforma (Yoast/Rank Math, Shopify Help Center, Webflow Help Center, Wix Support, Squarespace Help Center) durante el research del plan. Cualquier ambigüedad de precisión queda marcada explícita en el PLAN para revisión.

### Tono, idioma y formato del copy
- Español neutro **sin voceo** en todo el copy nuevo — consistente con la convención ya validada del producto (COPY-01..03, v1.1) y con el copy real ya en código (`"Agrega"`, `"Completa"`, `"Deja"`). El ejemplo de voceo en FEATURES.md ("Agregá...") es solo referencia de contenido/estructura, no de forma gramatical — se corrige a neutro.
- Longitud/formato: 1-3 oraciones, mencionando la ruta de menú concreta en el admin de la plataforma — mismo nivel de detalle que los ejemplos ya calibrados en FEATURES.md (alt text, canonical, JSON-LD).
- Para WordPress, mencionar Yoast SEO **y** Rank Math como opciones (sin poder detectar cuál está instalado — fuera de alcance v1.5), más una nota de fallback si no tiene ninguno instalado (editar tema/código o instalar uno de los dos) — mismo patrón ya calibrado en el ejemplo de canonical.
- Se pueden mencionar features de pago (ej. "Elementor Pro" para JSON-LD) con una aclaración breve "(versión Pro)" — información honesta y útil, no se oculta que existe una opción paga.

### Testing y garantías de calidad
- `packages/cms-adapters`: tests de resolución (fallback correcto por combinación de confianza/plataforma/checkId) + test de cobertura completa (10 checkIds × 5 plataformas = 50 entradas, ninguna faltante/vacía). No se testea tono o calidad de prosa.
- Verificación end-to-end contra un audit real (mismo patrón ya establecido de `verify-stack.mts` en Phase 26, documentado en Notas de ejecución de STATE.md) — confirma que el reporte muestra el texto personalizado correcto para un sitio real conocido (ej. aprendoclub si es WordPress).
- El texto del fallback genérico debe ser **100% idéntico** al `recommendation` genérico actual — cero regresión (CMSFIX-04), no se aprovecha para mejorar/estandarizar copy existente de paso.
- Naming confirmado: paquete `@auditor/cms-adapters`, función `resolveCmsRecommendation(stack, checkId, genericRecommendation)`, integrado en `packages/report-model/src/build.ts` (mismo mapeo donde hoy se lee `issue.checkId`/`issue.recommendation`).

### Claude's Discretion
Ninguna decisión quedó en discreción total de Claude — las 4 áreas se resolvieron con "Aceptar todo" sobre las propuestas recomendadas.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DetectedStack`/`AxisResult`/`Confidence` de `@auditor/fingerprint` (Phase 25) — ya expone `cms`/`builder` con confianza tipada por eje.
- `ReportStack`/`toReportStack` + lectura escalar de `audit.stack` ya wireados en `packages/report-model/src/build.ts` (Phase 26, líneas ~178-183) — `stack` disponible en `buildReportModel` antes del mapeo de issues.
- `IssueDraft.recommendation`/`checkId` ya estables en `packages/checks/src/types.ts` — 10 checkIds objetivo confirmados por grep directo en el código (ver Decisiones).

### Established Patterns
- Compute-once-and-thread-through (mismo patrón que `buildLinkGraph`/`runRenderSample`/`detectStack`) — resolución en tiempo de lectura, nunca persistida en DB.
- Paquetes puros sin dependencia runtime cruzada (`fingerprint`, `graph`, `scoring`) — `cms-adapters` solo importa **tipos** de `fingerprint` (`CmsPlatform`/`DetectedStack`), cero import de `checks` en ningún sentido; el único punto de contacto es el string `checkId`.
- Copy existente en checks (`title.ts`, `canonical.ts`, `altText.ts`, `jsonldPresence.ts`) usa español neutro sin voceo — convención COPY-01..03 ya validada en v1.1.
- Verificación runtime contra audit real vía script `tsx` (patrón `verify-stack.mts` de Phase 26).

### Integration Points
- `packages/report-model/src/build.ts` — mapeo de issue (`checkId` L112, `recommendation` L119): punto exacto donde inyectar `resolveCmsRecommendation(stack, issue.checkId, issue.recommendation)`.
- `packages/cms-adapters` (paquete nuevo) — módulos `wordpress/`, `shopify/`, `webflow/`, `wix-squarespace/` + `registry.ts` + `resolveCmsRecommendation.ts`, mismo patrón estructural que `packages/fingerprint`.
- Sin cambios en `packages/checks` (nunca importa ni conoce plataformas) ni en `apps/web` (`IssuesTable` ya lee `ReportIssue.recommendation` sin plumbing adicional) ni en `packages/export` en esta fase (la personalización llega gratis a PDF/Markdown/PPTX vía `ReportModel`, sin cambios en el módulo de export).

</code_context>

<specifics>
## Specific Ideas

- Ejemplos de copy ya calibrados en research (`.planning/research/FEATURES.md`, sección "Ejemplos concretos") para alt text, canonical y JSON-LD — sirven de referencia de tono/formato/nivel de detalle para escribir los 7 checks restantes durante el research del plan.
- Confianza `medio` también activa el adaptador de plataforma (no solo `alto`) — decisión explícita, más permisiva que el umbral por defecto sugerido en algunas partes de la research.
- Wix y Squarespace comparten módulo técnico pero el copy interno distingue por label detectado (dos claves de contenido dentro del mismo módulo, no un solo texto).

</specifics>

<deferred>
## Deferred Ideas

- Adaptador Squarespace separado de Wix (módulo propio) — ya registrado en REQUIREMENTS.md v2 (CMSFIX-06/07) y en "Add After Validation" de FEATURES.md; no se toca en esta fase.
- Detección de plugin SEO de WordPress instalado (Yoast vs Rank Math) para afinar aún más la instrucción — fuera de alcance v1.5; el copy simplemente menciona ambos como opción.
- Fix personalizado en checks CMS-agnósticos (hreflang, mixed content, enlaces rotos, profundidad de clics) — explícitamente fuera de alcance (CMSFIX-04), mantienen recommendation genérica sin cambios.
- Más builders de WordPress (Beaver Builder, Oxygen, Bricks) — fuera de alcance v1.5 (ya en "Add After Validation" de FEATURES.md).

</deferred>
