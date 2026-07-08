# Stack Research — v1.3 (checks técnicos + visualización de arquitectura)

**Domain:** Adiciones de stack para milestone v1.3 (5 features sobre un SEO auditor existente: Next.js 15/React 19 en Vercel + worker Crawlee/Playwright + Postgres/Prisma + BullMQ)
**Researched:** 2026-07-08
**Confidence:** HIGH

## Resumen ejecutivo

De las 5 features, **4 no requieren ninguna dependencia nueva** — son extensiones de código sobre patrones ya validados en el repo (`packages/checks`, `packages/psi`, `@auditor/report-model`). La única decisión de stack real es la **#5 (visualizador de arquitectura)**, y la recomendación es **no añadir ninguna librería de grafos/árboles**: usar SVG nativo + React, siguiendo exactamente el patrón que el propio proyecto ya estableció en `apps/web/app/components/EntityGraphSvg.tsx` (grafo de entidades del JSON-LD, ya en producción desde v1.0-v1.1).

## Recommended Stack

### Core Technologies

No hay cambios de core stack. Next.js 15 (App Router) + React 19 + Prisma/Postgres + Crawlee/Cheerio siguen siendo la base; las 5 features son aditivas dentro de esos límites ya decididos.

### Supporting Libraries (por feature)

| Feature | Librería nueva | Versión | Por qué (o por qué no) |
|---------|---------------|---------|------------------------|
| #1 Schema-content mismatch | Ninguna | — | Cheerio (ya en `@auditor/checks` vía `@crawlee/cheerio`/`cheerio`) es suficiente: parsear el JSON-LD ya extraído (reutiliza el parser de `packages/checks/src/checks/schema`) y buscar substrings/patrones del contenido declarado (preguntas de FAQPage, pasos de HowTo, rating de Product+AggregateRating) en el texto visible del DOM (`$("body").text()` normalizado). Mismo patrón que `orphanPages.ts`: cargar `page.html` con `cheerio.load`, sin fetch adicional. |
| #2 Click-depth (3-click rule) | Ninguna | — | `Page.depth` ya persistido por Prisma (crawler ya lo calcula). El check es puro cálculo sobre datos existentes (nuevo `SiteCheck` que agrupa `pages` por `depth` y emite `IssueDraft` cuando `depth > 3`). Superficie en reporte: extender `buildReportModel`/agrupación existente, no requiere UI nueva más allá de una columna/badge de profundidad reutilizando `Badge` (ya en la librería de componentes de v1.1). |
| #3 Lighthouse diagnostics/opportunities | Ninguna | — | Ya se paga y se recibe la respuesta completa de PSI; `packages/psi/src/parser.ts` sólo lee 4 campos de `lighthouseResult.audits`. Extender `parsePsiResponse` (o una función hermana `parsePsiOpportunities`) para leer los mismos `audits[auditId]` ya presentes en `RawPsiResponse`, usando `details.overallSavingsMs` / `details.overallSavingsBytes` / `displayValue` — ver tabla de audit IDs abajo. Cero dependencias: es JSON ya en memoria. |
| #4 Template-based issue grouping | Ninguna | — | Heurística de clasificación de URL por patrón (home/categoría/producto/artículo) implementable con `URL` nativo + regex/segmentos de path — incluso path-based (`/producto/`, `/blog/`, `/categoria/`) y fallback a profundidad+cantidad de páginas similares (mismo patrón de segmentos). Vive como una función pura nueva en `@auditor/report-model` (paralela a `groupIssuesByType` en `grouping.ts`), consumida por la UI de reporte igual que la agrupación por tipo. |
| #5 Architecture visualizer (árbol jerárquico) | Ninguna (recomendado) | — | Ver sección dedicada abajo. |

### Development Tools

No aplica — no hay tooling nuevo (linters, bundlers, CI) requerido por estas features.

## Feature #5 en detalle: Architecture visualizer

### Decisión: SVG nativo + React, cero librería de grafos

**Recomendación: NO instalar `@xyflow/react`, `d3-hierarchy`, `@visx/hierarchy`, `react-arborist` ni `react-d3-tree`. Construir el árbol como un componente SVG/CSS propio, hermano de `EntityGraphSvg.tsx`.**

