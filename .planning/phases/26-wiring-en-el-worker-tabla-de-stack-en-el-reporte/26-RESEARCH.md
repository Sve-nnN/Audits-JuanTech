# Phase 26: Wiring en el worker + tabla de stack en el reporte - Research

**Researched:** 2026-07-21
**Domain:** Integración interna (wiring de un paquete puro ya construido en el worker + persistencia aditiva + tabla UI tokenizada). No hay dependencias externas nuevas.
**Confidence:** HIGH (fase 100% codebase-grounded; todos los puntos de integración verificados leyendo el código real)

## Summary

Esta fase NO introduce librerías nuevas ni tecnología de dominio externo. Es una fase de *cableado*: el motor `detectStack` de `@auditor/fingerprint` (paquete puro terminado en Phase 25) ya existe y está probado; el schema ya persiste `Page.responseHeaders`/`Page.cookieNames`/`Page.html`. Lo que falta es (1) invocarlo una vez por auditoría en el worker y persistir el resultado en una columna nueva `Audit.stack` (Json?, aditiva, mismo patrón exacto que `Audit.scores`), (2) leerlo en `buildReportModel` y exponerlo como `ReportStack` en el `ReportModel`, y (3) renderar una tabla de 5 filas al inicio del reporte reutilizando el `Badge` existente para el nivel de confianza.

Los tres puntos de integración están verificados en código: el worker carga las páginas completas en `crawlAndCheck()` (línea 349-350 de `apps/worker/src/index.ts`) con todos los campos escalares (incluidos `responseHeaders`, `cookieNames`, `html`), lo que hace trivial mapear `Page[] → PageFingerprintInput[]` sin queries adicionales. El resultado del stack se devuelve junto a `scores` y se persiste en el mismo `prisma.audit.update` final (línea 607-624). En el reporte, la tabla se inserta entre la sección "Score general" (hero, termina línea 178) y "Scores por categoría" (línea 181) de `apps/web/app/audits/[id]/page.tsx`, leyendo `model.stack` (nunca una query paralela).

**Dos hallazgos que corrigen supuestos del CONTEXT** (ver Assumptions Log): (a) `@auditor/fingerprint` NO está todavía en las dependencias de `@auditor/worker` ni de `@auditor/report-model` — hay que agregarlo (`workspace:*`) en ambos `package.json`; (b) el `IssuesTable` existente NO colapsa a lista vertical en mobile — su patrón real es *scroll horizontal* (`overflow-x:auto`, comentado explícitamente en su fuente). Como la tabla de stack son solo 5 filas × 3 columnas, la recomendación es un CSS Grid propio que apila en mobile (coherente con la convención "responsive sin overflow horizontal"), NO copiar el patrón de `IssuesTable`.

**Primary recommendation:** Tabla nueva y simple (componente propio, no reusar `CategoryCard` ni `IssuesTable`), tokens-only, que consume `model.stack` de `buildReportModel`; el worker invoca `detectStack` una vez y persiste `Audit.stack` en el `update` final que ya escribe `scores`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ejecutar `detectStack` una vez por auditoría | Worker (`apps/worker`) | — | Función pura sin I/O; corre en el proceso long-lived tras el crawl, donde ya están cargadas las páginas. Nunca en Vercel ni en tiempo de lectura del reporte. |
| Persistir `Audit.stack` | Worker + Database (`packages/db`) | — | Columna Json? aditiva, escrita en el mismo `audit.update` que `scores`. Idempotente: se sobreescribe en cada corrida completa. |
| Leer/transformar el stack para el reporte | `packages/report-model` (`buildReportModel`) | — | Single source of truth ya establecido en v1.2. Evita la query divergente (riesgo latente anotado del JSON-LD paralelo en `pages/page.tsx`). |
| Renderar la tabla de stack | Frontend Server (RSC en `apps/web`) | — | Server Component; la tabla es data estática del modelo, sin interactividad. El `Badge` es `"use client"` pero se compone dentro del RSC sin problema (patrón ya usado con `DiffBadge`/`Badge` en la misma página). |
| Mapear confianza → variante visual | Frontend (componente tabla) | — | Mapeo puro `Confidence → BadgeVariant`, sin lógica de negocio. |

## Standard Stack

Esta fase **no instala paquetes nuevos**. Todo el trabajo usa paquetes internos ya presentes en el monorepo.

