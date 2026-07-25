# Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback - Research

**Researched:** 2026-07-24
**Domain:** Resolución de instrucciones de fix personalizadas por CMS en tiempo de construcción del report-model (monorepo pnpm/Turborepo, TypeScript ESM, vitest)
**Confidence:** HIGH (integración y convenciones derivadas de lectura directa del código; copy de plataformas fundamentado en documentación oficial con puntos de incertidumbre marcados explícitamente)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Arquitectura del motor de resolución**
- Catálogo por adaptador como `Record<checkId, string>` plano — una instrucción "dónde/cómo editar" por checkId. Los sub-casos de un mismo checkId (ej. title muy corto vs muy largo) comparten instrucción; el WHY/QUÉ específico ya lo muestran `title`/`measuredValue`/`criterion` en la tabla de issues existente, sin cambios.
- Umbral de confianza que activa un adaptador de plataforma: `alto` **y** `medio`. Solo `bajo`/`no-detectado` fuerzan el fallback genérico.
- WordPress con builder `no-detectado` (CMS confirmado, sin builder claro): copy con ramas ("Si usás el editor nativo de WordPress... Si usás Elementor/Divi/WPBakery...") — cubre casos sin afirmar certeza de detección.
- Wix y Squarespace: mismo módulo técnico (`wix-squarespace/`) pero copy interno distinto por label detectado (Wix vs Squarespace tienen UI de edición bastante diferente) — no un texto único genérico para ambos.

**Cobertura de checks y granularidad**
- 10 checkIds objetivo: `ONPAGE-01` (title), `ONPAGE-02` (meta description), `ONPAGE-03` (H1), `ONPAGE-04` (alt text), `ONPAGE-05` (Open Graph), `TECH-01` (robots.txt), `TECH-02` (sitemap), `TECH-04` (canonical), `SD-01` (JSON-LD presencia), `SD-02` (JSON-LD validez). Title y meta description quedan como entradas separadas (no combinadas).
- Granularidad por builder de WordPress solo en **alt text** y **JSON-LD**. El resto de checks WordPress queda a nivel plataforma.
- Los checks fuera de esta lista (hreflang, mixed content, enlaces rotos, profundidad de clics, etc.) **nunca** pasan por `resolveCmsRecommendation` — mantienen su `recommendation` genérica intacta (CMSFIX-04).
- Copy nuevo para title, meta description, H1, Open Graph, robots.txt, sitemap se investiga contra documentación oficial de cada plataforma. Cualquier ambigüedad de precisión queda marcada explícita para revisión.

**Tono, idioma y formato del copy**
- Español neutro **sin voceo** en todo el copy nuevo (COPY-01..03, v1.1). El ejemplo de voceo en FEATURES.md ("Agregá...") es solo referencia de contenido/estructura, se corrige a neutro.
- Longitud/formato: 1-3 oraciones, mencionando la ruta de menú concreta en el admin de la plataforma.
- Para WordPress, mencionar Yoast SEO **y** Rank Math como opciones, más una nota de fallback si no tiene ninguno instalado.
- Se pueden mencionar features de pago (ej. "Elementor Pro") con la aclaración "(versión Pro)".

**Testing y garantías de calidad**
- `packages/cms-adapters`: tests de resolución (fallback correcto por combinación de confianza/plataforma/checkId) + test de cobertura completa (10 checkIds × 5 plataformas = 50 entradas, ninguna faltante/vacía). No se testea tono ni prosa.
- Verificación end-to-end contra un audit real (patrón `verify-stack.mts` de Phase 26).
- El fallback genérico debe ser **100% idéntico** al `recommendation` genérico actual — cero regresión (CMSFIX-04).
- Naming: paquete `@auditor/cms-adapters`, función `resolveCmsRecommendation(stack, checkId, genericRecommendation)`, integrado en `packages/report-model/src/build.ts`.

### Claude's Discretion
Ninguna decisión quedó en discreción total de Claude — las 4 áreas se resolvieron con "Aceptar todo" sobre las propuestas recomendadas.

### Deferred Ideas (OUT OF SCOPE)
- Adaptador Squarespace separado de Wix (CMSFIX-06/07) — no se toca en esta fase.
- Detección de plugin SEO de WordPress instalado (Yoast vs Rank Math) — fuera de alcance v1.5; el copy menciona ambos.
- Fix personalizado en checks CMS-agnósticos (hreflang, mixed content, enlaces rotos, profundidad de clics) — fuera de alcance (CMSFIX-04).
- Más builders de WordPress (Beaver Builder, Oxygen, Bricks) — fuera de alcance v1.5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción | Soporte del research |
|----|-------------|----------------------|
| CMSFIX-01 | Patrón adaptador por plataforma con interfaz común para resolver instrucciones de fix por check | Sección "Arquitectura del motor" define `registry` keyed por label de CMS + `CmsAdapter` con lookup por checkId; estructura de paquete espejo de `packages/fingerprint` |
| CMSFIX-02 | Fallback genérico obligatorio cuando no hay CMS con confianza suficiente o no hay adaptador | `resolveCmsRecommendation` retorna `genericRecommendation` sin tocar cuando `confidence ∈ {bajo, no-detectado}`, cuando no hay adaptador para el label, o cuando el checkId no está en el catálogo |
| CMSFIX-03 | Los 10 checks muestran instrucciones personalizadas según CMS (WordPress considerando el builder) | Catálogo completo 10×5 en "Catálogo de copy por plataforma", con variantes por builder para ONPAGE-04/SD-01/SD-02 |
| CMSFIX-04 | Checks no cubiertos mantienen recomendación genérica sin cambios | Catálogo scopeado a los 10 checkIds; cualquier otro checkId (TECH-10 hreflang, TECH-11 mixed content, TECH-14 depth, etc.) cae por diseño al fallback. Guard adicional por severidad `ok` para no sobrescribir "Sin acción necesaria." |
| CMSFIX-05 | Resolución en report-model, no persistida, disponible en exports | Integración en `toReportIssue()` de `build.ts`; `ReportModel` es única fuente para UI + exports (patrón v1.2) |
</phase_requirements>

## Summary

Esta fase agrega un paquete puro nuevo, `@auditor/cms-adapters`, cuya única responsabilidad es transformar la recomendación genérica de un issue en una instrucción específica de la plataforma detectada, resolviéndolo en tiempo de lectura dentro de `buildReportModel()`. No hay migración de base de datos (Phase 26 ya persiste `Audit.stack`), no hay cambios en `packages/checks`, no hay servicios externos ni parsing de input en runtime. El trabajo real de la fase es **autoría de copy** (50 instrucciones base + variantes por builder de WordPress) y **cableado de una función pura** en un único punto de integración ya identificado.

El motor se apoya en tres piezas que ya existen y están estables: el `DetectedStack` de `@auditor/fingerprint` (con `cms.value`, `cms.confidence` y `builder.value`), el `checkId` string persistido en cada `Issue`, y el `rawStack` ya parseado en `build.ts` (líneas 182-183). El acoplamiento entre `checks` y las plataformas es únicamente el string `checkId` — nunca un import. `cms-adapters` importa **solo tipos** de `fingerprint`.

Dos hallazgos de código son determinantes para el plan y se detallan abajo: (1) **no existe un tipo `CmsPlatform` exportado** por `fingerprint` — `cms.value` es `string | null`, así que `cms-adapters` debe declarar su propia unión local de labels; y (2) hay un **guard por severidad obligatorio**: los issues de severidad `ok` llevan `recommendation: "Sin acción necesaria."` y NO deben pasar por la resolución, o mostrarían un fix sobre un check que está correcto (regresión de credibilidad).

