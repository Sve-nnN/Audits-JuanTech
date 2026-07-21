# Project Research Summary

**Project:** Auditor Web (SEO/Técnico) — milestone v1.5: fingerprinting de stack técnico + recomendaciones de fix personalizadas por CMS
**Domain:** Extensión de un auditor SEO/técnico ya existente (crawler Crawlee + checks + report model) con detección heurística de tecnología web y un motor de recomendaciones adaptador-por-plataforma
**Researched:** 2026-07-21
**Confidence:** MEDIUM-HIGH

## Executive Summary

Este milestone agrega dos capacidades relacionadas sobre el pipeline de auditoría ya construido (Crawlee + Cheerio + Prisma + BullMQ, monorepo pnpm/Turborepo): (1) un fingerprint propio de stack técnico (CMS/builder, CDN/proxy, hosting, framework JS, analytics), sin adoptar ninguna librería de terceros empaquetada, porque toda opción "instalar y listo" (wappalyzer-core) está deprecada, licenciada GPL-3.0, o es una API paga — todas incompatibles con el requisito explícito de "sin servicios pagos de terceros"; y (2) un motor de recomendaciones que reescribe el fix de cada issue detectado según el CMS/builder identificado (WordPress+builder, Shopify, Webflow, Wix/Squarespace), con un fallback genérico obligatorio. Ningún competidor de referencia (Screaming Frog, Ahrefs, SEMrush) combina auditoría técnica completa con fix personalizado por plataforma — es el diferenciador central de este lead magnet frente a herramientas puramente de "technology profiling" (Wappalyzer/BuiltWith), que se detienen en "esto es lo que usa el sitio" sin dar el siguiente paso accionable.

El enfoque recomendado es 100% aditivo sobre la arquitectura existente: dos paquetes nuevos (`packages/fingerprint`, `packages/cms-adapters`) que nunca acoplan `packages/checks` a conocimiento de plataforma — el único punto de contacto es el `checkId` string ya persistido en cada `Issue`. El fingerprint se computa una sola vez por auditoría (patrón "compute-once-and-thread-through" ya usado en el proyecto para `buildLinkGraph`/`runRenderSample`), reusando el HTML y headers que el crawl Cheerio-first ya captura — cero requests nuevas, cero llamadas a Playwright, cero servicios externos. La resolución de la recomendación personalizada ocurre en tiempo de lectura (`buildReportModel`), nunca se reescribe en la base de datos, preservando el patrón ya establecido de "single source of truth" del report model.

El riesgo principal no es técnico sino de credibilidad del reporte: un fingerprint que afirma certeza donde no la hay (CMS mal detectado, builder incorrecto) daña la confianza en TODO el reporte, incluidos los checks SEO 100% verificables. La investigación de pitfalls es enfática y consistente en esto: el contrato de datos del detector debe incluir `confidence` desde el primer commit (nunca `string | null`), el motor debe manejar explícitamente el estado "no identificado / headless-JAMstack" como resultado legítimo (no como fallo), y el fallback genérico debe ser un adapter de primera clase, no un afterthought. Mitigación: diseñar el contrato de confianza y los estados "alta/media/no identificado" antes de escribir una sola regla de detección o un solo texto de fix — cambiar esto después implica retocar cada adapter y cada UI que ya lo consume.

## Key Findings

### Recommended Stack

No se necesita ningún framework nuevo ni dependencia de peso. La decisión de stack central es construir un matcher de firmas propio (~150-300 líneas, patrón registry sobre el mismo `cheerio.load()` que `packages/checks` ya ejecuta) en vez de adoptar `wappalyzer-core` (deprecado desde 2023, GPL-3.0) o cualquier API paga de detección. La única dependencia de runtime genuinamente nueva es `set-cookie-parser` (3.1.2, cero dependencias) para parsear correctamente los headers `Set-Cookie` que hoy se descartan.