### Core (paquetes internos ya existentes)
| Paquete | Rol en esta fase | Estado | Notas |
|---------|------------------|--------|-------|
| `@auditor/fingerprint` | Provee `detectStack` + tipo `DetectedStack` | Construido en Phase 25 `[VERIFIED: packages/fingerprint/src/index.ts]` | **Falta agregarlo como dep** en `@auditor/worker` y `@auditor/report-model`. |
| `@auditor/db` (Prisma) | Persistencia `Audit.stack` | Presente `[VERIFIED: packages/db/prisma/schema.prisma]` | Schema-first: agregar columna + `pnpm db:push` contra Neon (sin migrations folder). |
| `@auditor/report-model` | `buildReportModel` lee `Audit.stack` | Presente `[VERIFIED: packages/report-model/src/build.ts]` | Agregar `ReportStack` a `model.ts` y exportarlo en `index.ts`. |
| `@auditor/worker` (`apps/worker`) | Invoca `detectStack`, persiste | Presente `[VERIFIED: apps/worker/src/index.ts]` | Punto de inserción: dentro de `crawlAndCheck()`, donde `pages` está en scope. |
| `apps/web` (Next.js App Router RSC) | Renderiza la tabla | Presente `[VERIFIED: apps/web/app/audits/[id]/page.tsx]` | Server Component; compone `Badge` (client) sin fricción. |

### Supporting (componentes/tokens de UI ya existentes)
| Asset | Rol | Cuándo usar |
|-------|-----|-------------|
| `apps/web/app/components/ui/Badge.tsx` | Pill de confianza | Reusar directo. Ya tiene 8 variantes: `critical/warning/ok/new/persistent/resolved/info/neutral`. `[VERIFIED: Badge.tsx]` |
| `apps/web/app/tokens.css` | Tokens semánticos | Toda la tabla usa `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-secondary)`, `--font-khand`, escala `--space-*`. Cero hex. `[VERIFIED: tokens.css]` |
| `report.module.css` `.sectionTitle` | Título "Stack técnico detectado" | Reusar la clase (Khand, `--font-size-2xl`, `--weight-semibold`) para el título de sección. `[VERIFIED: report.module.css:118]` |
| `labels.ts` | Etiquetas en español neutral | Agregar un mapa `AXIS_LABEL` / `CONFIDENCE_LABEL` acá para evitar drift de copy. `[VERIFIED: labels.ts]` |

### Alternatives Considered
| En vez de | Se podría usar | Tradeoff |
|-----------|----------------|----------|
| Tabla propia (CSS Grid) | Reusar `IssuesTable` | `IssuesTable` es scroll horizontal (NO colapsa), API de columnas genérica pensada para muchas filas. Overkill y patrón de responsive equivocado para 5 filas. |
| Tabla propia | Reusar `CategoryCard` | CONTEXT lo descarta explícitamente; `CategoryCard` es score+estado, semántica distinta. |
| `Badge` variantes existentes | Nueva variante `outline` para "bajo" | Existente `info` (azul/accent) o reuso de `warning` tenue cubre "bajo" sin tocar el primitivo. Ver Pitfall 3. |

**Installation:** Ninguna instalación de registro externo. Solo cambios de `package.json` internos:

```jsonc
// apps/worker/package.json  → dependencies
"@auditor/fingerprint": "workspace:*"
// packages/report-model/package.json → dependencies
"@auditor/fingerprint": "workspace:*"
```

Luego `pnpm install` (relink de workspace) y `pnpm db:push` tras editar el schema.

## Package Legitimacy Audit