**Primary recommendation:** Crear `@auditor/cms-adapters` como paquete puro (deps: solo `@auditor/fingerprint` type-only), con `registry: Record<CmsLabel, CmsAdapter>`, `resolveCmsRecommendation(stack, checkId, generic): string`, e integrarlo en `toReportIssue()` pasando `rawStack` (el `DetectedStack`, no el `ReportStack`) y guardando por severidad `ok`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catálogo de copy por plataforma/check | `packages/cms-adapters` (nuevo) | — | Datos calibrables aislados del motor; espejo de `packages/fingerprint/src/signatures` |
| Selección adaptador + gating por confianza | `packages/cms-adapters` | — | Lógica pura, sin I/O; keyed por `cms.value` string |
| Resolución en tiempo de reporte (thread-through) | `packages/report-model` (`build.ts`) | `packages/cms-adapters` | Punto único de verdad para UI + exports (patrón v1.2/Pattern 3) |
| Detección CMS/builder/confianza | `packages/fingerprint` (existente) | — | Ya provee `DetectedStack`; type-only consumer |
| Renderizado de la recomendación | `apps/web` `IssuesTable` (existente) | `packages/export` (existente) | Ya leen `ReportIssue.recommendation`, cero plumbing extra |
| Emisión del issue genérico + `checkId` | `packages/checks` (SIN cambios) | — | Boundary duro: nunca conoce plataformas |

## Standard Stack

### Core

No se introducen librerías externas nuevas. La fase reutiliza el stack interno del monorepo.

| Paquete | Versión | Propósito | Por qué |
|---------|---------|-----------|---------|
| `@auditor/fingerprint` | `workspace:*` (0.1.0) | Provee los tipos `DetectedStack` / `AxisResult` (type-only) | Ya expone el stack detectado con confianza por eje; import type-only mantiene `cms-adapters` puro |
| `vitest` | `^4.1.9` | Test runner | Mismo runner que `fingerprint`/`report-model`; `vitest run` vía script `test` |
| `typescript` | `^5.7.2` | Typecheck | `tsc --noEmit` vía script `typecheck`, extiende `tsconfig.base.json` |
| `@types/node` | `^22.10.0` | Tipos Node | Consistente con `fingerprint` |

### Supporting

Ninguno. A diferencia de `fingerprint`, `cms-adapters` **no** depende de `cheerio` (no parsea HTML: opera sobre strings estáticos y el `DetectedStack` ya resuelto).

### Alternatives Considered

| En vez de | Se podría usar | Tradeoff |
|-----------|----------------|----------|
| `Record<checkId, string>` plano por adaptador | Clase con método `getFixInstructions()` | El `Record` plano es más simple, testeable por cobertura y coincide con la decisión lockeada; una clase agrega ceremonia sin beneficio |
| `resolveCmsRecommendation` devuelve `string` | Devuelve `{ text, source: "cms" \| "generic" }` (como el ejemplo de ARCHITECTURE.md Pattern 3) | Devolver `string` mantiene la inyección de una sola línea y cero cambios en `ReportIssue`; el objeto `{source}` habilitaría un badge en UI pero CONTEXT no lo pide (ver Open Questions) |

**Installation:** No hay `npm install`. El paquete se crea en `packages/cms-adapters/` y `report-model` agrega `"@auditor/cms-adapters": "workspace:*"` a sus `dependencies`. `pnpm-workspace.yaml` ya incluye `packages/*`.

## Package Legitimacy Audit

**No se instalan paquetes externos en esta fase.** Todas las dependencias son workspace-internas (`@auditor/fingerprint`) o ya presentes en el monorepo (`vitest`, `typescript`, `@types/node`). No aplica auditoría de registro npm.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        (persistido en Phase 26, sin cambios)
  Audit.stack (Json)  ─────────────►  rawStack: DetectedStack | null
        │                                     │  (build.ts L182-183, ya en scope)
        │                                     ▼
  Issue rows ──► IssueRow.checkId ──►  toReportIssue(issue, rawStack)
                 IssueRow.severity          │
                 IssueRow.recommendation    │  guard: severity === "ok"
                                            │        ? recommendation (verbatim)
                                            ▼        : resolveCmsRecommendation(...)
                              ┌───────────────────────────────────────────┐
                              │ @auditor/cms-adapters                      │
                              │  resolveCmsRecommendation(stack,checkId,   │
                              │                            generic)        │
                              │   1. !stack                → generic       │
                              │   2. cms.confidence ∉ {alto,medio}→generic │
                              │   3. registry[cms.value] ausente → generic │
                              │   4. catálogo[checkId] ausente   → generic │
                              │   5. (WP + checkId∈{alt,SD}) → por builder │
                              │   6. (Wix/Squarespace) → por label         │
                              │   → instrucción específica                 │
                              └───────────────────────────────────────────┘
                                            │
                                            ▼
                              ReportIssue.recommendation
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                        ▼
              apps/web IssuesTable                    packages/export (PDF/MD/PPTX)
              (sin cambios)                            (sin cambios — gratis vía ReportModel)
```

### Recommended Project Structure

```
packages/cms-adapters/                # NUEVO — resolución de recomendaciones, cero coupling con checks
├── src/
│   ├── types.ts                      # CmsLabel (unión local), CmsAdapter, SUPPORTED_CHECK_IDS
│   ├── wordpress.ts                  # catálogo WP (plano) + variantes por builder (alt, JSON-LD)
│   ├── shopify.ts                    # catálogo Shopify (plano)
│   ├── webflow.ts                    # catálogo Webflow (plano)
│   ├── wixSquarespace.ts             # catálogo con dos labels internos (Wix / Squarespace)
│   ├── registry.ts                   # Record<CmsLabel, CmsAdapter>
│   ├── resolveCmsRecommendation.ts   # función pura de resolución
│   ├── resolveCmsRecommendation.test.ts
│   ├── coverage.test.ts              # 10 checkIds × 5 labels = 50, ninguna vacía
│   └── index.ts                      # barrel: export resolveCmsRecommendation + tipos
├── package.json                      # name @auditor/cms-adapters, deps: @auditor/fingerprint (type-only)
└── tsconfig.json                     # extends ../../tsconfig.base.json

packages/report-model/
└── src/build.ts                      # MODIFICADO — toReportIssue(issue, rawStack) + guard severidad

apps/worker/scripts/
└── verify-cms-fix.mts                # NUEVO — e2e contra audit real (patrón verify-stack.mts)
```

### Pattern 1: Convenciones exactas del paquete (espejo de `packages/fingerprint`)

Verificado leyendo `packages/fingerprint/package.json`, `tsconfig.json`, `src/index.ts` y `registry.ts`.

**`package.json`** (copiar shape de fingerprint, quitar `cheerio`):
```json
{
  "name": "@auditor/cms-adapters",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@auditor/fingerprint": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2",
    "vitest": "^4.1.9"
  }
}
```
[VERIFIED: packages/fingerprint/package.json]

**`tsconfig.json`** (idéntico a fingerprint):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "lib": ["ES2022"], "types": ["node"] },
  "include": ["src"]
}
```
[VERIFIED: packages/fingerprint/tsconfig.json]

**Barrel `src/index.ts`** (export only lo que consume `report-model`):
```typescript
export { resolveCmsRecommendation } from "./resolveCmsRecommendation";
export { SUPPORTED_CHECK_IDS } from "./types";
export type { CmsLabel } from "./types";
```

**Import type-only del boundary** (regla dura del milestone):
```typescript
// packages/cms-adapters/src/resolveCmsRecommendation.ts
import type { DetectedStack } from "@auditor/fingerprint";
// NUNCA un import de runtime de fingerprint; NUNCA import de @auditor/checks en ningún sentido.
```
[VERIFIED: packages/fingerprint/src/index.ts exporta `DetectedStack` como type; report-model ya usa `import type { DetectedStack } from "@auditor/fingerprint"` en build.ts L17]