**Core technologies:**
- `packages/fingerprint` (workspace nuevo, TS plano): motor de matching de firmas sobre `{ headers, html, cookies, scriptSrc, metaGenerator }` — reusa el mismo patrón de registry tipado que ya existe en `packages/checks/src/registry.ts`
- `set-cookie-parser` 3.1.2: parsear `Set-Cookie` crudo (nombres de cookie, no valores — ver pitfall de seguridad) — cero deps, mantenido activamente
- `cheerio` (ya dependencia existente): extraer meta generator, `scriptSrc`, marcadores DOM de builders — reusar el mismo `$` ya cargado, no un segundo parseo
- Dataset propio de ~40-60 firmas curadas (CMS, builders WP, CDN, framework JS, analytics), escritas desde investigación propia — el dataset público de `enthec/webappanalyzer` sirve solo como referencia de verificación cruzada, no como fuente para copiar (licencia GPL-3.0)

### Expected Features

Screaming Frog/Ahrefs/SEMrush no tratan la detección de CMS como feature central de auditoría; Wappalyzer/BuiltWith se detienen en "esto es lo que usa el sitio" sin dar el paso siguiente. El vacío competitivo real es combinar ambos: auditoría técnica completa + fix reescrito para el admin real del CMS detectado.

**Must have (table stakes):**
- Detección de CMS principal (WordPress, Shopify, Webflow, Wix, Squarespace, "no detectado") — prerequisito de todo lo demás
- Tabla de "stack detectado" visible al inicio del reporte
- Fallback "no se pudo detectar con certeza" — nunca forzar una respuesta cuando la señal es insuficiente

**Should have (competitivo, corazón del milestone):**
- Motor de recomendaciones adaptador-por-plataforma (WordPress/Shopify/Webflow/Wix-Squarespace + fallback genérico obligatorio) — el diferenciador real frente a cualquier competidor mencionado
- Detección de builder de WordPress (Elementor, WPBakery, Divi) — afina el "cómo" del fix dentro del adaptador WordPress
- Detección de CDN/proxy, hosting/servidor, framework JS, analytics — bajo costo relativo, alto valor de "expertise completo"
- Fix personalizado priorizado en los checks de mayor volumen/impacto: alt text, title/meta, H1, OG tags, canonical, JSON-LD, sitemap/robots.txt

**Defer (v2+):**
- Adaptador Squarespace separado de Wix, más builders WP (Beaver Builder, Oxygen, Bricks), detección de plugins SEO (Yoast/Rank Math)
- Historial de cambios de stack entre corridas, confianza cuantitativa (%) en vez de alto/medio/bajo
- Fix personalizado en checks CMS-agnósticos (hreflang, mixed content, profundidad de clics) — técnicamente iguales sin importar el CMS, no ganan nada con personalización
- Auto-corrección de issues (explícitamente fuera de alcance de todo el producto)

### Architecture Approach

Dos paquetes nuevos, aditivos, que preservan el aislamiento de `packages/checks`: `packages/fingerprint` (detección pura, sync, cero acoplamiento a plataforma) y `packages/cms-adapters` (resolución de recomendación, import solo de tipo desde fingerprint, nunca de runtime). El fingerprint se calcula una vez por auditoría desde el `Page[]` ya cargado (mismo patrón que `buildLinkGraph`/`runRenderSample`), se persiste como `Audit.stack Json?` nuevo, y `packages/report-model` resuelve la recomendación personalizada en tiempo de lectura vía `resolveCmsRecommendation(stack, checkId, genericRecommendation)` — nunca reescribe `Issue.recommendation` en la base.

**Major components:**
1. `packages/fingerprint` — detección independiente por eje (`cms`, `cdn`, `hosting`, `jsFramework`, `analytics`), nunca winner-take-all; cero dependencia de `@auditor/db`/`@auditor/crawler`/`@auditor/checks`
2. `packages/cms-adapters` — un módulo por plataforma (`wordpress/`, `shopify/`, `webflow/`, `wix-squarespace/`), lookup `checkId → texto de fix`, fallback genérico como entrada de primera clase del mismo registry
3. `packages/crawler` (modificado) — captura allowlist de headers de respuesta por página (`Page.responseHeaders`), solo nombres de cookies, nunca valores
4. `packages/report-model` (modificado) — parsea `Audit.stack`, resuelve `ReportIssue.recommendation` por issue en `buildReportModel()`
5. `apps/web` — nuevo componente `StackTable` en el reporte; `IssuesTable` no requiere cambios (ya lee `recommendation` resuelto)