> No aplica: esta fase **no instala ningún paquete de registro externo** (npm/PyPI/crates). Las únicas dependencias nuevas son referencias `workspace:*` a `@auditor/fingerprint`, un paquete interno del propio monorepo construido en Phase 25. Sin superficie de slopsquatting.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   Worker (Railway,       │  crawlAndCheck()  [apps/worker/src/index.ts] │
   proceso long-lived)    │                                             │
                          │   runCrawl() ──► Page rows persisted         │
                          │        │          (html, responseHeaders,    │
                          │        │           cookieNames)              │
                          │        ▼                                     │
                          │   prisma.page.findMany({ auditId })  (L349)  │
                          │        │  pages: Page[] (todos los escalares) │
                          │        ▼                                     │
        NUEVO ──────────► │   pages.map → PageFingerprintInput[]         │
                          │        │   (url, isHome, html,               │
                          │        │    responseHeaders, cookieNames)    │
                          │        ▼                                     │
        NUEVO ──────────► │   detectStack({ pages }) : DetectedStack     │
                          │        │   (función PURA, sin I/O)            │
                          │        ▼                                     │
                          │   return { ...scores, stack }                │
                          └──────────────────┬──────────────────────────┘
                                             ▼
        NUEVO ──────────►  prisma.audit.update({ data: {                  }
                             status, scores, stack /* Json? aditiva */ } })  (L607)
                                             │
                          ┌──────────────────▼──────────────────────────┐
   Frontend Server        │  buildReportModel(auditId)  [report-model]   │
   (Vercel, RSC)          │   audit.stack ──► ReportStack (transform)     │
                          │   model.stack (undefined si audit.stack null) │
                          └──────────────────┬──────────────────────────┘
                                             ▼
                          ┌─────────────────────────────────────────────┐
                          │  AuditReportPage (RSC) [audits/[id]/page.tsx]│
                          │   ...hero (Score general)...                 │
        NUEVO ──────────► │   {model.stack && <StackTable stack=... />}  │
                          │   ...Scores por categoría (CategoryCards)... │
                          └─────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/worker/src/
  index.ts                      # + map Page→PageFingerprintInput, + detectStack, + persist stack

packages/db/prisma/
  schema.prisma                 # + Audit.stack Json?  (aditiva)

packages/report-model/src/
  model.ts                      # + interface ReportStack, ReportStackAxis, + campo en ReportModel
  build.ts                      # + leer audit.stack, transformar a ReportStack
  index.ts                      # + export type ReportStack...
  build.test.ts                 # + casos: stack presente / null / analytics múltiples

apps/web/app/
  components/ui/
    StackTable.tsx              # NUEVO componente (Server Component)
    StackTable.module.css       # NUEVO (tokens-only, grid responsive)
    labels.ts                   # + AXIS_LABEL, CONFIDENCE_LABEL
  audits/[id]/page.tsx          # + <StackTable> entre hero y "Scores por categoría"
```

### Pattern 1: Devolver el stack junto a `scores` desde `crawlAndCheck()`
**What:** El worker ya devuelve un objeto `{ summary, issueCounts, perfSummary, scores, graph }` desde `crawlAndCheck()` y lo persiste en un único `audit.update`. Agregar `stack` a ese objeto y a ese update — no crear un `update` separado.
**When to use:** Siempre; mantiene una sola escritura atómica del audit.
**Example:**
```typescript
// Source: apps/worker/src/index.ts (patrón real de scores, L585-598 + L607-624)
// Dentro de crawlAndCheck(), donde `pages` ya está cargado (L349-350):
const fpInput: PageFingerprintInput[] = pages
  .filter((p) => p.html != null && p.html !== "")
  .map((p) => ({
    url: p.url,
    // home = página cuyo url/finalUrl matchea el startUrl resuelto (L300)
    isHome: p.url === startUrl || p.finalUrl === startUrl,
    html: p.html,
    responseHeaders: (p.responseHeaders ?? {}) as Record<string, string>,
    cookieNames: p.cookieNames ?? [],
  }));
const stack = detectStack({ pages: fpInput });   // función pura, sin I/O
// ...
return { summary, issueCounts, perfSummary, scores, graph, stack };

// En el update final (L607):
data: {
  status: "done",
  // ...
  scores: scores as unknown as Prisma.InputJsonValue,
  stack: stack as unknown as Prisma.InputJsonValue,   // NUEVO
}
```

### Pattern 2: Transformar `Audit.stack` en `buildReportModel` (single source of truth)
**What:** Leer `audit.stack` (ya viene en el `findUnique` de la L130, es un campo escalar Json), castear a `DetectedStack`, y mapear a un `ReportStack` serializable. Si `audit.stack` es `null` → `model.stack = undefined` (nunca tabla vacía artificial).
**When to use:** Siempre. La página del reporte NUNCA debe hacer una query paralela a `audit.stack`.
**Example:**
```typescript
// Source: patrón de perf/architecture en packages/report-model/src/build.ts (L137-141, L309-320)
import type { DetectedStack } from "@auditor/fingerprint";