**Colocación y naming de tests:** archivo hermano `*.test.ts` junto al código (`resolveCmsRecommendation.test.ts`, `coverage.test.ts`), `describe`/`it`/`expect` de vitest en español neutro — igual que `packages/fingerprint/src/signatures/registry.test.ts`. [VERIFIED: registry.test.ts]

### Pattern 2: Registry keyed por label de CMS, con lookup por checkId

`registry` mapea el **string** `cms.value` a un adaptador. Espejo conceptual de `packages/fingerprint/src/signatures/registry.ts` (que mapea `Axis` a arrays de `Signature`).

```typescript
// types.ts — NO existe CmsPlatform en fingerprint; se declara la unión local aquí.
export type CmsLabel = "WordPress" | "Shopify" | "Webflow" | "Wix" | "Squarespace";
export const SUPPORTED_CHECK_IDS = [
  "ONPAGE-01","ONPAGE-02","ONPAGE-03","ONPAGE-04","ONPAGE-05",
  "TECH-01","TECH-02","TECH-04","SD-01","SD-02",
] as const;

// registry.ts
export const registry: Record<CmsLabel, CmsAdapter> = {
  WordPress: wordpressAdapter,
  Shopify: shopifyAdapter,
  Webflow: webflowAdapter,
  Wix: wixSquarespaceAdapter,          // mismo módulo,
  Squarespace: wixSquarespaceAdapter,  // distinto label interno
};
```

**Por qué unión local, no `CmsPlatform`:** `packages/fingerprint/src/types.ts` define `AxisResult.value: string | null` — **no hay** tipo `CmsPlatform` exportado (grep confirmado). Es el mismo patrón que `packages/checks` redeclarando `RenderVerdictValue` localmente en vez de importar el paquete hermano. `cms-adapters` matchea `stack.cms.value` (string) contra su unión local. [VERIFIED: grep CmsPlatform en packages/fingerprint/src → NOT FOUND; cms.value es string]

### Pattern 3: Resolución en report-time (thread-through), Pattern 3 de ARCHITECTURE.md

Integración exacta en `packages/report-model/src/build.ts`:

- **Punto de inyección:** `toReportIssue()` (L109-124). Hoy `recommendation: issue.recommendation` (L119). Debe pasar a resolverse.
- **Threading:** `toReportIssue` recibe hoy solo `issue`. Se le agrega `rawStack: DetectedStack | null` (ya en scope en L182). Hay **3 call sites** dentro de `buildReportModel`: `priorityCandidatesRaw.map(toReportIssue)` (~L218), el loop `issuesByCategory` (~L227) y el loop `issuesByTemplate` (~L234). Los tres deben pasar `rawStack`.
- **CRÍTICO — usar `rawStack`, NO `stack`:** `resolveCmsRecommendation` necesita `stack.cms.value` (ej. `"WordPress"`), `stack.cms.confidence` y `stack.builder.value`. El `stack` serializado (`ReportStack`, vía `toReportStack`) **fusiona** el builder en el label (`"WordPress (Elementor)"`, L148-150) y descarta el builder como eje separado — inservible para el matching. Pasar el `rawStack: DetectedStack | null` crudo (L182). [VERIFIED: build.ts L143-158, L182-183]

```typescript
function toReportIssue(issue: IssueRow, stack: DetectedStack | null): ReportIssue {
  const recommendation =
    issue.severity === "ok"
      ? issue.recommendation // guard: nunca reescribir "Sin acción necesaria."
      : resolveCmsRecommendation(stack, issue.checkId, issue.recommendation);
  return { ...campos existentes..., recommendation };
}
```

### Anti-Patterns to Avoid

- **Pasar `stack` (ReportStack) en vez de `rawStack` (DetectedStack):** rompe el matching de builder porque el label viene fusionado (`"WordPress (Elementor)"`).
- **Resolver issues de severidad `ok`:** sobrescribiría `"Sin acción necesaria."` con un fix, mostrando instrucciones sobre checks que están correctos. Los issues `ok` se persisten y aparecen en `issuesByCategory`/`issuesByTemplate` (aunque no en el top de prioridad).
- **Importar runtime de `fingerprint` o cualquier cosa de `checks`:** viola el boundary del milestone. Solo `import type`.
- **Mejorar el copy genérico "de paso":** CMSFIX-04 exige que el fallback sea 100% idéntico. El fallback es el propio argumento `genericRecommendation` devuelto sin tocar — no una copia almacenada.

## Catálogo de copy por plataforma (entregable central)

Reglas aplicadas a TODO el copy: español neutro **sin voceo** (verbos `Agrega`/`Completa`/`Deja`/`Edita`/`Abre`/`Publica`/`Reemplaza`/`Ajusta`, nunca `Agregá`/`Fijate`), 1-3 oraciones, ruta de admin concreta. Una instrucción por checkId (los sub-casos comparten). El texto abajo es **borrador listo para el plan**; los puntos marcados `[REVISAR]` requieren confirmación humana de la ruta exacta.

**Convención de verbos verificada en código** (para calcar el estilo): `title.ts` usa `"Agrega una etiqueta <title>..."`, `"Reemplaza el title genérico..."`, `"Amplía el title..."`, `"Acorta el title..."`; `canonical.ts` usa `"Agrega <link rel=\"canonical\"...>"`, `"Deja una sola etiqueta canonical..."`, `"Completa el atributo href..."`. Modo imperativo neutro (tú), tercera persona del imperativo. [VERIFIED: title.ts L38-80, canonical.ts L24-59]

### ONPAGE-01 — Title

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress, edita la entrada o página y completa el campo «Título SEO» del panel de tu plugin SEO (en Yoast SEO: bloque «Yoast SEO» debajo del editor → «Editar fragmento»; en Rank Math: metabox de Rank Math → pestaña «General»). Si no tienes ninguno instalado, el título sale del `<title>` del tema: instala Yoast SEO o Rank Math, o edítalo en el código del tema. |
| Shopify | En Shopify, abre el recurso (Productos, Páginas o Colecciones); para la home ve a Tienda online → Preferencias. Busca la sección «Vista previa del motor de búsqueda», haz clic en «Editar» y completa el campo de título. Guarda. |
| Webflow | En Webflow, abre el panel Pages → configuración de la página (ícono de engranaje) → «SEO settings» → campo «Title Tag». En páginas de colección del CMS, edítalo en la configuración de la plantilla de la colección (puedes vincularlo a un campo dinámico). |
| Wix | En el editor de Wix, ve a Páginas y menú → ícono de más acciones junto a la página → «SEO básico», y completa el campo de título de la página. |
| Squarespace | En Squarespace, pasa el cursor sobre la página en el panel Pages, abre su configuración → pestaña «SEO» → campo «SEO Title». Para el formato global y la home, ve a Ajustes → Marketing → «SEO Appearance». |

### ONPAGE-02 — Meta description

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress, edita la entrada o página y completa el campo «Meta descripción» del panel de tu plugin SEO (Yoast SEO: «Editar fragmento» debajo del editor; Rank Math: metabox → pestaña «General»). Sin plugin SEO instalado, instala Yoast SEO o Rank Math, o agrega la etiqueta en el código del tema. |
| Shopify | En Shopify, abre el recurso o, para la home, ve a Tienda online → Preferencias. En «Vista previa del motor de búsqueda» haz clic en «Editar» y completa el campo de descripción. Guarda. |
| Webflow | En Webflow, abre configuración de la página → «SEO settings» → campo «Meta Description». En colecciones del CMS, vincúlalo a un campo de la colección. |
| Wix | En el editor de Wix, ve a Páginas y menú → más acciones → «SEO básico», y completa el campo de descripción (meta description). |
| Squarespace | En Squarespace, abre la configuración de la página → pestaña «SEO» → campo «SEO Description». |