Razones (en orden de peso):

1. **Ya existe el patrón exacto en el repo y está validado en producción.** `apps/web/app/components/EntityGraphSvg.tsx` ya resuelve "renderizar un grafo con nodos y edges, sin dependencias externas, con colores por token del design system" — con un comentario explícito en el código: *"Self-contained SVG entity-graph renderer (no external libs / CDN — the deploy has a strict CSP)"*. El árbol de arquitectura es una versión **más simple** del mismo problema (jerarquía por `depth`, no un grafo con posicionamiento arbitrario), así que reutilizar el enfoque es consistente con la arquitectura de componentes ya aprobada y evita introducir un segundo paradigma de renderizado de visualizaciones en el mismo proyecto.

2. **La decisión de producto ya está tomada y es más simple de lo que las librerías de grafos resuelven.** El milestone dice explícitamente: *"árbol jerárquico por profundidad... sin migración de storage"* y el research prompt aclara *"NOT a full interactive graph with persisted edges"*. Un árbol de 4 niveles (0/1/2/3+) con nodos agrupados por página es un problema de **layout jerárquico estático**, no de física de grafos (fuerzas, colisión, arrastre de nodos) — el terreno donde React Flow/d3-force realmente aportan valor. Para 500 URLs máx. agrupadas en 4 buckets de profundidad, un layout determinístico (filas por profundidad, columnas repartidas por ancho disponible, con colapso/expansión vía estado de React) es trivial de calcular a mano.

3. **CSP estricto ya es una restricción confirmada del proyecto** (mencionado en el propio código de `EntityGraphSvg.tsx` y consistente con la decisión de v1.2 de "cero Chromium en Vercel" / librerías JS puras para exports). `@xyflow/react` inyecta estilos y depende de ResizeObserver/portal rendering con supuestos sobre el entorno de ejecución del cliente que no han sido validados contra ese CSP; adoptar una librería de UI de terceros de ~50-80kB gzip para un árbol de 4 niveles es una superficie de riesgo innecesaria en un producto lead-magnet que debe cargar rápido.

4. **Presupuesto de bundle.** Este es un producto Vercel-hosted, gratuito, cuyo único objetivo es convertir visitantes en emails verificados — cada KB de JS en la página de reporte compite con el tiempo hasta que el usuario ve su score. Comparación de peso (gzip, cliente):
   - `@xyflow/react` 12.11.2: ~55-70kB gzip (incluye zustand interno, drag/zoom/pan, minimap opcional).
   - `d3-hierarchy` 3.1.2: ~8-10kB gzip — mucho más liviano, pero sigue siendo una dependencia sólo para calcular un layout de árbol (`d3.tree()`/`d3.stratify()`) que se puede escribir a mano en <100 líneas dado que la jerarquía es de sólo 4 niveles fijos (no arbitraria).
   - `@visx/hierarchy@4.0.0` + `@visx/group@4.0.0`: similar a d3-hierarchy (visx es una capa de componentes React sobre los mismos algoritmos de d3), añade ~15-20kB sin resolver nada que un `<g>`/`<line>` manual no resuelva a esta escala.
   - `react-arborist@3.13.2` / `react-d3-tree@3.6.6`: pensadas para árboles de archivos/organigramas editables con muchísimos nodos y virtualización — over-engineered para 4 niveles fijos; además usan sus propios sistemas de theming que chocarían con el design system tokenizado (DS-01..04) ya construido en v1.1.
   - SVG nativo (enfoque recomendado): 0kB adicional — sólo JSX + CSS modules, exactamente como `EntityGraphSvg.tsx` + `EntityGraphSvg.module.css`.

5. **Theming tokens-only.** La decisión de v1.1 (*"Componentes tokens-only, cero hex crudo"*) es más fácil de cumplir con SVG/CSS propio (clases CSS module con `color: var(--token)`, `fill: currentColor`, tal como hace `EntityGraphSvg.module.css`) que forzando el theming de una librería de terceros a través de sus props/CSS variables propias.

### Cómo implementarlo (guía concreta para el ejecutor de la fase)