const rawStack = audit.stack as unknown as DetectedStack | null;
const stack: ReportStack | undefined = rawStack ? toReportStack(rawStack) : undefined;
// ...
return { /* ...existing fields..., */ stack };
```

### Pattern 3: Mapeo Confianza → variante de Badge (CONTEXT decision)
**What:** Mapa puro, definido una vez.
```typescript
// Confidence del tipo @auditor/fingerprint: "alto" | "medio" | "bajo" | "no-detectado"
const CONFIDENCE_BADGE: Record<Confidence, BadgeVariant> = {
  alto:            "ok",       // verde  (--success)
  medio:           "warning",  // ámbar  (--warning)
  bajo:            "info",     // accent/tenue — NUNCA critical
  "no-detectado":  "neutral",  // gris   (--text-secondary / surface-hover)
};
// CONFIANZA NUNCA se mapea a "critical" (rojo) — no es severidad de error de auditoría.
```

### Anti-Patterns to Avoid
- **Query paralela a `audit.stack` en `page.tsx`:** rompe el single-source-of-truth (mismo error latente que el JSON-LD paralelo de v1.2). Todo pasa por `buildReportModel`.
- **Segundo `prisma.audit.update` solo para stack:** dos escrituras donde alcanza una; el patrón `scores` ya persiste en un update único.
- **Correr `detectStack` en tiempo de lectura del reporte:** viola SC#1 (una sola vez por auditoría). Es cálculo del worker, no del RSC.
- **Copiar el patrón responsive de `IssuesTable`:** ese componente hace scroll horizontal, no colapso vertical. Ver Pitfall 2.
- **Ocultar filas sin detección:** las 5 filas se muestran SIEMPRE; "no-detectado" es estado de primera clase.
- **Forzar `Audit.stack` NOT NULL o default `{}`:** debe ser nullable; audits pre-v1.5 quedan `null` y la sección entera no se renderiza.

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Detección de stack | Re-parsear HTML / re-evaluar headers en el reporte | `detectStack` (ya hecho, Phase 25) | Función pura probada; correrla una vez y persistir. |
| Agregación de páginas (headers lowercased, unión de cookies, elección de HTML home) | Lógica de merge propia en el worker | Pasar `PageFingerprintInput[]` crudo a `detectStack` — él agrega internamente (`aggregate()`) | El motor ya hace lowercase, dedup de cookies, elección home→fallback y truncado defensivo (256KB). `[VERIFIED: detectStack.ts:54-78]` |
| Pill de confianza | Nuevo componente de badge | `Badge` existente (8 variantes) | Ya tokenizado, tema claro/oscuro, accesible (color nunca es señal única). |
| Etiquetas de estado en español | Strings inline en JSX | Mapas en `labels.ts` | Convención del proyecto para evitar drift de copy. |

**Key insight:** Casi todo el "trabajo difícil" (agregación, confianza por reglas, coexistencia de analytics) ya vive dentro de `detectStack`. Esta fase es fontanería: transportar un objeto puro desde el worker hasta un `<td>`.

## Runtime State Inventory

> Aplica parcialmente: se agrega una columna nueva, no un rename. Auditamos qué estado runtime queda afectado.

| Categoría | Items encontrados | Acción requerida |
|-----------|-------------------|------------------|
| Stored data | `Audit.stack` es columna NUEVA. Audits existentes (pre-v1.5) quedan con `stack = NULL` — correcto por diseño (la tabla no se renderiza). No hay backfill: el stack solo se calcula en corridas nuevas del worker. | **Data migration: NINGUNA.** Solo `pnpm db:push` para agregar la columna. |
| Live service config | Ninguna. No hay config en UIs externas ni servicios que referencien esta columna. | None |
| OS-registered state | Ninguna. | None |
| Secrets/env vars | Ninguno nuevo. `DATABASE_URL` ya existe. | None |
| Build artifacts / installed packages | El cliente Prisma se regenera al cambiar el schema (`prisma generate`, disparado por `db:push`). `@auditor/fingerprint` debe relinkearse como dep de worker/report-model (`pnpm install`). | `pnpm install` + `pnpm db:push`; verificar que `apps/worker` y `packages/report-model` resuelvan `@auditor/fingerprint`. |

**Neon push:** correr `pnpm --filter @auditor/db db:push` **antes** de probar el worker contra datos reales (convención confirmada en STATE.md L109 y en Phase 25).

## Common Pitfalls

### Pitfall 1: `@auditor/fingerprint` no es dependencia de worker ni report-model
**What goes wrong:** El import `import { detectStack } from "@auditor/fingerprint"` compila en el editor (workspace) pero falla el build/typecheck aislado del paquete porque no está declarado en `package.json`.
**Why it happens:** Phase 25 creó el paquete pero solo lo consumía a sí mismo; el CONTEXT asume acoplamiento "sin problema" pero no menciona declarar la dep.
**How to avoid:** Agregar `"@auditor/fingerprint": "workspace:*"` a `dependencies` de `apps/worker/package.json` **y** `packages/report-model/package.json`, luego `pnpm install`. `[VERIFIED: grep de package.json — ausente en ambos]`
**Warning signs:** `Cannot find module '@auditor/fingerprint'` en `pnpm --filter @auditor/worker build`.

### Pitfall 2: Suponer que `IssuesTable` colapsa a lista vertical en mobile
**What goes wrong:** El CONTEXT dice "colapsa a lista vertical en mobile (mismo patrón que IssuesTable)". El código real de `IssuesTable` documenta lo contrario: "Responsive por scroll horizontal (NO colapsa a cards)".
**Why it happens:** Supuesto no verificado en el discuss.
**How to avoid:** Construir un CSS Grid propio para `StackTable` que apile en mobile (`grid-template-columns` que pasa a una columna bajo `--bp-sm`), coherente con la convención "responsive sin overflow horizontal". Con 5 filas × 3 columnas no hace falta scroll. `[VERIFIED: IssuesTable.tsx:30-42]`
**Warning signs:** Overflow horizontal en el reporte en viewport angosto.

### Pitfall 3: "bajo" no tiene variante de badge dedicada
**What goes wrong:** CONTEXT pide 4 estados visuales (alto/medio/bajo/no-detectado) pero mapea "bajo → warning tenue/outline"; no existe variante `outline`.
**Why it happens:** El `Badge` tiene `warning` (ámbar sólido) pero no un ámbar tenue separado.
**How to avoid:** Mapear `bajo → info` (usa `--accent-text`, azul/lima tenue, distinto de warning) **o** aceptar `bajo → warning` reutilizando la misma variante que "medio" y diferenciar solo por la palabra. Decisión para el planner/discuss; recomendación: `info` para que las 4 confianzas se vean distintas sin tocar el primitivo. NUNCA `critical`. `[VERIFIED: Badge.module.css — no hay variante outline]`
**Warning signs:** "bajo" y "medio" indistinguibles visualmente.

### Pitfall 4: Analytics es un ARRAY, las demás son objeto único
**What goes wrong:** Renderizar `analytics` como si fuera un solo `AxisResult` produce `[object Object]` o pierde herramientas coexistentes.
**Why it happens:** `DetectedStack.analytics: AxisResult[]` (array) mientras cms/cdn/hosting/jsFramework/builder son `AxisResult` único. `[VERIFIED: types.ts:65-74]`
**How to avoid:** La fila Analytics mapea `analytics.map(a => <Badge>)` — múltiples chips (GA4, Google Tag Manager, Meta Pixel) en la misma celda. Si el array está vacío → "No detectado con certeza" + badge neutral.
**Warning signs:** Solo aparece una herramienta de analytics aunque el sitio tenga varias.

### Pitfall 5: CMS + builder combinados en una sola fila
**What goes wrong:** Mostrar builder como fila separada cuando CONTEXT pide "WordPress (Elementor)" en una celda.
**Why it happens:** El tipo tiene `cms` y `builder` como ejes separados.
**How to avoid:** En el transform (report-model o el componente), si `cms.value === "WordPress"` y `builder.value != null`, componer el label `"WordPress (Elementor)"`. La confianza mostrada es la del CMS (el builder es un refinamiento). `builder` fuera de WordPress ya viene `no-detectado` por el motor. `[VERIFIED: detectStack.ts:212]`
**Warning signs:** 6 filas en vez de 5; builder huérfano.

### Pitfall 6: `isHome` mal marcado degrada la elección de HTML
**What goes wrong:** Si ninguna página se marca `isHome`, `detectStack` cae al fallback (primera página con HTML), que puede no ser la home y perder señales de CMS que viven en el home.
**Why it happens:** El worker debe derivar `isHome` desde `startUrl` (la URL resuelta, L300). Comparar contra `page.url` y `page.finalUrl`.
**How to avoid:** `isHome: p.url === startUrl || p.finalUrl === startUrl`. Hay fallback interno, así que un fallo no rompe, pero la precisión baja. `[VERIFIED: detectStack.ts:67-69]`
**Warning signs:** CMS "no-detectado" en sitios obviamente WordPress.

## Code Examples

### Definir `ReportStack` en el modelo (serializable, sin clases)
```typescript
// Source: patrón de tipos serializables en packages/report-model/src/model.ts
import type { Confidence } from "@auditor/fingerprint";