### ONPAGE-03 — H1

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress el H1 suele ser el título de la entrada/página. Deja un único H1: en el editor de bloques, mantén el título principal como H1 y cambia los demás encabezados a H2/H3 desde el selector de nivel del bloque de encabezado. En Elementor, Divi o WPBakery, ajusta la etiqueta HTML (H1/H2) del widget de título en las opciones del elemento. |
| Shopify | En Shopify el H1 lo define la plantilla del tema (normalmente el título del producto o página). Ve a Tienda online → Temas → Personalizar y revisa la sección de encabezado; si necesitas cambiar la etiqueta, edítala en «Editar código» del tema. `[REVISAR: la ubicación exacta depende del tema]` |
| Webflow | En Webflow Designer, selecciona el elemento de encabezado y, en Settings, fija su etiqueta como H1 (solo uno por página); convierte los demás en H2/H3. |
| Wix | En el editor de Wix, selecciona el texto del título, abre el panel de texto y en «Etiqueta SEO» asígnale «Heading 1 (H1)»; usa un único H1 por página. `[REVISAR: nombre exacto del control de etiqueta SEO/HTML tag en el panel de texto de Wix]` |
| Squarespace | En Squarespace, edita el bloque de texto del encabezado principal y asígnale «Heading 1» en la barra de formato; deja un único H1 y baja los demás a H2/H3. `[REVISAR: en 7.1 el título de página no siempre se renderiza como H1]` |

### ONPAGE-04 — Alt text (con variantes por builder en WordPress)

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress · builder `no-detectado` (rama) | En WordPress, si usas el editor nativo (Gutenberg): selecciona la imagen y completa el campo «Texto alternativo» en el panel del bloque, o desde Medios → la imagen → «Texto alternativo». Si usas Elementor: selecciona el widget de imagen → pestaña «Contenido» → campo «Alt». Si usas WPBakery o Divi: el campo alt está dentro de las opciones del módulo de imagen del builder. |
| WordPress · Elementor | En WordPress con Elementor, selecciona el widget de imagen → pestaña «Contenido» → campo «Alt» (o completa el «Texto alternativo» en la biblioteca de Medios, que Elementor reutiliza). |
| WordPress · Divi | En WordPress con Divi, abre las opciones del módulo de imagen → pestaña «Contenido» → campo «Alt Text», o completa el «Texto alternativo» de la imagen en la biblioteca de Medios. |
| WordPress · WPBakery | En WordPress con WPBakery, edita el elemento «Single Image» del builder y completa su campo de texto alternativo, o el «Texto alternativo» de la imagen en la biblioteca de Medios. |
| WordPress · Gutenberg | En WordPress (editor nativo), selecciona la imagen en el editor y completa el campo «Texto alternativo» en el panel del bloque, o desde Medios → la imagen → «Texto alternativo». |
| Shopify | En Shopify, ve a Productos (o Contenido → Archivos), selecciona la imagen y completa el campo «Texto alternativo»; en imágenes del tema, edítalo desde Personalizar. Guarda. |
| Webflow | En Webflow Designer, selecciona la imagen → panel Settings → campo «Alt Text». En imágenes del CMS, vincula el alt a un campo de la colección para completarlo en todos los ítems. |
| Wix | En Wix, abre el Administrador de medios (Media Manager), selecciona la imagen → Settings → campo «Texto alternativo». |
| Squarespace | En Squarespace, edita el bloque de imagen y completa el campo de texto alternativo (Alt Text) en las opciones de la imagen. |

### ONPAGE-05 — Open Graph

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress, con Yoast SEO abre la pestaña «Social» del panel Yoast (o Yoast SEO → Ajustes → «Compartir en redes» para los valores por defecto); con Rank Math usa la pestaña «Social» del metabox. Ahí defines título, descripción e imagen de Open Graph. Sin plugin SEO, instala Yoast SEO o Rank Math. |
| Shopify | En Shopify, la mayoría de los temas generan las etiquetas Open Graph a partir del título, la descripción y la imagen destacada del recurso: completa esos campos en el producto o página. Para la imagen social por defecto, revisa la configuración del tema en Tienda online → Temas → Personalizar. |
| Webflow | En Webflow, abre configuración de la página → «Open Graph Settings» y completa título, descripción e imagen; puedes marcar las casillas para reutilizar el «Title Tag» y la «Meta Description». |
| Wix | En el editor de Wix, en el panel SEO de la página abre la pestaña «Compartir en redes» (Social Share) y define la imagen y el texto que se muestran al compartir el enlace. |
| Squarespace | En Squarespace, abre la configuración de la página → pestaña «Social» para la imagen de compartición; los títulos y descripciones de Open Graph derivan del SEO Title/Description y de Ajustes → Marketing → «SEO Appearance». |

### TECH-01 — robots.txt

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress, edita robots.txt desde tu plugin SEO: Yoast SEO → Herramientas → «Editor de archivos»; Rank Math → Ajustes generales → «Editar robots.txt» (requiere modo avanzado). Sin plugin, crea un archivo robots.txt en la raíz del dominio o instala Yoast SEO o Rank Math. |
| Shopify | En Shopify, robots.txt se genera automáticamente. Para personalizarlo, ve a Tienda online → Temas → «Editar código», crea el archivo `robots.txt.liquid` en la carpeta Templates y ajusta las reglas con los objetos Liquid provistos (edición avanzada, no cubierta por el soporte de Shopify). |
| Webflow | En Webflow, ve a Ajustes del sitio → pestaña «SEO» → campo «robots.txt» y agrega ahí tus reglas (por ejemplo `User-agent` y `Disallow`). Publica el sitio para aplicarlo. `[REVISAR: confirmar nombre exacto de la pestaña/campo en el panel actual de Webflow]` |
| Wix | En Wix, ve al panel de tu sitio → Marketing y SEO → «Herramientas SEO» → editor de robots.txt, y edita el archivo. Los cambios aplican al dominio conectado. `[REVISAR: confirmar la ruta exacta del editor de robots.txt en el dashboard de Wix]` |
| Squarespace | En Squarespace, el archivo robots.txt lo gestiona la plataforma y no es editable por el usuario. Si necesitas evitar que una página se indexe, usa la opción «Hide this page from search engine results» en la pestaña SEO de esa página. `[REVISAR: confirmar el texto/ubicación actual de la opción de ocultar de buscadores]` |

### TECH-02 — Sitemap

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress, activa el sitemap XML de tu plugin SEO: en Yoast SEO → Ajustes → «Funciones del sitio» → «Mapas XML del sitio» (queda en `/sitemap_index.xml`); en Rank Math → «Sitemap Settings». Declara la URL del sitemap en robots.txt y envíala en Google Search Console. Sin plugin, instala Yoast SEO o Rank Math. |
| Shopify | En Shopify, el sitemap se genera automáticamente en `/sitemap.xml` y se actualiza al agregar o editar productos, colecciones, páginas o entradas; no requiere configuración. Envíalo en Google Search Console. |
| Webflow | En Webflow, ve a Ajustes del sitio → pestaña «SEO» y activa «Auto-generate sitemap» (o pega un sitemap personalizado). Publica el sitio; el sitemap queda en `/sitemap.xml`. `[REVISAR: confirmar nombre exacto del toggle en el panel actual de Webflow]` |
| Wix | En Wix, el sitemap se genera automáticamente en `tudominio.com/sitemap.xml` una vez publicado el sitio con un dominio conectado. Envíalo en Google Search Console desde las herramientas de SEO de Wix. |
| Squarespace | En Squarespace, el sitemap se genera automáticamente en `/sitemap.xml` y no es editable. Envíalo en Google Search Console. |