- **Estructura de datos:** nuevo tipo `ArchitectureTree` (o similar) construido en `@auditor/report-model`: agrupar `pages` por `Page.depth` en buckets `0`, `1`, `2`, `3+`; dentro de cada bucket, listar páginas (título/URL/categoría de plantilla si la feature #4 ya aportó el clasificador — reutilizar esa función).
- **Enlaces internos on-demand (el "grafo" del punto 5):** reusar literalmente el mismo parseo que `orphanPages.ts` — `cheerio.load(page.html)` + `$("a[href]")` + `normalizeUrl` + `sameRegistrableDomain` — para computar, sólo cuando el usuario lo pida (client-side toggle o ruta separada), las aristas padre→hijo por profundidad. No persistir aristas (coincide con la decisión "sin migración de storage").
- **Renderizado:** componente `ArchitectureTreeSvg` (Client Component `"use client"` si necesita interactividad de colapso vía `useState`, igual que otros componentes interactivos ya en `apps/web/app/components`).
- **Interactividad mínima necesaria:** colapsar/expandir ramas (estado React simple), tooltip/hover con detalles de la página. **No** se necesita pan/zoom real para 4 niveles — si una fila de profundidad tiene demasiados nodos, usar scroll horizontal nativo (`overflow-x: auto` en un contenedor) en vez de zoom/pan de librería.
- **Accesibilidad:** seguir el patrón ya usado en `EntityGraphSvg` (`role="img"`, `aria-label` descriptivo) más, si es interactivo, controles de colapso como `<button>` reales con `aria-expanded` (no divs clicables) para cumplir con A11Y-01..03 ya validado en v1.1.

### Cuándo SÍ reconsiderar una librería

- Si en el futuro el árbol necesita ser un **grafo real de enlaces internos con posicionamiento por fuerzas** (no jerárquico) y persistencia de aristas (fuera de scope explícito de v1.3), `d3-hierarchy`/`d3-force` (no `@xyflow/react`, que es para editores de flujo interactivos) sería la opción MEDIUM-confidence a evaluar primero por su bajo peso.
- Si el número de páginas por nivel de profundidad crece a punto de necesitar virtualización real (miles de nodos en una sola fila), ahí `react-arborist` sí justificaría su peso — no es el caso a 500 URLs máx.

## Lighthouse audit IDs para feature #3 (diagnósticos/opportunities)

Confirmado (HIGH confidence, vía tipos oficiales de Lighthouse `types/lhr/audit-details.d.ts` y `audit-result.d.ts` en el repo `GoogleChrome/lighthouse`):

- El shape de cada entrada en `lighthouseResult.audits[auditId]` que ya se tipa parcialmente en `RawPsiResponse` (`packages/psi/src/parser.ts`) puede extenderse así:

```typescript
interface RawAudit {
  score?: number | null;
  scoreDisplayMode?: string;
  numericValue?: number | null;
  numericUnit?: string;
  displayValue?: string;
  details?: {
    type?: string; // "opportunity" | "table" | ...
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    items?: Array<Record<string, unknown>>;
  };
}
```

- IDs de audit relevantes a extraer para "diagnósticos y oportunidades" (todos ya vienen en la respuesta PSI actual, sin costo extra):
  - `uses-webp-images` (formatos de imagen de próxima generación)
  - `unused-css-rules` (CSS sin usar)
  - `unused-javascript` (JS sin usar — mismo patrón de `details.overallSavingsBytes`)
  - `render-blocking-resources` (recursos que bloquean el render)
  - `properly-sized-images` (imágenes correctamente dimensionadas)
  - Opcionalmente ampliar a `uses-optimized-images`, `uses-text-compression`, `total-byte-weight` si se quiere una cobertura más completa del mismo tipo de dato — mismo shape, mismo costo cero.
- **Nota de vigencia (MEDIUM confidence, verificar en fase de implementación):** `overallSavingsMs` está marcado como parcialmente deprecado en favor de `metricSavings.LCP`/`metricSavings.FCP` en versiones recientes de Lighthouse — la respuesta de PSI v5 en producción puede incluir ambos campos. Al implementar, leer `overallSavingsMs` con fallback a `metricSavings` si está presente, y no asumir que sólo uno de los dos existirá indefinidamente.
- Mapeo a severidad: usar `overallSavingsMs`/`overallSavingsBytes` con los mismos umbrales de scoring health-ratio ya usados para LCP/CLS/TTFB (reutilizar la lógica de `packages/scoring`, no inventar una escala nueva) — p. ej. >500ms de ahorro potencial en un solo audit = `warning`, >1500ms = severidad más alta, siguiendo el patrón size-independent ya validado en v1.0.

## Installation

```bash
# No hay instalación nueva de dependencias de producción para v1.3.
# Todas las 5 features se implementan con las dependencias ya presentes en:
# - packages/checks (cheerio, @auditor/crawler)
# - packages/psi (fetch nativo, sin SDK)
# - packages/report-model (TypeScript puro)
# - apps/web (react, next — ya instalados)
```

## Alternatives Considered

| Recomendado | Alternativa | Cuándo usar la alternativa |
|-------------|-------------|------------------------------|
| SVG nativo + React para el árbol de arquitectura | `d3-hierarchy` (3.1.2, ~8-10kB gzip) | Si el layout jerárquico crece en complejidad real (árboles no balanceados con muchas ramas de ancho variable) y calcular posiciones a mano se vuelve propenso a errores — `d3-hierarchy` sólo aporta el algoritmo de layout (`d3.tree()`), no un componente de render, así que seguiría integrándose con SVG propio, no reemplazándolo. |
| SVG nativo + React | `@xyflow/react` (12.11.2) | Sólo si el producto evoluciona (fuera de v1.3) hacia un grafo interactivo con pan/zoom/arrastre de nodos y edges persistidas — no es el caso de "árbol jerárquico por profundidad" que es la decisión bloqueada de este milestone. |
| Heurística propia de clasificación de plantilla (regex sobre segmentos de URL) | Librería de clasificación ML/NLP de tipo de página | No se justifica: la taxonomía es pequeña y conocida (home/categoría/producto/artículo) y determinable con reglas de path, no requiere aprendizaje automático. |
| Leer `audits[id].details` directamente del JSON de PSI ya obtenido | Librería cliente de Lighthouse (`lighthouse` npm package) para reprocesar | No aplica: el proyecto ya usa la API REST de PSI (no corre Lighthouse localmente para este dato), y el JSON ya contiene todo lo necesario — instalar el paquete `lighthouse` completo sólo para tipos sería mucho peso por cero beneficio funcional. |

## What NOT to Use

| Evitar | Por qué | Usar en su lugar |
|--------|---------|-------------------|
| `@xyflow/react` para el árbol de arquitectura | ~55-70kB gzip, pensado para editores de flujo interactivos con pan/zoom/drag; over-engineered para una jerarquía estática de 4 niveles; riesgo de fricción con el CSP estricto ya confirmado en el proyecto | SVG nativo siguiendo el patrón de `EntityGraphSvg.tsx` |
| `react-arborist` / `react-d3-tree` para el árbol de arquitectura | Diseñadas para árboles editables/virtualizados de miles de nodos (árboles de archivos, organigramas); traen su propio sistema de theming que no encaja con el design system tokens-only de v1.1 | SVG nativo + estado React simple para expand/collapse |
| `@visx/hierarchy` + `@visx/group` | Capa de componentes sobre los mismos algoritmos de d3-hierarchy; no aporta nada sobre SVG propio a esta escala (4 niveles, ≤500 nodos) y añade una dependencia más al bundle del reporte | SVG nativo, o `d3-hierarchy` puro si el layout se complica |
| Instalar el paquete `lighthouse` npm sólo para tipos de `audit-details` | Paquete pesado (incluye Chrome DevTools Protocol driver, Puppeteer-adjacent deps) para obtener únicamente un shape de tipos que se puede declarar a mano en `packages/psi/src/parser.ts` (igual que ya se hizo con `RawPsiResponse`) | Extender `RawPsiResponse`/`RawAudit` manualmente en `packages/psi`, como ya está hecho para las 4 métricas actuales |
| Reintroducir Lighthouse/Playwright local para diagnósticos | Ya está resuelto: PSI ya devuelve `audits` completo por request pagado; correr Lighthouse local para esto duplicaría costo de cómputo del worker sin necesidad | Leer `lighthouseResult.audits[id]` de la respuesta PSI ya obtenida |
| Servicio de clasificación de plantillas de terceros o modelo LLM por página | Añade latencia/costo/dependencia externa a una tarea que es determinística con reglas de segmentos de URL para el 90%+ de sitios (WordPress, WooCommerce, Shopify siguen convenciones de path predecibles: `/categoria/`, `/producto/`, `/blog/`, `/`) | Heurística de regex sobre `path.split("/")` + profundidad, con fallback a "otra" si no matchea ningún patrón conocido |

## Stack Patterns by Variant

**Si el clasificador de plantillas de la feature #4 detecta con confianza baja (URL no matchea ningún patrón conocido):**
- Usar categoría fallback `"otra"` en vez de forzar una clasificación incorrecta.
- Porque una agrupación por plantilla equivocada es peor que "sin clasificar" — el usuario del reporte pierde confianza si ve un artículo agrupado como "producto".

**Si el árbol de arquitectura (feature #5) recibe un sitio con profundidad >3 en una proporción muy alta de páginas:**
- Usar un solo bucket "3+" (ya es la decisión tomada: 0/1/2/3+), sin desglosar más niveles.
- Porque el objetivo es visibilidad de arquitectura general (¿está el sitio muy plano o muy profundo?), no un mapa exhaustivo nivel por nivel — más niveles añaden ruido visual sin más insight accionable para un lead magnet.

## Version Compatibility

No aplica — no se introducen paquetes nuevos con requisitos de compatibilidad de versión. Todo el trabajo de v1.3 corre sobre las versiones ya fijadas en v1.0-v1.2 (Next.js ^15.1.0, React ^19.0.0, TypeScript ^5.7.2, cheerio ya en `@auditor/crawler`/`@auditor/checks`).

## Sources

- `apps/web/app/components/EntityGraphSvg.tsx` (código del propio repo) — patrón de referencia SVG-sin-dependencias ya validado en producción, HIGH confidence (evidencia directa del codebase)
- `packages/checks/src/checks/tech/orphanPages.ts` (código del propio repo) — patrón de parseo de enlaces internos on-demand vía Cheerio, HIGH confidence
- `packages/psi/src/parser.ts` (código del propio repo) — shape actual de `RawPsiResponse`, punto de extensión para diagnósticos, HIGH confidence
- npm registry (`npm view <pkg> version`, consultado 2026-07-08): `@xyflow/react@12.11.2`, `d3-hierarchy@3.1.2`, `@visx/hierarchy@4.0.0`, `@visx/group@4.0.0`, `react-arborist@3.13.2`, `react-d3-tree@3.6.6` — HIGH confidence (consulta directa al registro)
- [GoogleChrome/lighthouse — types/lhr/audit-details.d.ts](https://github.com/GoogleChrome/lighthouse/blob/main/types/lhr/audit-details.d.ts) — shape oficial de `Opportunity`/`overallSavingsMs`/`overallSavingsBytes`, HIGH confidence (tipos oficiales del proyecto)
- [GoogleChrome/lighthouse — types/lhr/audit-result.d.ts](https://github.com/GoogleChrome/lighthouse/blob/main/types/lhr/audit-result.d.ts) — shape oficial de `AuditResult` (`numericValue`, `numericUnit`, `displayValue`, `details`), HIGH confidence
- WebSearch sobre deprecación de `overallSavingsMs` en favor de `metricSavings` — MEDIUM confidence (múltiples discusiones de GitHub issues/PRs de Lighthouse convergen, pero requiere verificación puntual contra la versión exacta de Lighthouse que corre PSI v5 en el momento de implementar)
- `.planning/PROJECT.md` (Current Milestone v1.3 + Key Decisions) — contexto de restricciones ya decididas (CSP estricto, tokens-only, sin migración de storage), HIGH confidence

---
*Stack research for: Auditor Web v1.3 — 5 features nuevas sobre stack existente*
*Researched: 2026-07-08*