### Critical Pitfalls

1. **Fingerprint como booleano en vez de probabilístico** — el detector debe devolver siempre `{ platform, confidence: high/medium/low, signals }`, nunca `string | null`; fijar este contrato de datos antes de escribir el motor de recomendaciones (cambiarlo después obliga a retocar cada adapter)
2. **Headers de servidor como señal única sin fallback** — CDNs/WAFs (Cloudflare, Fastly, Akamai) strippean headers de origen en la mayoría de sitios reales de producción; diseñar detección multi-señal (headers + cookies + paths de assets) desde el día uno, y nunca reportar "no detectado" como "no usa CDN"
3. **Gutenberg sin regla positiva** — el editor nativo de WordPress no deja huella propietaria como los builders de terceros; tratarlo como detector positivo explícito (`wp-block-*`), no como default/else implícito
4. **Meta generator como única señal de CMS** — sitios con hardening de seguridad (el público objetivo más cuidadoso, justo los leads de mayor valor) lo remueven deliberadamente; el CMS debe determinarse igual sin él vía paths/cookies/patrones de API
5. **Arquitecturas headless (WordPress headless, Shopify Hydrogen) rompen firmas clásicas** — reconocer "frontend desacoplado, CMS no identificado" como estado legítimo y distinto del fallback genérico total, no como fallo silencioso
6. **Fix mapeado solo por plataforma, ignorando builder** — el mismo texto de fix para Gutenberg/Elementor/Divi es técnicamente correcto pero inútil como instrucción accionable; diseñar el catálogo con fallback en cadena (plataforma+builder → plataforma → genérico universal) desde el modelo de datos inicial

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Contrato de datos del fingerprint + captura de headers/cookies
**Rationale:** Todo lo demás depende de este contrato (confidence incluido); cambiarlo después implica retocar cada adapter y cada UI consumidora. También es el único paso con dependencia dura de esquema (migración Prisma bloquea el resto).
**Delivers:** Migración Prisma (`Page.responseHeaders Json?`, `Audit.stack Json?`), `packages/crawler` modificado (captura allowlist de headers + nombres de cookies), tipos `DetectedStack`/`FingerprintInput` en `packages/fingerprint`
**Addresses:** Prerequisito de "Detección de CMS principal" y "Fallback no detectado con certeza" de FEATURES.md
**Avoids:** Pitfall 1 (fingerprint booleano) — el contrato de tipos con `confidence` se fija aquí, antes de escribir ninguna regla real

### Phase 2: Motor de fingerprint — CMS, builder, CDN/hosting, framework JS, analytics
**Rationale:** Con el contrato fijo, el trabajo de reglas por eje es independiente y paralelizable (un archivo de reglas por eje: `cms.ts`, `cdn.ts`, `hosting.ts`, `jsFramework.ts`, `analytics.ts`).
**Delivers:** `packages/fingerprint` completo con detección independiente por eje (nunca winner-take-all), dataset propio de ~40-60 firmas curadas
**Uses:** `set-cookie-parser`, `cheerio` (reuso del `$` ya cargado en `runAllChecks`), patrón de registry de `packages/checks`
**Implements:** Patrón 2 (independent-axis detection) y Patrón 1 (compute-once) de ARCHITECTURE.md
**Avoids:** Pitfall 2 (CDN/headers strippeados), Pitfall 3 (Gutenberg sin regla positiva), Pitfall 4 (meta generator como única señal), Pitfall 5 (headless/JAMstack)