### TECH-04 — Canonical (base FEATURES.md, corregida a neutro)

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress | En WordPress, con Yoast SEO o Rank Math el campo canonical está en la pestaña «Avanzado» del panel SEO de cada entrada o página. Sin plugin SEO, requiere editar el tema/código: instala Yoast SEO o Rank Math para gestionarlo sin tocar código. |
| Shopify | En Shopify las canonical se generan automáticamente en la mayoría de los casos; los problemas suelen venir de paginación de colecciones o URLs duplicadas. Corregirlo puede requerir ajustar `theme.liquid` («Editar código») o una app de SEO. |
| Webflow | En Webflow no hay un campo nativo de canonical en todos los planes: agrega la etiqueta `<link rel="canonical" href="...">` en configuración de la página → «Custom Code» (head) o en un elemento «Embed». |
| Wix | En el editor de Wix, ve a Páginas y menú → más acciones → «SEO básico» → pestaña «Avanzado» → «Etiquetas adicionales», y edita la URL canónica de la página. |
| Squarespace | En Squarespace el control de canonical es limitado y depende de la plantilla; normalmente se inyecta la etiqueta canonical vía código en Ajustes de la página → «Advanced» → «Code Injection». |

### SD-01 — JSON-LD presencia (base FEATURES.md, corregida; variantes por builder en WordPress)

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress · builder `no-detectado` (rama) | En WordPress, Yoast SEO y Rank Math generan JSON-LD básico automáticamente (Organization, Article, breadcrumbs). Para tipos adicionales (FAQPage, Product, Review) usa el schema del plugin SEO, un plugin de schema dedicado, o bloques del builder. Si usas Elementor Pro, incluye widgets de schema (versión Pro). Sin plugin SEO, instala Yoast SEO o Rank Math. |
| WordPress · Elementor | En WordPress con Elementor, Yoast SEO o Rank Math ya generan el schema base; para tipos adicionales usa los widgets de schema de Elementor Pro (versión Pro) o el schema del plugin SEO. |
| WordPress · Divi / WPBakery | En WordPress con Divi o WPBakery, apóyate en el schema que generan Yoast SEO o Rank Math; para tipos adicionales usa el generador de schema del plugin SEO o un plugin de schema dedicado (estos builders no generan JSON-LD por sí solos). |
| WordPress · Gutenberg | En WordPress (editor nativo), Yoast SEO o Rank Math generan el JSON-LD base; para tipos adicionales usa el generador de schema del plugin SEO o un plugin de schema dedicado. |
| Shopify | En Shopify, los temas modernos (por ejemplo Dawn) ya incluyen schema de Product, Organization y BreadcrumbList. Para tipos adicionales o personalización, instala una app de datos estructurados de la App Store o edita el tema. |
| Webflow | En Webflow no hay soporte nativo de schema: genera el bloque JSON-LD y pégalo en configuración de la página → «Custom Code» (head) o en un elemento «Embed» dentro del contenido. |
| Wix | En Wix se genera algo de schema básico por tipo de página, pero es incompleto y no editable; para schema adicional o personalizado usa el editor de código personalizado de Wix en el `<head>` del sitio. |
| Squarespace | En Squarespace hay schema básico limitado; para schema personalizado, agrega el JSON-LD vía inyección de código de la página («Code Injection») o bloques de código en entradas de blog. |

### SD-02 — JSON-LD validez (sintaxis; variantes por builder en WordPress)

El issue solo aparece cuando ya existen bloques JSON-LD con JSON inválido; la instrucción apunta al lugar donde se editó ese bloque para corregir comas/comillas/llaves.

| Plataforma | Instrucción |
|-----------|-------------|
| WordPress · builder `no-detectado` (rama) | En WordPress, si el JSON-LD lo generan Yoast SEO o Rank Math no deberías tener errores de sintaxis; si agregaste bloques a mano (un bloque HTML personalizado, un plugin de schema, o un widget de Elementor Pro), corrige ahí las comas, comillas y llaves del bloque marcado. |
| WordPress · Elementor | En WordPress con Elementor, corrige el JSON-LD donde lo agregaste: el widget de schema de Elementor Pro (versión Pro), un bloque HTML personalizado, o el plugin de schema. Revisa comas, comillas y llaves. |
| WordPress · Divi / WPBakery | En WordPress con Divi o WPBakery, corrige el JSON-LD en el módulo de código donde lo insertaste o en tu plugin de schema, revisando comas, comillas y llaves. |
| WordPress · Gutenberg | En WordPress (editor nativo), corrige el JSON-LD en el bloque HTML personalizado o en el plugin de schema donde lo agregaste, revisando comas, comillas y llaves. |
| Shopify | En Shopify, corrige el JSON-LD en su origen: si viene del tema, en «Editar código»; si viene de una app de schema, en la configuración de la app. Revisa comas, comillas y llaves del bloque inválido. |
| Webflow | En Webflow, edita el bloque JSON-LD donde lo pegaste («Custom Code» de la página o elemento «Embed») y corrige la sintaxis (comas, comillas, llaves). |
| Wix | En Wix, corrige el JSON-LD en el editor de código personalizado donde lo agregaste, revisando comas, comillas y llaves. |
| Squarespace | En Squarespace, corrige el JSON-LD en la inyección de código de la página o el bloque de código donde lo agregaste, revisando comas, comillas y llaves. |

### Fallback genérico (verbatim — para el test y para CMSFIX-04)

El fallback **no es texto nuevo**: `resolveCmsRecommendation` devuelve el argumento `genericRecommendation` sin modificarlo. Estos son los strings genéricos actuales por checkId (capturados verbatim del código, para el test de cero-regresión). Cada checkId tiene varios sub-casos; el motor reemplaza todos por UNA instrucción de plataforma, y el fallback devuelve el sub-caso exacto que traía el issue.