/** Un eje resuelto, listo para la tabla (label ya compuesto, sin señales de debug). */
export interface ReportStackAxis {
  /** "CMS", "CDN / proxy", "Hosting", "Framework JS", "Analytics" — ya localizado o key. */
  value: string | null;         // "WordPress (Elementor)", "Cloudflare", ... o null
  confidence: Confidence;       // "alto" | "medio" | "bajo" | "no-detectado"
}

/** Stack listo para renderizar. Analytics es lista (coexistencia). */
export interface ReportStack {
  cms: ReportStackAxis;         // ya combina builder: "WordPress (Elementor)"
  cdn: ReportStackAxis;
  hosting: ReportStackAxis;
  jsFramework: ReportStackAxis;
  analytics: ReportStackAxis[]; // vacío → fila "no detectado con certeza"
}
// En ReportModel:  stack?: ReportStack;   // undefined cuando Audit.stack es null
```

### Componente `StackTable` (Server Component, tokens-only)
```tsx
// Source: composición RSC + Badge, patrón de apps/web/app/audits/[id]/page.tsx
import { Badge, type BadgeVariant } from "./Badge";
import type { ReportStack } from "@auditor/report-model";
import type { Confidence } from "@auditor/fingerprint";
import styles from "./StackTable.module.css";