### Phase 3: Wiring en el worker + tabla de stack en el reporte
**Rationale:** Antes de invertir en el motor de recomendaciones (el trabajo más costoso), validar que el fingerprint produce resultados útiles y visibles end-to-end da feedback temprano y desbloquea QA manual contra sitios reales.
**Delivers:** `detectStack()` llamado una vez por auditoría en `apps/worker`, persistido en `Audit.stack`; componente `StackTable` en `apps/web` con al menos 3 estados visuales de confianza (alta/media/no identificado)
**Addresses:** "Tabla de stack detectado al inicio del reporte" de FEATURES.md
**Avoids:** Pitfall UX de comunicación de incertidumbre (mostrar confianza con el mismo peso visual que los badges de severidad ya existentes)

### Phase 4: Motor de recomendaciones — patrón adaptador + fallback en cadena
**Rationale:** El componente de mayor costo de implementación (HIGH en la matriz de priorización) y el diferenciador central del milestone; depende de que el fingerprint (fase 2) ya exponga `checkId`-compatible `DetectedStack` con builder incluido.
**Delivers:** `packages/cms-adapters` (WordPress con niveles builder→plataforma→genérico, Shopify, Webflow, Wix/Squarespace agrupado), `resolveCmsRecommendation` integrado en `buildReportModel`
**Addresses:** "Motor de recomendaciones adaptador-por-plataforma" y "Fix personalizado" de FEATURES.md — priorizar alt text, title/meta, H1, canonical, JSON-LD, sitemap/robots.txt
**Avoids:** Pitfall 6 (fix solo por plataforma, ignorando builder) — el modelo de datos con fallback en cadena debe diseñarse antes de escribir el primer fix real

### Phase 5 (opcional, puede diferirse sin bloquear): Paridad en exports
**Rationale:** No bloquea el valor central del milestone (reporte web); puede shippearse en una fase posterior sin afectar 1-4.
**Delivers:** Sección de stack table + recomendaciones personalizadas en PDF/Markdown/PPTX (`packages/export`)

### Phase Ordering Rationale

- El orden respeta la dependencia de build identificada en ARCHITECTURE.md: DB migration → fingerprint (paralelo, tipos locales) → crawler (necesita columna nueva) → cms-adapters (solo tipos de fingerprint) → worker wiring → report-model → web → export
- Separar "motor de fingerprint" (fase 2) de "motor de recomendaciones" (fase 4) permite validar la detección contra sitios reales antes de invertir en las ~100+ piezas de copy de fix por plataforma×builder×check
- Fase 3 (wiring + UI mínima) intercalada antes del motor de recomendaciones da un punto de validación temprano end-to-end sin esperar el trabajo más costoso

### Research Flags

Phases likely needing deeper research during planning:
- **Fase 2 (motor de fingerprint):** las firmas concretas de builders WP (Elementor/WPBakery/Divi/Gutenberg) y de CDN son de fuentes MEDIUM confidence (blogs/comunidad agregados, no verificados contra sitios reales) — recomendable verificación puntual contra 2-3 instalaciones reales por builder durante implementación, y fixtures explícitos de WordPress headless/Shopify Hydrogen y sitio detrás de Cloudflare
- **Fase 4 (motor de recomendaciones):** el detalle de "cómo se ve el fix en cada plataforma×builder" para JSON-LD/canonical en Shopify/Webflow probablemente necesita revisión contra la documentación oficial de cada plataforma al momento de escribir el copy final (ya hay ejemplos de referencia en FEATURES.md, pero no cubren todos los checks priorizados)