| checkId | Strings genéricos actuales (verbatim) | Fuente |
|---------|----------------------------------------|--------|
| ONPAGE-01 | `Agrega una etiqueta <title> de entre 30 y 60 caracteres que describa el contenido principal de la página e incluya la palabra clave objetivo.` · `Reemplaza el title genérico por uno específico de esta página, con la palabra clave principal y entre 30 y 60 caracteres.` · `Amplía el title para aprovechar mejor el espacio en resultados de búsqueda, manteniéndolo entre 30 y 60 caracteres.` · `Acorta el title para que no se corte en los resultados de búsqueda, manteniéndolo entre 30 y 60 caracteres.` | title.ts L38-80 |
| ONPAGE-02 | `Agrega una meta description de entre 70 y 160 caracteres que resuma el contenido de la página e invite al clic desde resultados de búsqueda.` · `Amplía la meta description para describir mejor el contenido, manteniéndola entre 70 y 160 caracteres.` · `Acorta la meta description para que no se corte en los resultados de búsqueda, manteniéndola entre 70 y 160 caracteres.` | metaDescription.ts L25-47 |
| ONPAGE-03 | `Agrega un único H1 que describa el tema principal de la página.` · `Deja un único H1 con el tema principal y convierte los demás en H2/H3 según la jerarquía del contenido.` | h1.ts L26-44 |
| ONPAGE-04 | `Agrega texto alternativo descriptivo a las imágenes que faltan, para accesibilidad y para que los buscadores entiendan su contenido.` | altText.ts L47-48 |
| ONPAGE-05 | `Agrega las etiquetas Open Graph básicas (og:title, og:description, og:image, og:url) para controlar cómo se ve la página al compartirla en redes sociales.` · `Agrega las etiquetas Open Graph faltantes (${missing}) para un preview completo al compartir la página.` (dinámico) | openGraph.ts L31-49 |
| TECH-01 | `Publica un archivo robots.txt accesible en la raíz del dominio, aunque sea permisivo, para controlar explícitamente el acceso de los crawlers.` · `Agrega contenido a robots.txt: al menos un User-agent con reglas y, si corresponde, la directiva Sitemap.` · `Agrega al menos una directiva User-agent con sus reglas correspondientes en robots.txt.` | robotsTxt.ts L24-62 |
| TECH-02 | `Genera y publica un sitemap.xml (o sitemap index) con las URLs indexables del sitio, y declaralo en robots.txt.` | sitemap.ts L23 |
| TECH-04 | `Agrega <link rel="canonical" href="..."> apuntando a la URL preferida de esta página.` · `Deja una sola etiqueta canonical por página; múltiples declaraciones generan señales contradictorias.` · `Completa el atributo href de la etiqueta canonical con la URL absoluta de esta página.` · `Confirma si esta página debe ser canonical de sí misma o si realmente es un duplicado de la URL declarada; si es un error, corrige el href.` | canonical.ts L24-80 |
| SD-01 | `Agrega datos estructurados JSON-LD relevantes para esta página (por ejemplo Organization, WebPage o el tipo que corresponda al contenido) para mejorar la comprensión por buscadores y motores de IA.` | jsonldPresence.ts L24-25 |
| SD-02 | `Corrige la sintaxis JSON de los bloques marcados (comas, comillas, llaves) para que los buscadores y motores de IA puedan interpretarlos.` | jsonldValidity.ts L30-31 |

Nota: el sub-caso `"Sin acción necesaria."` (severidad `ok`) existe en los 10 checks pero **nunca** debe pasar por el motor (guard por severidad).

## Runtime State Inventory

No aplica un inventario de estado runtime clásico (no es rename/refactor/migración). Verificaciones puntuales relevantes:

| Categoría | Hallazgo | Acción |
|-----------|----------|--------|
| Datos almacenados | `resolveCmsRecommendation` NO persiste nada; resuelve en lectura. `Issue.recommendation` en DB queda intacto. `Audit.stack` ya persistido en Phase 26. | Ninguna. Cero migración en esta fase. |
| Config de servicio vivo | Ninguna. | Ninguna. |
| Estado registrado en SO | Ninguno. | Ninguno. |
| Secrets/env vars | Ninguno nuevo. El e2e (`verify-cms-fix.mts`) reutiliza `DATABASE_URL` como `verify-stack.mts`. | Ninguna. |
| Artefactos de build | `packages/report-model` agrega dependencia `@auditor/cms-adapters` → requiere `pnpm install` para enlazar el nuevo workspace package. | `pnpm install` tras crear el paquete. |

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Saber el CMS/builder y su confianza | Re-detección o parsing de HTML en `cms-adapters` | `DetectedStack` de `@auditor/fingerprint` (ya en `rawStack`) | Ya resuelto en Phase 25/26; `cms-adapters` solo lee `cms.value`/`cms.confidence`/`builder.value` |
| Fusionar builder en el label | Recalcular `"WordPress (Elementor)"` | Leer `stack.builder.value` crudo del `DetectedStack` | El label fusionado (`ReportStack`) es para UI; el motor necesita los ejes separados |
| Enrutar la resolución a UI y exports | Duplicar la lógica en `apps/web` y `packages/export` | Resolver una vez en `buildReportModel()` (Pattern 3) | `ReportModel` es única fuente; la personalización llega gratis a PDF/MD/PPTX |
| Distinguir "check OK" de "check con problema" | Comparar strings de recommendation | Guard por `issue.severity === "ok"` | La severidad ya está en `IssueRow`; robusto y explícito |

**Key insight:** El paquete es deliberadamente "tonto": tablas de strings + una función de selección de ~15 líneas. Toda la inteligencia (detección, confianza) vive aguas arriba en `fingerprint`. No hay nada que hand-rollear salvo el copy.

## Common Pitfalls

### Pitfall 1: Sobrescribir recomendaciones de checks OK
**Qué sale mal:** Un issue `ok` ("Title correcto", `recommendation: "Sin acción necesaria."`) se resuelve y muestra "En WordPress, edita el título SEO...".
**Por qué:** El catálogo es keyed solo por `checkId`; los issues `ok` se persisten y entran a `issuesByCategory`/`issuesByTemplate`.
**Cómo evitar:** Guard `issue.severity === "ok"` en `toReportIssue` antes de llamar al motor. **Señal temprana:** un test que arma un issue `ok` de ONPAGE-01 con stack WordPress y verifica que la recomendación sigue siendo `"Sin acción necesaria."`.

### Pitfall 2: Pasar `ReportStack` en vez de `DetectedStack`
**Qué sale mal:** El matching de builder falla y ninguna variante WP-Elementor/Divi se aplica; incluso el label CMS no matchea `"WordPress"` porque llega `"WordPress (Elementor)"`.
**Por qué:** `toReportStack` fusiona el builder y descarta el eje `builder` separado.
**Cómo evitar:** Pasar `rawStack` (`DetectedStack | null`, L182) a `toReportIssue`, no `stack` (`ReportStack`). **Señal:** test de resolución para WordPress+Elementor sobre ONPAGE-04.

### Pitfall 3: Asumir que existe un tipo `CmsPlatform`
**Qué sale mal:** `import type { CmsPlatform } from "@auditor/fingerprint"` no compila.
**Por qué:** `fingerprint` expone `AxisResult.value: string | null`; nunca exportó `CmsPlatform` (CONTEXT/ARCHITECTURE lo nombran informalmente).
**Cómo evitar:** Declarar la unión local `CmsLabel` en `cms-adapters/src/types.ts` y matchear el string. **Señal:** `typecheck` del paquete.

### Pitfall 4: Confianza `medio` tratada como fallback
**Qué sale mal:** Sitios con detección `medio` caen al genérico y se pierde la personalización.
**Por qué:** El umbral por defecto sugerido en research era más estricto; la decisión de esta fase es más permisiva.
**Cómo evitar:** Gate `confidence === "alto" || confidence === "medio"` activa el adaptador; solo `bajo`/`no-detectado` → fallback. **Señal:** test parametrizado por los 4 valores de `Confidence`.

### Pitfall 5: Variante de builder aplicada con builder no confiable
**Qué sale mal:** Se muestra copy específico de Elementor cuando el builder se detectó con baja certeza o es `no-detectado`.
**Cómo evitar:** Para WP + {ONPAGE-04, SD-01, SD-02}, usar la variante por builder solo si `builder.value ∈ {Elementor, Divi, WPBakery, Gutenberg}` y `builder.confidence ∈ {alto, medio}`; en cualquier otro caso usar la copy con ramas ("Si usas el editor nativo... Si usas Elementor/Divi/WPBakery..."). **Señal:** test WP con `builder = no-detectado` → devuelve la rama.

## Code Examples

### `resolveCmsRecommendation` (forma pura de referencia)