const CONFIDENCE_BADGE: Record<Confidence, BadgeVariant> = {
  alto: "ok", medio: "warning", bajo: "info", "no-detectado": "neutral",
};
const CONFIDENCE_LABEL: Record<Confidence, string> = {
  alto: "Confianza alta", medio: "Confianza media",
  bajo: "Confianza baja", "no-detectado": "No detectado con certeza",
};

export function StackTable({ stack }: { stack: ReportStack }) {
  // ...map de 5 filas; la fila Analytics mapea stack.analytics.map(...) a chips
  // "No detectado con certeza" cuando value===null o analytics vacío.
}
```

## State of the Art

No aplica: no hay tecnología de dominio externo evolucionando. El "estado del arte" relevante es el de librerías de fingerprinting (Wappalyzer/BuiltWith), explícitamente descartadas en REQUIREMENTS.md (deprecadas / GPL / pagas) a favor del motor propio ya construido en Phase 25.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El worker carga `pages` con `responseHeaders`/`cookieNames`/`html` sin `select`, así que están disponibles para el map. | Pattern 1 | Bajo — verificado: `findMany` sin `select` devuelve todos los escalares `[VERIFIED: index.ts:350]`. Si algún día se agrega `select`, hay que incluir esos campos. |
| A2 | Mapear `bajo → info` es la elección estética correcta. | Pitfall 3 | Bajo — es decisión de diseño; el planner/Juan puede preferir `bajo → warning`. Ninguna rompe requisitos (solo NUNCA critical). |
| A3 | La confianza mostrada para la fila CMS es la del eje `cms`, no la del `builder`. | Pitfall 5 | Bajo — coherente con que builder es refinamiento; validar visualmente. |
| A4 | `isHome` derivable por igualdad exacta `url/finalUrl === startUrl`. | Pitfall 6 | Medio — si el crawler normaliza URLs distinto (barra final, etc.) el match puede fallar y caer al fallback. Verificar contra un audit real (aprendoclub) que el CMS se detecte. El fallback interno evita rotura, solo baja precisión. |

## Open Questions

1. **¿"bajo" → `info` o → `warning`?** — **RESUELTO: `bajo → warningSubtle`** (variante nueva del UI-SPEC).
   - Lo que sabemos: CONTEXT pide 4 estados visuales distinguibles; NUNCA critical.
   - Lo que falta: no hay variante `outline` en `Badge`.
   - Resolución (orquestador): el CONTEXT bloquea literalmente "bajo → warning **tenue/outline**" (familia ámbar). `info` es azul/accent y cambia la tonalidad, incumpliendo esa decisión. El UI-SPEC (contrato de diseño autoritativo, aguas abajo del CONTEXT) implementa la lectura fiel con la variante nueva **`warningSubtle`**: ámbar en outline tenue (fondo transparente + borde `color-mix(--warning 35%)`), token-only y CSP-safe. La sugerencia previa `info` de esta sección queda **superada**; el planner debe usar `warningSubtle` y agregar esa única variante a `Badge.tsx`/`Badge.module.css`.

2. **¿Se localizan los `value` de tecnología (p.ej. "Google Tag Manager") o se muestran verbatim?**
   - Lo que sabemos: los value strings del motor son "WordPress", "Cloudflare", "GA4", "Google Tag Manager", "Meta Pixel", etc. `[VERIFIED: signatures/*.ts]`
   - Lo que falta: si Juan quiere "GTM" corto vs "Google Tag Manager".
   - Recomendación: mostrar los value del motor verbatim (son nombres propios de producto); solo los **labels de eje** y de **confianza** se localizan en `labels.ts`.

3. **¿El transform CMS+builder ("WordPress (Elementor)") vive en `report-model` o en el componente?**
   - Recomendación: en `report-model` (`toReportStack`), así queda en el single-source-of-truth y un futuro export lo reutiliza sin re-derivar. El componente solo pinta.

## Environment Availability

> Sin dependencias externas nuevas. La única infra tocada es la base Postgres (Neon) ya en uso.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres | Persistir `Audit.stack` | ✓ (ya en uso) | — | — |
| `pnpm` workspace | Relink de `@auditor/fingerprint` | ✓ | — | — |
| `prisma` CLI (`db:push`) | Agregar columna | ✓ (`packages/db` script) | — | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** ninguna.

## Validation Architecture

> `nyquist_validation: true` — sección incluida.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 `[VERIFIED: package.json]` |
| Config file | Por paquete (cada workspace corre `vitest run`) |
| Quick run command | `pnpm --filter @auditor/report-model test` |
| Full suite command | `pnpm -r test` (o por paquete tocado) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FPRINT-09 | `detectStack` corre una vez y `Audit.stack` se persiste; reabrir no re-ejecuta | unit (report-model) + verificación manual worker | `pnpm --filter @auditor/report-model test` | ❌ Wave 0 (extender `build.test.ts`) |
| FPRINT-09 | `buildReportModel` expone `model.stack` desde `Audit.stack`; `undefined` cuando null | unit | `pnpm --filter @auditor/report-model test -t stack` | ❌ Wave 0 |
| STACKUI-01 | Tabla aparece al inicio del reporte (tras hero, antes de CategoryCards) | component (web) | `pnpm --filter web test -t StackTable` | ❌ Wave 0 |
| STACKUI-02 | Cada eje muestra confianza; analytics múltiple; CMS+builder combinado; "no detectado" visible | component | `pnpm --filter web test -t StackTable` | ❌ Wave 0 |
| STACKUI-03 | Tokens-only, sin hex, ambos temas | grep de hex + revisión | `! grep -nE "#[0-9a-fA-F]{3,6}" apps/web/app/components/ui/StackTable.module.css` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter <paquete-tocado> test`
- **Per wave merge:** `pnpm -r test` sobre worker/report-model/web
- **Phase gate:** suite verde + verificación manual contra un audit real (aprendoclub) con `tsx` antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Extender `packages/report-model/src/build.test.ts` — casos: stack presente (mapea 5 ejes), `Audit.stack = null` → `model.stack === undefined`, analytics array múltiple, CMS+builder combinado.
- [ ] `apps/web/app/components/ui/StackTable.test.tsx` — render de 5 filas, fila "no-detectado" visible, chips múltiples de analytics, mapeo confianza→variante (nunca critical).
- [ ] Guard anti-hex en el CSS del componente (grep en CI o test).
- [ ] Script `tsx` de verificación contra audit real (opcional, patrón STATE.md L110): correr `detectStack` sobre las páginas de un audit ya crawleado e imprimir el `DetectedStack`.

## Security Domain

> `security_enforcement: true`, ASVS level 1. Superficie de esta fase: mínima (data interna ya persistida, sin input de usuario nuevo, sin PII).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sin cambios de auth. |
| V3 Session Management | no | — |
| V4 Access Control | no | El reporte ya es accesible por `auditId`; no se agrega superficie. |
| V5 Input Validation | parcial | El stack se deriva de HTML/headers ADVERSARIOS del sitio auditado; el motor ya truncó a 256KB y usó `Object.create(null)` contra prototype pollution (Phase 25, T-25-07/08/09). La tabla solo debe **renderizar como texto** los `value` (React escapa por defecto). |
| V6 Cryptography | no | Sin cripto. |

### Known Threat Patterns for esta fase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS vía `value` de tecnología con HTML incrustado (viene de HTML adversario del sitio) | Tampering / Injection | Renderizar `value` como texto plano en JSX (React escapa). NUNCA `dangerouslySetInnerHTML`. Los `value` provienen de `Signature.value` (constantes del código, no del sitio), así que el riesgo real es bajo, pero el label combinado "WordPress (Elementor)" también es constante-derivado. `[VERIFIED: signatures/*.ts — value son literales del código]` |
| Prototype pollution vía headers `__proto__` | Tampering | Ya mitigado dentro de `detectStack` (`Object.create(null)`). El worker pasa `responseHeaders` crudo; no lo indexa por keys hostiles. `[VERIFIED: detectStack.ts:55]` |
| Fuga de PII en `Audit.stack` | Information Disclosure | `DetectedStack` no contiene email ni token; solo tecnología detectada. `cookieNames` transporta solo NOMBRES (nunca valores) por construcción del tipo. `[VERIFIED: types.ts:86-95]` |
| Filtrar `Signal.evidence` (debug) al cliente | Information Disclosure | El transform `toReportStack` debe DESCARTAR `signals`/`evidence` — el `ReportStack` solo lleva `value` + `confidence`. Evita exponer detalles internos de detección. |

## Sources

### Primary (HIGH confidence — código real del repo, verificado esta sesión)
- `packages/fingerprint/src/types.ts` — contrato `DetectedStack`, `AxisResult`, `Confidence`, `PageFingerprintInput`.
- `packages/fingerprint/src/detectStack.ts` — firma `detectStack({ pages }): DetectedStack`, agregación interna, resolución por eje, defensas DoS/prototype.
- `packages/fingerprint/src/signatures/*.ts` — value strings (WordPress/Shopify/Cloudflare/GA4/Google Tag Manager/Meta Pixel/Next.js…).
- `apps/worker/src/index.ts` — punto de carga de `pages` (L349), `startUrl` (L300), return de `crawlAndCheck` (L598), `audit.update` final (L607-624).
- `packages/db/prisma/schema.prisma` — modelo `Audit` (patrón `scores`/`stats` Json?), `Page.responseHeaders`/`cookieNames`.
- `packages/report-model/src/build.ts` + `model.ts` + `index.ts` — `buildReportModel`, patrón de campos opcionales (perf/architecture), exports de tipos.
- `apps/web/app/audits/[id]/page.tsx` — punto de inserción de la tabla (entre L178 hero y L181 CategoryCards).
- `apps/web/app/components/ui/Badge.tsx` + `Badge.module.css` — 8 variantes, tokens.
- `apps/web/app/components/ui/IssuesTable.tsx` — patrón responsive REAL (scroll horizontal, no colapso).
- `apps/web/app/tokens.css` — tokens semánticos, `--font-khand`.
- `apps/web/app/components/ui/labels.ts` — mapas de etiquetas es-neutral.

### Secondary (MEDIUM confidence)
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `26-CONTEXT.md` — decisiones y convenciones del proyecto.

### Tertiary (LOW confidence)
- Ninguna. Toda afirmación técnica está anclada a código verificado.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no hay stack externo; paquetes internos verificados en el repo.
- Architecture: HIGH — los tres puntos de integración leídos línea por línea; patrón `scores`/`perf`/`architecture` replicable 1:1.
- Pitfalls: HIGH — cada pitfall verificado contra código (dep faltante, patrón IssuesTable, analytics array, isHome).

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (30 días; fase interna estable, sin dependencias de versión externa que se muevan).