Phases with standard patterns (skip research-phase):
- **Fase 1 (contrato de datos + migración):** patrón ya establecido en el proyecto (columnas Json adicionales nullable, mismo precedente que `resolvedUrl`/`schemaGraph`)
- **Fase 3 (wiring + tabla UI):** sigue patrones ya usados (`buildLinkGraph`/`runRenderSample` compute-once; componentes tokens-only como `CategoryCard`/`Badge`)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (decisión central) / MEDIUM (firmas puntuales) | La decisión de no adoptar wappalyzer-core está verificada directo contra el registro npm (deprecado, GPL-3.0). Las firmas concretas de headers/cookies por CDN/CMS son agregado de fuentes cruzadas, sin verificación contra sitios reales |
| Features | MEDIUM | Patrones de ecosistema bien establecidos (comparativas de competidores), pero sin acceso directo a UI interna de herramientas comerciales pagas (Ahrefs/SEMrush) |
| Architecture | HIGH | Derivada directamente del código real del repo (`schema.prisma`, `crawl.ts`, `registry.ts`, `build.ts` leídos directamente); solo la lista de firmas específicas es de fuente externa |
| Pitfalls | MEDIUM | Web search cruzado en múltiples fuentes independientes coincidentes; dominio inherentemente basado en consenso comunitario (fingerprinting heurístico), no en spec oficial |

**Overall confidence:** MEDIUM-HIGH — la arquitectura de integración y la decisión de stack central son sólidas (verificadas contra el codebase real y el registro npm); el detalle fino de firmas y copy de fix por plataforma necesita validación empírica durante la implementación.

### Gaps to Address

- **Firmas de builder WP y CDN no verificadas contra sitios reales:** planear un paso de QA manual contra 2-3 instalaciones reales por builder (Elementor/WPBakery/Divi/Gutenberg) y al menos un sitio real detrás de Cloudflare durante la fase de implementación del fingerprint, no solo tests con fixtures sintéticos
- **Cobertura de copy de fix por plataforma para checks fuera de los ejemplos ya calibrados** (FEATURES.md solo detalla alt text, canonical y JSON-LD por plataforma): el resto de checks priorizados (title/meta, H1, OG tags, sitemap/robots.txt) necesita el mismo nivel de detalle escrito durante la fase 4, cruzado contra documentación oficial de cada plataforma
- **Decisión de granularidad Wix vs Squarespace:** la investigación agrupa ambos bajo un solo adapter técnico pero con detección separada a nivel de label — validar en la primera vuelta si el fallback compartido produce copy suficientemente específico o si conviene separarlos antes de lo planeado en "Add After Validation"

## Sources

### Primary (HIGH confidence)
- Codebase real del proyecto: `packages/db/prisma/schema.prisma`, `apps/worker/src/index.ts`, `packages/crawler/src/crawl.ts`, `packages/checks/src/{types,registry}.ts`, `packages/report-model/src/{model,build}.ts` — arquitectura de integración
- Registro de npm, consulta directa (`npm view wappalyzer-core`, `npm view set-cookie-parser`, `npm view cheerio`, `npm view crawlee`, verificado 2026-07-21) — versiones y estado de deprecación
- WordPress Developer Resources (`body_class()`), Webflow/Shopify/Squarespace/Wix Help Centers (alt text, SEO settings) — documentación oficial de cada plataforma

### Secondary (MEDIUM confidence)
- [Wappalyzer articles — find out what CMS or framework a site is using](https://www.wappalyzer.com/articles/find-out-what-cms-or-framework-a-website-is-using/) — metodología de fingerprinting estándar (headers, meta generator, cookies)
- [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) — schema de referencia de firmas (GPL-3.0, no vendorizar)
- [Stackcrawler — WordPress Website Builder Detector](https://stackcrawler.com/wordpress-website-builder-detector) y fuentes similares — firmas de builders WP por prefijo de clase
- [Cloudflare Community discussions], [WordPress.com — What Is Headless WordPress] — comportamiento de CDN/WAF y arquitecturas headless
- Comparativas de competidores (Screaming Frog/Ahrefs/SEMrush reviews 2026) — posicionamiento de features

### Tertiary (LOW confidence)
- Artículos comparativos de terceros sobre ausencia de CMS-detection en UI de herramientas comerciales pagas — inferencia razonable, no verificación directa contra las UIs reales

---
*Research completed: 2026-07-21*
*Ready for roadmap: yes*