```typescript
// packages/cms-adapters/src/resolveCmsRecommendation.ts
import type { DetectedStack } from "@auditor/fingerprint";
import { registry } from "./registry";
import type { CmsLabel } from "./types";

const ACTIVATING = new Set(["alto", "medio"]);
const CMS_LABELS: readonly CmsLabel[] = ["WordPress","Shopify","Webflow","Wix","Squarespace"];

export function resolveCmsRecommendation(
  stack: DetectedStack | null,
  checkId: string,
  generic: string | null
): string | null {
  if (!stack) return generic;
  const { value, confidence } = stack.cms;
  if (!ACTIVATING.has(confidence)) return generic;
  if (value == null || !CMS_LABELS.includes(value as CmsLabel)) return generic;

  const adapter = registry[value as CmsLabel];
  const instruction = adapter.lookup(checkId, stack.builder);
  return instruction ?? generic; // catálogo ausente para ese checkId → fallback (CMSFIX-04)
}
```
[CITED: ARCHITECTURE.md Pattern 3; adaptado para devolver `string` y usar `builder`]

## State of the Art

No aplica cambio de estado del arte tecnológico. El único "moving target" es la UI de admin de cada plataforma (menús que cambian de nombre). Por eso el copy con rutas concretas se marca `[REVISAR]` donde la documentación oficial no fijó una ruta unívoca en esta sesión.

**Notas de deriva conocidas (a validar en el plan):**
- Wix: coexisten Wix Editor "clásico", Editor X y Wix Studio con rutas de SEO distintas; el copy asume el Editor clásico (mayoría del parque). El control de etiqueta H1 y el editor de robots.txt son los puntos más frágiles.
- Squarespace: 7.0 vs 7.1 difieren en dónde vive el H1 y en las pestañas de page settings.
- Yoast/Rank Math: nombres de menú estables en el research de esta sesión (Yoast «Editar fragmento», «Funciones del sitio», «Herramientas → Editor de archivos»; Rank Math «Sitemap Settings», «Ajustes generales → Editar robots.txt»).

## Assumptions Log

| # | Claim | Sección | Riesgo si es incorrecto |
|---|-------|---------|--------------------------|
| A1 | El control de etiqueta HTML/H1 en el editor de Wix se llama «Etiqueta SEO» en el panel de texto | ONPAGE-03 Wix | Instrucción imprecisa; usuario no encuentra el control. Marcado `[REVISAR]` |
| A2 | En Squarespace 7.1 el usuario asigna «Heading 1» desde la barra de formato del bloque de texto | ONPAGE-03 Squarespace | El título de página puede ya ser H1; instrucción parcialmente redundante. `[REVISAR]` |
| A3 | El editor de robots.txt de Wix vive en Marketing y SEO → Herramientas SEO | TECH-01 Wix | Ruta incorrecta. `[REVISAR]` |
| A4 | Webflow expone robots.txt y el toggle de sitemap en Ajustes del sitio → SEO | TECH-01/TECH-02 Webflow | Nombre de pestaña/campo pudo cambiar. `[REVISAR]` |
| A5 | Squarespace no permite editar robots.txt y ofrece "ocultar de buscadores" por página | TECH-01 Squarespace | Texto de la opción pudo cambiar. `[REVISAR]` |
| A6 | El H1 en Shopify se ajusta en el editor de tema / código, no en un panel dedicado | ONPAGE-03 Shopify | Depende del tema; instrucción necesariamente general. `[REVISAR]` |
| A7 | Elementor Pro (pago) es la vía de schema por widget en Elementor | SD-01 WordPress·Elementor | Mención de feature de pago; aceptado por CONTEXT con aclaración "(versión Pro)" |

Todos los ítems marcados `[REVISAR]` en el catálogo deben convertirse en tareas `checkpoint:human-verify` o notas de revisión en el PLAN, según la decisión de CONTEXT ("cualquier ambigüedad de precisión queda marcada explícita en el PLAN para revisión").

## Open Questions

1. **¿`resolveCmsRecommendation` devuelve `string` o `{ text, source }`?**
   - Lo que sabemos: CONTEXT pide inyección de una línea reemplazando `issue.recommendation`; ARCHITECTURE Pattern 3 mostró `{ text, source }` para un posible badge "cms/generic".
   - Lo que no está claro: si Juan quiere un badge visual que distinga recomendación personalizada de genérica.
   - Recomendación: devolver `string` (cero cambios en `ReportIssue`/UI/exports, cero regresión). Si más adelante se quiere el badge, es aditivo. **Default para el plan: `string`.**

2. **¿La variante por builder exige `builder.confidence ∈ {alto, medio}`?**
   - CONTEXT dice que WordPress con builder `no-detectado` usa la rama; por consistencia con el gating de CMS, se recomienda exigir también confianza de builder para usar la variante específica y, si no, caer a la rama.
   - Recomendación: gate de builder análogo al de CMS (documentado en Pitfall 5).

3. **¿Se agrega `verify-cms-fix.mts` en esta fase o se reutiliza `verify-stack.mts`?**
   - Recomendación: script nuevo `verify-cms-fix.mts` que carga un audit `done` real (ej. aprendoclub si es WordPress), corre `buildReportModel` y `console.dir` de las recomendaciones de los 10 checkIds, con el mismo manejo `P1001` offline que `verify-stack.mts`.

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|-------------|---------------|------------|---------|----------|
| pnpm | Build/test del workspace | ✓ | 10.0.0 | — |
| turbo | `turbo run test/typecheck` | ✓ | ^2.3.0 | — |
| vitest | Tests del paquete | ✓ | ^4.1.9 | — |
| TypeScript | Typecheck | ✓ | ^5.7.2 | — |
| Postgres/`DATABASE_URL` | Solo e2e `verify-cms-fix.mts` | Depende del entorno | — | Falla limpia `P1001` con hint manual (patrón `verify-stack.mts`); NO bloquea unit tests |

**Dependencias faltantes sin fallback:** ninguna para el desarrollo y los tests unitarios/cobertura.
**Dependencias faltantes con fallback:** el e2e requiere red a Postgres; offline degrada a "correr manualmente", igual que Phase 26.

## Validation Architecture

### Test Framework
| Propiedad | Valor |
|-----------|-------|
| Framework | vitest `^4.1.9` |
| Config file | Ninguno en `packages/fingerprint` (usa defaults); `report-model` tiene `vitest.config.ts`. `cms-adapters` puede omitir config (defaults) como fingerprint |
| Quick run command | `pnpm --filter @auditor/cms-adapters test` |
| Full suite command | `pnpm test` (turbo run test en todo el monorepo) |
| Typecheck | `pnpm --filter @auditor/cms-adapters typecheck` |

### Phase Requirements → Test Map
| Req ID | Comportamiento | Tipo | Comando automatizado | ¿Existe archivo? |
|--------|----------------|------|----------------------|------------------|
| CMSFIX-01/03 | Resolución correcta por (confianza × plataforma × checkId × builder) | unit | `pnpm --filter @auditor/cms-adapters test` (`resolveCmsRecommendation.test.ts`) | ❌ Wave 0 |
| CMSFIX-03 | Cobertura: 10 checkIds × 5 labels = 50 entradas presentes y no vacías; variantes WP builder para alt/JSON-LD | unit | `pnpm --filter @auditor/cms-adapters test` (`coverage.test.ts`) | ❌ Wave 0 |
| CMSFIX-02/04 | Fallback verbatim: `bajo`/`no-detectado`/plataforma-sin-adaptador/checkId-fuera-de-los-10 → devuelve el genérico intacto; severidad `ok` no se toca | unit | `pnpm --filter @auditor/cms-adapters test` + test en `report-model` (build) | ❌ Wave 0 |
| CMSFIX-05 | `buildReportModel` inyecta la recomendación resuelta usando `rawStack`; check fuera de los 10 (ej. TECH-10 hreflang) queda intacto | integration | `pnpm --filter @auditor/report-model test` | ❌ Wave 0 (nuevo test) |
| — | E2e contra audit real (recomendación personalizada visible) | manual/e2e | `pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]` | ❌ Wave 0 |

### Estrategia de tests para `packages/cms-adapters`
- **(a) Resolución:** matriz parametrizada sobre `Confidence` (`alto`/`medio` → personalizado; `bajo`/`no-detectado` → genérico), sobre labels (incluyendo uno sin adaptador, ej. `"Drupal"` → genérico), y sobre `stack === null` → genérico. Para WordPress + {ONPAGE-04, SD-01, SD-02}: assert de variante por builder (Elementor/Divi/WPBakery/Gutenberg) y de la rama con `builder = no-detectado`. Assert de que Wix y Squarespace devuelven textos **distintos** para el mismo checkId.
- **(b) Cobertura:** iterar `SUPPORTED_CHECK_IDS × CMS_LABELS`, assert de que `lookup` retorna string no vacío/no-whitespace para cada combinación (50). Assert adicional de que existen las variantes por builder de WP para los 2 checkIds de granularidad.
- **(c) E2e:** `verify-cms-fix.mts` espejo de `verify-stack.mts` — carga el audit `done` más reciente (o por `auditId`), reconstruye el `DetectedStack`, corre la resolución sobre los issues reales y hace `console.dir`; offline → `P1001` limpio con hint manual, nunca fabrica salida.
- **NO se testea** tono, prosa ni exactitud de rutas de menú (eso es revisión humana, ver `[REVISAR]`).

### Sampling Rate
- **Per task commit:** `pnpm --filter @auditor/cms-adapters test`
- **Per wave merge:** `pnpm --filter @auditor/cms-adapters test && pnpm --filter @auditor/report-model test`
- **Phase gate:** `pnpm test` + `pnpm typecheck` en verde antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/cms-adapters/src/resolveCmsRecommendation.test.ts` — cubre CMSFIX-01/02/03/04
- [ ] `packages/cms-adapters/src/coverage.test.ts` — cubre CMSFIX-03 (50 entradas)
- [ ] Test nuevo en `packages/report-model` (build) — guard de severidad `ok` + check fuera de los 10 intacto (CMSFIX-04/05)
- [ ] `apps/worker/scripts/verify-cms-fix.mts` — e2e
- [ ] No hace falta instalar framework: vitest ya está en el monorepo.

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`. `cms-adapters` es un paquete puro de strings estáticos sin parsing de input en runtime, sin red, sin secrets, sin auth y sin crypto — la superficie de seguridad es mínima.

### Applicable ASVS Categories

| ASVS Category | Aplica | Control estándar |
|---------------|--------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | sí (leve) | `resolveCmsRecommendation` debe manejar `checkId`/`cms.value` desconocidos devolviendo el genérico (default seguro), nunca lanzar ni indexar sin validar. El `checkId` viene de un enum-like persistido, no de input de usuario en vivo. |
| V6 Cryptography | no | — |
| V7 Errors/Logging | no | El paquete no loguea |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `checkId`/label inesperado provoca acceso inseguro a índice | Tampering/DoS | Lookup con `?? generic`; unión `CmsLabel` cerrada + `includes` guard antes de indexar `registry` |
| Copy con contenido no confiable inyectado en el reporte | XSS (aguas abajo) | El copy es 100% estático/constante en el repo; el renderizado lo hace `IssuesTable` existente que ya trata `recommendation` como texto — sin cambios ni nueva superficie |

No se identifican amenazas ASVS L1 nuevas atribuibles a esta fase. `security_block_on: high` — sin hallazgos high.

## Sources

### Primary (HIGH confidence — lectura directa de código)
- `packages/fingerprint/{package.json,tsconfig.json,src/index.ts,src/types.ts,src/signatures/{cms,builder,registry}.ts,src/signatures/registry.test.ts}` — convenciones de paquete puro, tipos exportados, ausencia de `CmsPlatform`, valores de `cms.value`/`builder.value`
- `packages/report-model/src/build.ts` (L17, L109-158, L182-183, L218-234) — punto de integración exacto, `rawStack` vs `stack`, call sites de `toReportIssue`
- `packages/report-model/src/model.ts` — `ReportIssue.recommendation: string | null`
- `packages/checks/src/checks/{onpage,tech,schema}/*.ts` — strings de recommendation verbatim y CHECK_IDs (ONPAGE-01..05, TECH-01/02/04, SD-01/02; no-cubiertos TECH-10/11/14)
- `apps/worker/scripts/verify-stack.mts` — patrón e2e con `tsx` y manejo `P1001`
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, ASVS L1
- `.planning/research/{ARCHITECTURE,FEATURES}.md` — Pattern 3, estructura de paquete, ejemplos de copy calibrados (alt/canonical/JSON-LD)

### Secondary (MEDIUM confidence — documentación oficial de plataformas)
- [Yoast — Optimizing SEO title and meta description](https://yoast.com/help/optimizing-the-seo-title-and-meta-description-of-your-homepage/) y [Site features](https://yoast.com/help/yoast-seo-settings-site-features/) — snippet editor, sitemap XML, social
- [Rank Math — Edit robots.txt](https://rankmath.com/kb/how-to-edit-robots-txt-with-rank-math/), [Configure sitemaps](https://rankmath.com/kb/configure-sitemaps/) — rutas de menú
- [Shopify Help — Editing robots.txt.liquid](https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt), [Store preferences](https://help.shopify.com/en/manual/online-store/setting-up/preferences), [Adding keywords for SEO](https://help.shopify.com/en/manual/promoting-marketing/seo/adding-keywords) — search engine listing, sitemap automático
- [Webflow Help — Add SEO title and meta description](https://help.webflow.com/hc/en-us/articles/33961237278611-Add-SEO-title-and-meta-description), [Open Graph](https://help.webflow.com/hc/en-us/articles/33961370297107-Control-the-look-of-social-shares-with-Open-Graph) — page settings
- [Wix — Customizing your page's SEO settings in the SEO panel](https://support.wix.com/en/article/customizing-your-pages-seo-settings-in-the-seo-panel), [Changing your page's meta description](https://support.wix.com/en/article/wix-editor-changing-your-pages-meta-description) — SEO básico, tab avanzado
- [Squarespace — Page settings](https://support.squarespace.com/hc/en-us/articles/206543657-Page-settings), [Adding SEO descriptions](https://support.squarespace.com/hc/en-us/articles/206016198-Adding-SEO-descriptions), [Changing title formats for SEO](https://support.squarespace.com/hc/en-us/articles/205814428-Changing-title-formats-for-SEO-and-browser-tabs) — pestaña SEO/Social

### Tertiary (LOW confidence — marcado `[REVISAR]`)
- Rutas de H1 en Wix/Squarespace, editor de robots.txt de Wix, nombres exactos de toggles en el panel actual de Webflow — no fijadas de forma unívoca en documentación oficial en esta sesión.

## Metadata

**Confidence breakdown:**
- Integración/arquitectura del motor: HIGH — derivado de lectura directa de `build.ts`, `fingerprint`, checks
- Estructura del paquete y tests: HIGH — espejo verificado de `packages/fingerprint`
- Copy de plataformas (WordPress/Shopify/Webflow): MEDIUM-HIGH — documentación oficial confirmó rutas principales
- Copy de plataformas (Wix/Squarespace, H1 y robots.txt): MEDIUM — rutas frágiles marcadas `[REVISAR]`
- Fallback/no-regresión: HIGH — strings capturados verbatim del código

**Research date:** 2026-07-24
**Valid until:** ~2026-08-23 para lo interno (estable); ~7-14 días para las rutas de admin de plataformas (UI cambia sin aviso; por eso los `[REVISAR]`)
