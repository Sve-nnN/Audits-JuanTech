# Phase 29: Scoring — categoría Social + retiro de ONPAGE-05 - Research

**Researched:** 2026-08-01
**Domain:** Refactor interno de tipos/constantes en un monorepo TypeScript (pnpm + Turborepo). Cero dependencias externas nuevas.
**Confidence:** HIGH (todo verificado por lectura directa del código + typecheck y test suite ejecutados empíricamente sobre el cambio propuesto)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Retiro de ONPAGE-05**

- Eliminar `packages/checks/src/checks/onpage/openGraph.ts` completo (archivo + su export/import en `packages/checks/src/checks/onpage/index.ts`), no dejarlo como código muerto sin usar.
- No tocar filas `Issue` con `checkId="ONPAGE-05"` ya persistidas de auditorías anteriores — quedan como historial, tal como SOCIAL-09 ya lo especifica como "corte de versión" (scores pre/post v1.6 no comparables). Sin migración de datos.
- Agregar un test guardarraíl explícito que confirme que `onPageChecks`/el registry completo ya no contiene ningún check con `checkId === "ONPAGE-05"`.
- La comparación real de "cero issues duplicados por fingerprint" entre lo que hacía ONPAGE-05 y los checks nuevos de Open Graph (SOCIAL-01..08) sólo puede verificarse cuando esos checks existan — eso se retoma explícitamente en Phase 30, no en esta fase. Esta fase sólo garantiza que ONPAGE-05 ya no está activo.

**Pesos y tipos (`Category` / `CATEGORY_WEIGHTS`)**

- Insertar `"social"` al final del union type `Category` y del objeto `CATEGORY_WEIGHTS` (después de `aeo`), siguiendo el orden cronológico de introducción que ya usa el objeto (no alfabético).
- Actualizar el comentario de cabecera de `Category`/`CATEGORY_WEIGHTS` en `packages/scoring/src/overallScore.ts` ("The five report categories..." → seis, mencionando social).
- `"social"` sigue el patrón normal issue-derived (como `tech`/`onpage`/`schema`/`aeo`), NO el patrón especial de `"perf"` (que se excluye por blacklist y se calcula aparte desde PSI). El loop de agregación en `apps/worker/src/index.ts` (líneas ~572-585) ya filtra por blacklist explícita de `"perf"` (`if (row.category === "perf") continue`), así que `"social"` fluye automáticamente sin tocar ese loop — sólo hace falta que el tipo `Category` lo incluya.
- Agregar un test que verifique `Object.values(CATEGORY_WEIGHTS).reduce((a,b)=>a+b,0) === 1` (protección contra futuros rebalanceos que rompan la suma).

### Claude's Discretion

- Nombres exactos de archivos de test nuevos y su ubicación (`packages/scoring/src/overallScore.test.ts` ya existe, extender ahí vs archivo nuevo).
- Redacción exacta del comentario actualizado en `overallScore.ts`.

### Deferred Ideas (OUT OF SCOPE)

- Verificación cruzada de fingerprint entre ONPAGE-05 (retirado) y los checks nuevos SOCIAL-01..08 — diferida explícitamente a Phase 30, cuando esos checks existan.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCORE-01 | Categoría "social" nueva en `Category` union + `WEIGHTS` | Ubicación única confirmada: `packages/scoring/src/overallScore.ts:10` (union) y `:23-29` (`CATEGORY_WEIGHTS`). Verificado que el cambio compila en 13/16 paquetes y rompe exactamente 3 sitios (ver Fan-out de compilación). |
| SCORE-02 | Rebalanceo de pesos (onpage .15→.10, schema .10→.05, social .10 nuevo), documentado como corte de versión | Suma verificada: 0.30+0.30+0.10+0.05+0.15+0.10 = 1.00. El test guardarraíl ya existe (`overallScore.test.ts:5-10`) y se comprobó empíricamente que falla si la suma se rompe. |
| SOCIAL-09 | Retiro de ONPAGE-05 con guardarraíl de cero duplicados por fingerprint | Confirmado: 1 archivo de implementación + 3 referencias en el barrel. Sin test propio que huérfanar. `registry.test.ts` ya tiene el patrón exacto de guardarraíl de contenido del registry. Consecuencia de diff cuantificada abajo (Pitfall 4). |
</phase_requirements>

## Desviaciones verificadas contra CONTEXT.md

> Leí el código real. Reporto las divergencias explícitamente porque el planner necesita corregirlas antes de escribir tareas.

| # | Afirmación en CONTEXT.md | Realidad verificada | Impacto en el plan |
|---|--------------------------|---------------------|--------------------|
| D-1 | "Agregar un test que verifique `Object.values(CATEGORY_WEIGHTS).reduce(...) === 1`" | **Ese test YA EXISTE**: `packages/scoring/src/overallScore.test.ts:5-10`, bloque `describe("CATEGORY_WEIGHTS") > it("sums to 1.0")`, con `toBeCloseTo(1.0, 5)`. [VERIFIED: lectura directa + ejecución] | El plan NO debe crear un test duplicado. La tarea correcta es *verificar que sigue pasando* tras el rebalanceo. Comprobado empíricamente: al agregar `social: 0.1` sin bajar onpage/schema, la suma da 1.1 y este test **falla** — el guardarraíl ya funciona. |
| D-2 | "No hay cambios necesarios en `packages/report-model` ni en el reporte web para esta fase" | **Falso.** Agregar `"social"` al union `Category` produce **3 errores de compilación** (`pnpm typecheck --continue` ejecutado con el cambio aplicado). Ver tabla "Fan-out de compilación". | Phase 29 obligatoriamente toca `packages/export` y `apps/web`. La fase deja de ser "sólo scoring + checks". |
| D-3 | (no mencionado) | **4 arrays `Category[]` omiten `social` en silencio** — TypeScript no exige exhaustividad en arrays. Ninguna suite falla. Ver tabla "Omisiones silenciosas". | Riesgo latente serio para Phase 30: `packages/report-model/src/build.ts:243-249` siembra los buckets de `issuesByCategory` desde `CATEGORY_ORDER` y descarta con `if (bucket)` cualquier issue de categoría no listada. Si no se agrega `social` ahí, **los issues sociales de Phase 30 se pierden en silencio** del acordeón del reporte y del PPTX. |
| D-4 | (no mencionado) | **`packages/cms-adapters` referencia `"ONPAGE-05"` en 5 archivos**, incluido `SUPPORTED_CHECK_IDS` (`types.ts:37-47`) y un test de cobertura que asserta exactamente `5 labels × 10 checkIds = 50` (`coverage.test.ts:46`). | **Recomendación: NO tocar `cms-adapters` en esta fase.** Las filas `Issue` históricas con `checkId="ONPAGE-05"` siguen resolviendo su copy de CMS en tiempo de lectura vía `resolveCmsRecommendation` dentro de `buildReportModel`. Quitar la entrada degradaría reportes ya emitidos. Es la lectura correcta de la decisión "no tocar historial". |
| D-5 | "El loop de agregación en `apps/worker/src/index.ts` … `social` fluye automáticamente sin tocar ese loop" | **Correcto, confirmado.** Líneas exactas: `572` (declaración del `Map<Category, …>`), `574` (`if (row.category === "perf") continue`), `581-585` (segundo loop, con un `if (category === "perf") continue` redundante), `587` (`scoreOverall`). Es blacklist, no whitelist. | Cero cambios en el worker. Confirmado por typecheck limpio de `@auditor/worker` con `social` agregado. |
| D-6 | "`categoryScores.social` queda `undefined` y `scoreOverall` renormaliza automáticamente" | **Correcto, confirmado.** Ningún issue emite `category: "social"` hoy, así que la clave nunca entra al `Map` y `present` (`overallScore.ts:84`) la excluye. `totalWeight` da 0.90 y la división renormaliza. No hay `NaN`, no hay 0, no hay `scoreCategory([])`→100 espurio. | Sin código adicional. Pero ver Pitfall 2: sí hay un efecto visible si se agrega `social` a los `CATEGORY_ORDER` de presentación. |
| D-7 | Líneas del worker "~562-590" / "~572-585" | Exactas: 572-587. La afirmación era aproximada pero correcta. | Usar líneas exactas en el plan. |

## Summary

Esta fase es un refactor de tipos y constantes de altísima confianza técnica: cero dependencias nuevas, cero I/O nuevo, cero cambios de esquema de base de datos (`Issue.category` es `String` en Prisma, no un enum — `packages/db/prisma/schema.prisma:149`; y `IssueDraft.category` es `string`, no `Category`, en `packages/checks/src/types.ts:25`). El union `Category` vive en un único archivo y su rebalanceo aritmético ya está protegido por un test existente. El retiro de ONPAGE-05 es igual de acotado: un archivo de implementación sin test propio, más tres referencias en un barrel plano.

El riesgo real de la fase no está en lo que CONTEXT.md identificó, sino en lo que no identificó. Ampliar el union `Category` tiene un fan-out de compilación de 3 sitios (`Record<Category, …>` no parcial), y un fan-out **silencioso** de 4 sitios más (arrays `Category[]` que TypeScript no obliga a ser exhaustivos). Ejecuté `pnpm typecheck --continue` y `pnpm test --continue` con el cambio aplicado y luego reverti: el typecheck falla en 3 lugares exactos, y la única suite que falla es la de scoring (por la suma 1.1 intencional del experimento). Es decir, **las 4 omisiones silenciosas no las detecta ni el compilador ni ningún test hoy**. La más peligrosa es `packages/report-model/src/build.ts:243`, que siembra los buckets de `issuesByCategory` desde su propio `CATEGORY_ORDER` y descarta issues de categorías no listadas con `if (bucket)`: si Phase 29 no agrega `"social"` ahí, Phase 30 va a emitir checks sociales correctos que desaparecen del reporte sin ningún error.

La segunda consecuencia no cubierta es el ruido del diff. `diffIssues` compara por fingerprint, y `pageFingerprint("ONPAGE-05", url)` emite **un issue por página, siempre** (severidad `ok`, `warning` o `warning`, nunca cero filas). Al retirar el check, la primera auditoría v1.6 de cualquier sitio ya auditado va a producir hasta 500 fingerprints en `diff.resolvedFingerprints`, que `buildReportModel` hidrata sin cap (`build.ts:218-225`) y la UI renderiza sin cap (`apps/web/app/audits/[id]/page.tsx:240-251`) como una lista de hasta 500 filas "Resuelto — Open Graph completo". Eso es una regresión visible de producto, no sólo una nota de documentación.

**Primary recommendation:** Ampliar el union `Category` y arreglar en la MISMA fase los 7 sitios de fan-out (3 que rompen compilación + 4 silenciosos), agregando un test guardarraíl de exhaustividad que convierta las omisiones silenciosas futuras en suite roja. Retirar ONPAGE-05 con el guardarraíl en `registry.test.ts` (que ya tiene el patrón exacto). No tocar `cms-adapters`. Decidir explícitamente qué hacer con `resolvedIssues` en la primera auditoría post-corte antes de cerrar la fase.

## Project Constraints (from CLAUDE.md)

| Directiva | Aplicación en Phase 29 |
|-----------|------------------------|
| Stack decidido: Next.js/Vercel + worker en contenedor | Sin cambios de infraestructura en esta fase. |
| `packages/fingerprint` y `packages/cms-adapters` desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime; único punto de contacto es el `checkId` string persistido | **Refuerza D-4:** `cms-adapters` no debe importar nada de `checks` para "saber" que ONPAGE-05 se retiró. Su catálogo se mantiene tal cual, sirviendo historial. |
| `buildReportModel` es la única fuente de verdad para reporte web + los 3 exports | Cualquier arreglo de categoría debe pasar por `packages/report-model/src/build.ts`, no por parches en la UI o en cada serializador. |
| Convención de fase: planner → plan-checker → executor → code-review + verify → commit | El plan debe cerrar con typecheck + test suite completos, no sólo del paquete tocado. |
| Todo deliverable escrito se humaniza (español neutro, sin voceo) | El comentario actualizado en `overallScore.ts` está en inglés (patrón del archivo); el label "Meta Tags / Social" en `CATEGORY_LABEL` va en español neutro, consistente con los 5 existentes. |
| `packages/db` es schema-first (`pnpm db:push`) | **No aplica:** cero cambios de esquema. `Issue.category` ya es `String`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Definición del union `Category` y pesos | `packages/scoring` (dominio puro) | — | Fuente única de verdad, sin I/O, re-exportada por `index.ts:9-17`. |
| Agregación de issues → score por categoría | `apps/worker` (proceso largo) | `packages/scoring` (función pura) | El worker sólo mapea filas; el modelo matemático vive en scoring. Blacklist de `perf` es del worker. |
| Catálogo de checks activos | `packages/checks` (registry) | — | `registry.ts:18-24` compone `pageChecks` desde los barrels por grupo. |
| Presentación / etiquetas / orden de categorías | `packages/export` + `apps/web/app/components/ui` | `packages/report-model` | Duplicación deliberada y documentada (`labels.ts:4-8`: "Copied verbatim from the on-screen report … so exports read identically to the UI, without the export package depending on the web app"). |
| Agrupamiento de issues por categoría para el reporte | `packages/report-model` (`build.ts`) | — | Única fuente para web + 3 exports (per CLAUDE.md). |
| Persistencia de `category` | `packages/db` (Prisma) | — | Columna `String` libre. Ningún enum. **Sin cambios.** |
| Copy de fix por CMS por `checkId` | `packages/cms-adapters` | — | Desacoplado por contrato; sirve historial. **Sin cambios.** |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.2 (raíz + por paquete) | Union types, `Record<K,V>` exhaustivo | Ya instalado. Es la herramienta que detecta 3 de los 7 sitios de fan-out. [VERIFIED: `package.json` raíz + `packages/scoring/package.json`] |
| Vitest | ^4.1.9 | Runner de tests unitarios | Ya instalado en `scoring`, `checks`, `export`, `report-model`, `web`. Ejecutado en esta sesión: `RUN v4.1.9`. [VERIFIED: salida real de `pnpm --filter @auditor/scoring test`] |
| Turborepo | ^2.3.0 | Orquestación de `typecheck`/`test` | `turbo.json` define `typecheck` con `dependsOn: ["^build"]` y `test` sin dependencias. [VERIFIED: `turbo.json`] |
| pnpm | 10.0.0 | Workspaces | `packageManager` en `package.json`. [VERIFIED] |

### Supporting

Ninguna. **Esta fase no instala nada.**

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Arrays `Category[]` para orden de presentación | `Record<Category, number>` de orden, o `satisfies readonly Category[]` con chequeo de exhaustividad | El `Record` daría error de compilación al agregar una categoría (deseable), pero es un refactor más ancho que esta fase. **Recomendación:** mantener los arrays y agregar un test de exhaustividad — cambio mínimo, misma protección, sin tocar la firma de 4 módulos. |
| Test de exhaustividad en runtime | Truco de tipos (`Exclude<Category, typeof CATEGORY_ORDER[number]> extends never`) | El truco de tipos falla en compilación (más temprano) pero es críptico y no cubre `apps/web` desde `packages/`. El test en runtime es legible y se puede colocar donde vive cada array. **Recomendación: test en runtime**, siguiendo el patrón que ya usa `registry.test.ts` (guardarraíl de contenido, no de tipos). |

**Installation:**

```bash
# Ninguna. Cero paquetes nuevos en Phase 29.
```

## Package Legitimacy Audit

**No aplica.** Phase 29 no instala ni actualiza ningún paquete externo. El árbol de dependencias del monorepo queda idéntico. Verificado: los archivos a tocar sólo importan de `@auditor/*` (workspace) y de `vitest`, ambos ya presentes.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Flujo del dato "category", de emisión a pantalla

```
                  ┌─────────────────────────────────────────────┐
                  │ packages/scoring/src/overallScore.ts:10     │
                  │   type Category = "tech"|"onpage"|"schema"  │
                  │                  |"perf"|"aeo"  ← + social  │
                  │   CATEGORY_WEIGHTS: Record<Category, number>│
                  └──────────────────┬──────────────────────────┘
                                     │ (tipo, re-export via index.ts)
        ┌────────────────────────────┼─────────────────────────────┐
        │                            │                             │
        ▼                            ▼                             ▼
┌───────────────────┐   ┌─────────────────────────┐   ┌────────────────────────┐
│ ESCRITURA         │   │ LECTURA (modelo)        │   │ PRESENTACIÓN           │
│ apps/worker       │   │ packages/report-model   │   │ export + apps/web      │
└───────────────────┘   └─────────────────────────┘   └────────────────────────┘
        │                            │                             │
 IssueDraft.category:string          │                             │
 (checks/src/types.ts:25)            │                             │
        │                            │                             │
        ▼                            │                             │
 registry.ts → runAllChecks          │                             │
        │                            │                             │
        ▼                            │                             │
 prisma.issue.createMany             │                             │
 (Issue.category = String)           │                             │
        │                            │                             │
        ▼                            │                             │
 index.ts:572-585                    │                             │
  Map<Category,…>                    │                             │
  BLACKLIST: perf ──────────► social pasa solo ✓                   │
        │                            │                             │
        ▼                            │                             │
 scoreCategory(issues)               │                             │
        │                            │                             │
        ▼                            │                             │
 scoreOverall() ──► renormaliza si   │                             │
   la categoría falta (:84-92)       │                             │
        │                            │                             │
        ▼                            │                             │
 Audit.scores JSON ─────────────────►│                             │
                                     ▼                             │
                       build.ts:25  CATEGORY_ORDER ◄── ⚠ ARRAY     │
                       build.ts:243 issuesByCategory                │
                         Object.fromEntries(CATEGORY_ORDER…)        │
                       build.ts:247 if (bucket) push  ◄── ⚠ DESCARTA│
                                     │                              │
                                     ├──────────────────────────────┤
                                     ▼                              ▼
                       ReportModel.issuesByCategory      CATEGORY_LABEL (×2)
                       ReportModel.byCategory            CATEGORY_ORDER (×2)
                                     │                              │
                    ┌────────────────┼──────────────┬───────────────┤
                    ▼                ▼              ▼               ▼
              apps/web page.tsx  markdown.ts     pdf.tsx        pptx.ts
              (CATEGORY_ORDER)   (:44 loop)    (:185 loop)    (:477 chart,
                                                               :336 flat())
```

Leyenda de riesgo: `⚠ ARRAY` = TypeScript no exige exhaustividad; `⚠ DESCARTA` = issues de categoría no listada se pierden sin error.

### Fan-out de compilación (rompe el build — TypeScript los detecta)

Ejecutado empíricamente: `pnpm typecheck --continue` con `Category` ampliado. Resultado: `14 successful, 16 total; Failed: @auditor/export#typecheck, @auditor/web#typecheck`.

| # | Archivo:línea | Construcción | Error exacto |
|---|---------------|--------------|--------------|
| C-1 | `packages/scoring/src/overallScore.ts:23` | `CATEGORY_WEIGHTS: Record<Category, number>` | (esperado — es el cambio intencional) |
| C-2 | `packages/export/src/labels.ts:12` | `CATEGORY_LABEL: Record<Category, string>` | `TS2741: Property 'social' is missing in type '{ tech: string; perf: string; onpage: string; schema: string; aeo: string; }' but required in type 'Record<Category, string>'.` |
| C-3 | `apps/web/app/components/ui/labels.ts:10` | `CATEGORY_LABEL: Record<Category, string>` | `TS2741` idéntico |
| C-4 | `apps/web/tests/pages/api/audits/[id]/export.test.ts:82` | `emptyByCat` asignado a `issuesByCategory: Record<Category, ReportIssue[]>` | `TS2741: Property 'social' is missing … but required in type 'Record<Category, ReportIssue[]>'` |

[VERIFIED: ejecución real de `pnpm typecheck --continue`, salida transcrita]

### Omisiones silenciosas (NO rompen el build ni ningún test)

Ejecutado empíricamente: `pnpm test --continue` con `Category` ampliado. Resultado: **sólo falló `@auditor/scoring`** (por la suma 1.1 del experimento). Los 12 paquetes restantes pasaron verde, incluidos `report-model` (4 archivos), `export` (5) y `web` (9).

| # | Archivo:línea | Construcción | Consecuencia si se omite |
|---|---------------|--------------|--------------------------|
| S-1 | `packages/report-model/src/build.ts:25` | `const CATEGORY_ORDER: Category[]` | **La más grave.** Siembra los buckets en `:243-245`; el loop `:246-249` hace `const bucket = issuesByCategory[…]; if (bucket) bucket.push(…)`. Sin `social` en el array, **todo issue social de Phase 30 se descarta en silencio** del acordeón por categoría del reporte y de `pptx.ts:336` (`Object.values(model.issuesByCategory).flat()`). |
| S-2 | `packages/export/src/labels.ts:10` | `export const CATEGORY_ORDER: Category[]` | La categoría social no aparece en markdown (`markdown.ts:44`), PDF (`pdf.tsx:185`) ni en el gráfico del PPTX (`pptx.ts:477-478`). También afecta el orden de prioridad (`priority.ts:25-26`: `indexOf` → `-1` → va al final). |
| S-3 | `apps/web/app/audits/[id]/page.tsx:40` | `const CATEGORY_ORDER: Category[]` | Sin tarjeta de score social (`:200-206`) ni sección de detalle social (`:347-358`) en el reporte en pantalla. |
| S-4 | `packages/export/src/test-fixtures.ts:44` (`CATS`) y `:68-74` (objeto literal casteado) | `const CATS: Category[]` + `{…} as Record<Category, ReportIssue[]>` | Los fixtures de export nunca ejercitan la categoría social; los tests de export dan falso verde. |

**Insight clave:** los 4 casos son arrays o casts `as`, y TypeScript no exige exhaustividad en ninguno de los dos. El compilador no ayuda aquí. La única protección posible es un test de exhaustividad en runtime.

### Pattern 1: Guardarraíl de contenido del registry (patrón establecido del proyecto)

**What:** Test que asserta QUÉ contiene una colección de producción, no sólo cómo se comporta cada elemento en aislamiento.
**When to use:** Cuando un defecto de registro (agregar/quitar a medias) pasaría desapercibido porque los tests unitarios siguen verdes.
**Example (existente, a extender — `packages/checks/src/registry.test.ts:27-38`):**

```typescript
// Source: packages/checks/src/registry.test.ts (código real del repo)
describe("registry — pageChecks", () => {
  it("incluye los dos checks de performance por página", () => {
    const registered = pageChecks.map((c) => c.checkId);
    for (const id of PERF_CHECK_IDS) {
      expect(registered).toContain(id);
    }
  });

  it("no tiene checkIds duplicados", () => {
    const registered = pageChecks.map((c) => c.checkId);
    expect(new Set(registered).size).toBe(registered.length);
  });
});
```

El guardarraíl de SOCIAL-09 es la forma negativa exacta de este patrón y encaja en el mismo `describe`. El comentario de cabecera del archivo ya justifica por qué existe esta clase de test — reutilizar esa justificación.

### Pattern 2: Test de exhaustividad para arrays `Category[]`

**What:** Convertir una omisión silenciosa en suite roja comparando el array de orden contra las claves de `CATEGORY_WEIGHTS` (que sí es `Record<Category, …>` y por tanto exhaustivo por compilación).
**When to use:** Para cada uno de los 4 sitios S-1..S-4.
**Example (nuevo, propuesto):**

```typescript
// Patrón propuesto — aplicar en report-model, export y apps/web
import { CATEGORY_WEIGHTS, type Category } from "@auditor/scoring";

it("CATEGORY_ORDER cubre todas las categorías del modelo de scoring", () => {
  const all = Object.keys(CATEGORY_WEIGHTS) as Category[];
  expect([...CATEGORY_ORDER].sort()).toEqual([...all].sort());
});
```

`CATEGORY_WEIGHTS` es el único objeto exhaustivo por construcción (`Record<Category, number>`), así que sirve de fuente de verdad en runtime sin necesidad de duplicar la lista.

### Anti-Patterns to Avoid

- **Agregar `"social"` sólo a `packages/scoring` y confiar en que el compilador avise:** avisa en 3 sitios y calla en 4. La cobertura del compilador es parcial y engañosa aquí.
- **Cambiar `CATEGORY_ORDER: Category[]` a `Record<Category, number>` en los 4 sitios:** obtiene exhaustividad por compilación pero cambia la firma pública de `packages/export/src/labels.ts` (consumida por `markdown.ts`, `pdf.tsx`, `pptx.ts`, `priority.ts`). Fuera de alcance para esta fase.
- **Quitar `"ONPAGE-05"` de `packages/cms-adapters`:** rompe la copy de fix por CMS de los reportes históricos, que se resuelve en tiempo de lectura. Además rompería `coverage.test.ts:46` (`expect(5 * SUPPORTED_CHECK_IDS.length).toBe(50)`).
- **Mover ONPAGE-05 a la categoría `social` en vez de eliminarlo:** ya descartado en `.planning/research/STACK.md:153` — el fingerprint incluye el `checkId`, así que recategorizarlo no evita el ruido del diff y además deja el check redundante vivo.
- **Escribir el guardarraíl de "cero duplicados por fingerprint" en esta fase:** no es verificable hasta que existan SOCIAL-01..08 (decisión lockeada en CONTEXT.md; también en `.planning/ROADMAP.md`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verificar que los pesos suman 1.0 | Un test nuevo | El test existente `overallScore.test.ts:5-10` | Ya existe y ya funciona. Duplicarlo genera ruido y dos fuentes de verdad. |
| Renormalizar el score cuando `social` no tiene datos | Lógica condicional nueva en el worker | `scoreOverall` (`overallScore.ts:84-92`) | Ya renormaliza por diseño desde Phase 6. Verificado que `social` ausente no produce `NaN` ni 0. |
| Detectar que un check quedó registrado a medias | Revisión manual / grep en code review | Guardarraíl en `registry.test.ts` | El patrón ya existe en el repo con justificación escrita. |
| Enumerar categorías en runtime | Una constante nueva `ALL_CATEGORIES` | `Object.keys(CATEGORY_WEIGHTS)` | `CATEGORY_WEIGHTS` es exhaustivo por tipo (`Record<Category, number>`); una constante paralela sería un cuarto sitio que puede desincronizarse. |

**Key insight:** el proyecto ya tiene todos los mecanismos de protección que esta fase necesita. El trabajo es *aplicarlos a los sitios que hoy no los tienen*, no inventar mecanismos nuevos.

## Runtime State Inventory

> Fase de retiro/refactor. Las 5 categorías se responden explícitamente.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Filas `Issue` con `checkId="ONPAGE-05"` y `category="onpage"` en Postgres (`shared-postgres`/`auditor`), ~1 fila por página auditada por auditoría (el check emite SIEMPRE, con severidad `ok` o `warning` — nunca cero filas). También quedan dentro de `Audit.scores.byCategory.onpage` y de `Audit.scores.diff.resolvedFingerprints` de corridas previas. | **Ninguna** — decisión lockeada de "corte de versión", sin migración. Pero ver Pitfall 4: el efecto en el diff de la siguiente corrida es visible en la UI. |
| **Live service config** | Ninguna. Verificado: esta fase no toca n8n, ni webhooks, ni configuración externa. Cero servicios de terceros involucrados. | Ninguna. |
| **OS-registered state** | Ninguna. Verificado: no hay tareas programadas, procesos pm2 ni unidades systemd que referencien `ONPAGE-05` ni nombres de categoría (grep de `ONPAGE-05` en todo el repo devolvió sólo `packages/cms-adapters` (5), `packages/checks` (4) y `.planning/`). | Ninguna. |
| **Secrets / env vars** | Ninguna. Ni `Category` ni `ONPAGE-05` aparecen en variables de entorno ni en configuración de despliegue. | Ninguna. |
| **Build artifacts / installed packages** | Ninguno. Cambio puro de TypeScript sin build step de librería (los paquetes exportan `./src/index.ts` directamente — `"main": "./src/index.ts"` en `packages/scoring/package.json`). Sí conviene invalidar la caché de Turborepo si un typecheck queda cacheado en verde de antes. | `pnpm typecheck` y `pnpm test` completos tras el cambio (no sólo `--filter`). |

**Nota sobre esquema de base de datos:** ninguna. `Issue.category` es `String` en `packages/db/prisma/schema.prisma:149` y no existe un enum de categorías (los únicos enums son `AuditStatus` y `IssueSeverity`, líneas 10 y 17). **No se requiere `pnpm db:push`** en esta fase — a diferencia de Phase 28. [VERIFIED: lectura del schema]

## Common Pitfalls

### Pitfall 1: El compilador da una falsa sensación de cobertura

**What goes wrong:** Se agrega `"social"`, se arreglan los 3 errores de compilación, todo pasa verde, y se cierra la fase. Cuatro sitios quedaron silenciosamente incompletos.
**Why it happens:** `Record<Category, T>` exige exhaustividad; `Category[]` no. El código base mezcla ambos para el mismo concepto.
**How to avoid:** Tratar los 7 sitios como una sola unidad de trabajo. Agregar el test de exhaustividad del Pattern 2 en cada paquete que tenga un `CATEGORY_ORDER`.
**Warning signs:** Un plan cuya lista de archivos a tocar tiene 3 entradas de presentación en vez de 4 (o ninguna).

### Pitfall 2: Mostrar "Meta Tags / Social: 0" antes de que existan los checks

**What goes wrong:** Si se agrega `"social"` a `CATEGORY_ORDER` de presentación en Phase 29, entre Phase 29 y Phase 30 el reporte muestra una categoría vacía. Comportamiento exacto verificado por lectura:
- `apps/web/app/audits/[id]/page.tsx:200-206` — renderiza la tarjeta; `byCategory.social` es `undefined`.
- `packages/export/src/pptx.ts:478` — `model.byCategory[c]?.score ?? 0` → grafica **0**.
- `packages/export/src/pptx.ts:503-506` — la lista en `missing` y anota *"Sin datos: Meta Tags / Social (se muestran como 0)."*
- `packages/export/src/markdown.ts:51` — imprime `- **Meta Tags / Social:** sin datos`.
- `packages/export/src/pdf.tsx:185-189` — depende del guard interno del `.map`; verificar antes de asumir.

**Why it happens:** los serializadores ya manejan "categoría sin datos", pero lo hacen mostrándola, no ocultándola.
**How to avoid:** decisión explícita del planner entre dos opciones coherentes:
- **(A) Agregar todo en Phase 29** (`CATEGORY_LABEL` + `CATEGORY_ORDER` en los 4 sitios). Ventaja: Phase 30 no arrastra deuda ni riesgo de descarte silencioso. Costo: una categoría visiblemente vacía durante una fase.
- **(B) Agregar sólo `CATEGORY_LABEL`** (obligatorio, rompe compilación) **y diferir `CATEGORY_ORDER` a Phase 30**. Ventaja: sin artefacto visual. Costo: Phase 30 hereda el riesgo de S-1 (descarte silencioso), que es exactamente el fallo más difícil de detectar.
**Recomendación:** **(A)**, porque el costo es cosmético y temporal (una fase, sin UI de por medio según el ROADMAP) mientras que el costo de (B) es un modo de fallo silencioso. Si Juan prefiere (B), el plan de Phase 30 debe abrir con la tarea de `CATEGORY_ORDER` antes de escribir cualquier check.
**Warning signs:** cualquier plan que toque `CATEGORY_LABEL` sin decidir explícitamente sobre `CATEGORY_ORDER`.

### Pitfall 3: Duplicar el test de suma de pesos

**What goes wrong:** El plan crea `it("suman 1.0")` cuando ya existe en `overallScore.test.ts:5-10`.
**Why it happens:** CONTEXT.md lo pide como si no existiera (decisión tomada sin leer el archivo de test).
**How to avoid:** La tarea correcta es "confirmar que el test existente pasa con los pesos nuevos" y, opcionalmente, endurecerlo (asserts explícitos de los 6 valores individuales, no sólo de la suma — hoy un plan que ponga onpage .05 y schema .10 pasaría igual).
**Warning signs:** dos bloques `describe("CATEGORY_WEIGHTS")` en el mismo archivo.

### Pitfall 4: La primera auditoría post-corte muestra cientos de falsos "Resueltos"

**What goes wrong:** `ONPAGE-05` emite **una fila por página siempre** (verificado: las 3 ramas de `openGraph.ts` retornan un issue; ninguna retorna `[]`). Al retirar el check, `diffIssues` (`packages/scoring/src/diff.ts:39`) marca cada uno de esos fingerprints como `resolved`. Cadena completa:
1. `apps/worker/src/index.ts` persiste `scores.diff.resolvedFingerprints` con hasta 500 entradas.
2. `packages/report-model/src/build.ts:218-225` los hidrata con `prisma.issue.findMany({ fingerprint: { in: […] } })` — **sin `take`**, IN clause de hasta 500 elementos.
3. `apps/web/app/audits/[id]/page.tsx:240-251` renderiza `resolvedIssues.map(…)` — **sin cap**, una fila por cada uno.

Resultado: un sitio de 500 páginas re-auditado muestra hasta 500 filas "Resuelto — On-Page — Open Graph completo". El contador `diff.resolvedCount` (`page.tsx:236`) muestra ese número. Es un falso positivo de producto: el usuario no arregló nada.
**Why it happens:** el diff por fingerprint no distingue "el usuario lo arregló" de "el catálogo de checks cambió".
**How to avoid:** decisión de producto requerida (ver Open Questions Q1). Opciones no excluyentes: (a) sólo documentar el corte de versión (mínimo que exige SOCIAL-09 criterio #3); (b) capar `resolvedIssues` en la UI/modelo; (c) filtrar del diff los fingerprints cuyo `checkId` ya no está en el catálogo activo.
**Warning signs:** que el plan cierre SOCIAL-09 con una sola línea de documentación sin mencionar `resolvedIssues`.

### Pitfall 5: Asumir que hay que tocar la base de datos

**What goes wrong:** Se agenda un `pnpm db:push` por analogía con Phase 28.
**Why it happens:** la convención del proyecto (STATE.md) dice que hay que correr `db:push` cuando el worker escribe una columna nueva. Aquí no hay columna nueva.
**How to avoid:** `Issue.category` es `String` libre y `IssueDraft.category` es `string`. Cero cambios de esquema. [VERIFIED: `schema.prisma:149`, `checks/src/types.ts:25`]
**Warning signs:** una tarea de migración en el plan.

### Pitfall 6: Turborepo cachea el typecheck en verde

**What goes wrong:** `pnpm typecheck` devuelve `FULL TURBO` de una corrida anterior y no detecta los errores nuevos.
**Why it happens:** `turbo.json` define `typecheck` con `outputs: []` y caché habilitada.
**How to avoid:** usar `pnpm typecheck --continue` (además de ver todos los fallos, no sólo el primero) y confirmar que la salida dice `16 total`, no `FULL TURBO`. En caso de duda, `--force`.
**Warning signs:** typecheck que termina en milisegundos tras editar `overallScore.ts`.

## Code Examples

### Estado actual de `Category` y `CATEGORY_WEIGHTS`

```typescript
// Source: packages/scoring/src/overallScore.ts:4-29 (código real, HEAD actual)
/**
 * The five report categories (mirrors the reference report: SEO Técnico,
 * On-Page, Datos Estructurados, Rendimiento/CWV, AEO). `perf` is scored
 * separately from PerfMetric (PSI), never from Issues — see
 * `scorePerfCategory` below.
 */
export type Category = "tech" | "onpage" | "schema" | "perf" | "aeo";

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  tech: 0.3,
  perf: 0.3,
  onpage: 0.15,
  schema: 0.1,
  aeo: 0.15,
};
```

Objetivo tras SCORE-01/02 (suma verificada = 1.00):

```typescript
export type Category = "tech" | "onpage" | "schema" | "perf" | "aeo" | "social";

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  tech: 0.3,
  perf: 0.3,
  onpage: 0.1,   // .15 → .10 (SCORE-02, cede peso a social)
  schema: 0.05,  // .10 → .05 (SCORE-02, cede peso a social)
  aeo: 0.15,
  social: 0.1,   // SCORE-01 (nuevo)
};
```

También hay que actualizar el comentario de `scoreOverall` (`overallScore.ts:66-70`), que dice literalmente *"weighted average of the five category scores"* y *"the four Issue-derived categories (tech/onpage/schema/aeo)"* — ambas frases quedan desactualizadas y CONTEXT.md sólo menciona el comentario de `Category`.

### El barrel de on-page a modificar

```typescript
// Source: packages/checks/src/checks/onpage/index.ts (código real)
// Hay TRES referencias a openGraphCheck: import (:6), array (:16), export (:27).
import { openGraphCheck } from "./openGraph";            // ← eliminar

export const onPageChecks: PageCheck[] = [
  titleCheck, metaDescriptionCheck, h1Check, altTextCheck,
  openGraphCheck,                                        // ← eliminar
  contentLengthCheck, langCheck, headingsCheck,
];

export {
  titleCheck, metaDescriptionCheck, h1Check, altTextCheck,
  openGraphCheck,                                        // ← eliminar
  contentLengthCheck, langCheck, headingsCheck,
};
```

`packages/checks/src/registry.ts:19` sólo importa `onPageChecks` como array (no cada check individual), así que quitarlo de estos tres puntos lo retira del catálogo global. **Confirmado: no existe `openGraph.test.ts`** — el directorio `onpage/` tiene tests sólo para `altText`, `h1`, `headings`, `metaDescription` y `title`. No hay test huérfano que borrar.

### El agregador del worker (sin cambios, para referencia del plan)

```typescript
// Source: apps/worker/src/index.ts:572-585 (código real)
const issuesByCategory = new Map<Category, { severity: "critical" | "warning" | "ok" }[]>();
for (const row of issueRows) {
  if (row.category === "perf") continue;   // BLACKLIST — social pasa solo ✓
  const category = row.category as Category;
  const bucket = issuesByCategory.get(category) ?? [];
  bucket.push({ severity: row.severity });
  issuesByCategory.set(category, bucket);
}
```

### El descarte silencioso a corregir (S-1)

```typescript
// Source: packages/report-model/src/build.ts:243-249 (código real)
const issuesByCategory = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [c, [] as ReportIssue[]])
) as Record<Category, ReportIssue[]>;
for (const issue of issuesForDetail as unknown as IssueRow[]) {
  const bucket = issuesByCategory[issue.category as Category];
  if (bucket) bucket.push(toReportIssue(issue, rawStack));  // ← sin bucket: DESCARTA
}
```

Nótese que el `as Record<Category, ReportIssue[]>` es un cast mentiroso: el tipo promete todas las claves, el runtime sólo entrega las de `CATEGORY_ORDER`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5 categorías (`tech`/`perf`/`onpage`/`schema`/`aeo`) | 6, con `social` | Phase 29 (v1.6) | Scores pre/post v1.6 no directamente comparables (SCORE-02, criterio #3 de la fase). |
| ONPAGE-05 evalúa presencia de 4 tags OG en categoría `onpage` | Presencia + calidad de OG en categoría `social` (SOCIAL-01..08) | Phase 29 retira; Phase 30 sustituye | Ventana de una fase sin ninguna cobertura de Open Graph en el catálogo activo. Es aceptable y deliberado (ROADMAP secuencia 29 antes de 30 a propósito), pero conviene decirlo en el commit/documentación. |

**Deprecado/retirado en esta fase:**
- `packages/checks/src/checks/onpage/openGraph.ts` (`ONPAGE-05`) — absorbido por la categoría `social`. Su entrada en `packages/cms-adapters` **se mantiene** para servir reportes históricos.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `packages/export/src/pdf.tsx:185-189` maneja igual de bien una categoría sin score que markdown y pptx | Pitfall 2 | Leí las líneas del `.map` pero no el guard interno completo del componente. Si no tiene guard, agregar `social` a `CATEGORY_ORDER` podría romper el render del PDF. **El plan debe hacer que el executor lea `pdf.tsx:180-200` antes de tocar `CATEGORY_ORDER`.** Contexto agravante: ya hay un bug abierto de export PDF en Deferred Items (`pdf-export-crash-reading-s`). |
| A2 | Ninguna auditoría en producción supera hoy las ~500 páginas, así que el peor caso de "falsos resueltos" es ~500 filas | Pitfall 4 | Si un sitio auditado tiene menos páginas, el impacto es menor y la opción (a) "sólo documentar" basta. No verifiqué el conteo real en la base de producción. |
| A3 | La etiqueta en español para la categoría será "Meta Tags / Social" | Pitfall 2, Code Examples | Es el nombre que usan ROADMAP y REQUIREMENTS para el milestone, pero no está lockeado como copy de UI en CONTEXT.md. Al ser una decisión de copy visible, conviene confirmarla con Juan (o dejarla explícita en el plan). Alternativas plausibles: "Social / Open Graph", "Meta Tags Sociales". |

## Open Questions (RESOLVED)

1. **¿Qué hacer con los falsos "Resueltos" de la primera auditoría post-corte?** (Pitfall 4)
   - Lo que sabemos: `ONPAGE-05` emitía 1 issue por página siempre; `diffIssues` los marcará todos como `resolved`; ni `build.ts:218-225` ni `page.tsx:240-251` tienen cap.
   - Lo que no está claro: si SOCIAL-09 criterio #3 ("documentado como corte de versión") pretendía cubrir esto o sólo la comparabilidad de scores.
   - Recomendación: mínimo, documentarlo (cumple el criterio literal). Ideal, agregar en el plan una tarea de cap/nota en la UI — o registrarlo como deuda explícita para Phase 32 (que sí tiene UI). **Decisión de Juan.**
   - **(RESUELTO — orquestador, 2026-08-01): documentar, no capar.** La fase 29 no agrega lógica de cap ni de filtrado sobre `resolvedIssues`, ni en `packages/report-model/src/build.ts` ni en la página de reporte. La consecuencia queda escrita en tres lugares: el docblock de `packages/checks/src/registry.test.ts` (plan 29-02, tarea 1), la fila de Key Decisions de `.planning/PROJECT.md` (plan 29-04, tarea 1) y la prohibición registrada en `must_haves` del plan 29-04. Capar o filtrar es alcance de producto de una fase con UI y queda como deuda conocida para Phase 32; está registrado como `T-29-05` (Information Disclosure, severidad low, disposición accept) en el threat model del plan 29-04.

2. **¿Agregar `"social"` a los `CATEGORY_ORDER` de presentación en Phase 29 (opción A) o diferirlo a Phase 30 (opción B)?** (Pitfall 2)
   - Lo que sabemos: A produce una categoría visiblemente vacía durante una fase; B hereda a Phase 30 el riesgo de descarte silencioso de S-1.
   - Recomendación: **A**, con el test de exhaustividad del Pattern 2 para que nunca vuelva a poder omitirse.
   - **(RESUELTO — orquestador, 2026-08-01): opción A.** La categoría entra en los `CATEGORY_ORDER` de presentación ya en la fase 29. Los cuatro sitios (S-1..S-4) se cierran entre el plan 29-01 (tarea 1: `build.ts` y `export/src/labels.ts`, que además rompen compilación) y el plan 29-03 (tarea 1: fixtures de export; tarea 2: `apps/web`), y cada paquete que declara un orden de categorías queda cubierto por un test de exhaustividad en runtime contra `Object.keys(CATEGORY_WEIGHTS)`. La categoría visiblemente vacía durante una fase es un estado conocido y aceptado, no un defecto: markdown y PDF la imprimen como "sin datos" y el PPTX la grafica como 0 con su nota de ausencia.

3. **¿Se confirma el peso 0.10 para `social`?**
   - `.planning/STATE.md:111` lo marcaba como *"punto de partida, no valor calibrado — requiere confirmación explícita de Juan durante la planeación de Phase 29"*.
   - CONTEXT.md (2026-08-01) ya lockea onpage .10 / schema .05 / social .10 como decisión.
   - **Considero este gap CERRADO** por CONTEXT.md. Se anota sólo para que el planner no lo reabra.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Todo el monorepo (`engines: >=20`) | ✓ | (runtime local, `pnpm` corrió sin error) | — |
| pnpm | Workspaces | ✓ | 10.0.0 (`packageManager`) | — |
| Turborepo | `typecheck`/`test` | ✓ | ^2.3.0 | ejecutar por paquete con `--filter` |
| Vitest | Tests | ✓ | 4.1.9 (confirmado en la salida real del runner) | — |
| TypeScript | typecheck | ✓ | ^5.7.2 | — |
| PostgreSQL | **No requerido en esta fase** | n/a | — | Todos los tests relevantes mockean Prisma (`report-model/src/build.test.ts` usa `auditFindUnique`/`issueFindMany` mockeados). |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** ninguna.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | Ninguno en `packages/scoring` ni `packages/checks` (defaults). Sí existen en `packages/export/vitest.config.ts`, `packages/report-model/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Convención de ubicación | Test colocado junto al fuente: `src/<modulo>.test.ts` |
| Quick run command | `pnpm --filter @auditor/scoring test` (150ms, 3 archivos / 25 tests) |
| Full suite command | `pnpm test --continue` (13 tareas de test en el monorepo) |
| Typecheck command | `pnpm typecheck --continue` (16 tareas) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | `Category` incluye `"social"` y `CATEGORY_WEIGHTS.social` está definido | unit | `pnpm --filter @auditor/scoring test` | ⚠️ Extender `packages/scoring/src/overallScore.test.ts` |
| SCORE-02 | Los 6 pesos suman 1.0 | unit | `pnpm --filter @auditor/scoring test` | ✅ Existe (`overallScore.test.ts:5-10`) — **no duplicar** |
| SCORE-02 | Valores individuales exactos (onpage .10, schema .05, social .10) | unit | `pnpm --filter @auditor/scoring test` | ❌ Wave 0 — hoy la suma pasaría con onpage .05/schema .10 invertidos |
| SCORE-01 | `scoreOverall` renormaliza correctamente sin datos de `social` | unit | `pnpm --filter @auditor/scoring test` | ❌ Wave 0 — hay un test análogo para `perf` (`:40-49`) que sirve de plantilla |
| SCORE-01 | `CATEGORY_ORDER` cubre todas las claves de `CATEGORY_WEIGHTS` (×3 paquetes) | unit | `pnpm --filter @auditor/export test`, `... @auditor/report-model test`, `... @auditor/web test` | ❌ Wave 0 — protección contra S-1..S-4 |
| SOCIAL-09 | `pageChecks` no contiene ningún check con `checkId === "ONPAGE-05"` | unit | `pnpm --filter @auditor/checks test` | ⚠️ Extender `packages/checks/src/registry.test.ts` (patrón ya presente) |
| SOCIAL-09 | `runAllChecks` no emite ningún `IssueDraft` con `checkId === "ONPAGE-05"` de punta a punta | integration | `pnpm --filter @auditor/checks test` | ⚠️ Extender `registry.test.ts` (patrón `runAllChecks` ya presente en `:40-83`) |
| SOCIAL-09 | Compilación completa tras eliminar el archivo | typecheck | `pnpm typecheck --continue` | ✅ Infra existente |

### Sampling Rate

- **Per task commit:** `pnpm --filter <paquete-tocado> test` + `pnpm --filter <paquete-tocado> typecheck`
- **Per wave merge:** `pnpm typecheck --continue` (obligatorio — es el único mecanismo que detecta C-2/C-3/C-4) + `pnpm test --continue`
- **Phase gate:** ambos comandos completos en verde, con `16 total` / `13 total` visibles (no `FULL TURBO` cacheado)

### Wave 0 Gaps

- [ ] Extender `packages/scoring/src/overallScore.test.ts` — asserts de valores individuales de peso + renormalización sin `social` (SCORE-01/02)
- [ ] Extender `packages/checks/src/registry.test.ts` — guardarraíl negativo de `ONPAGE-05` (SOCIAL-09)
- [ ] Test de exhaustividad de `CATEGORY_ORDER` en `packages/report-model` (crítico — cubre S-1)
- [ ] Test de exhaustividad de `CATEGORY_ORDER` en `packages/export` (cubre S-2 y S-4)
- [ ] Test de exhaustividad de `CATEGORY_ORDER` en `apps/web` (cubre S-3)
- [ ] Ningún framework nuevo a instalar; ninguna fixture compartida nueva necesaria

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | La fase no toca autenticación, verificación de email ni tokens. |
| V3 Session Management | no | Sin sesiones involucradas. |
| V4 Access Control | no | Sin rutas nuevas ni cambios de autorización. |
| V5 Input Validation | no | Ninguna entrada de usuario nueva. `Category` es un tipo interno; `Issue.category` se escribe desde el catálogo de checks, nunca desde entrada externa. |
| V6 Cryptography | no | El `fingerprint` existente no se modifica (`pageFingerprint` sigue igual; sólo desaparece un `checkId` que lo alimentaba). |
| V7 Error Handling & Logging | no | Sin cambios en manejo de errores. |
| V8 Data Protection | parcial | La fase NO modifica datos persistidos (decisión lockeada: sin migración). El único contacto con datos históricos es de lectura (`resolvedFingerprints`). Confirmado que ninguna columna con PII entra al alcance. |
| V13 API | no | Sin endpoints nuevos. `apps/web/app/api/audits/[id]/route.ts:49-53` construye `issuesByCategory` dinámicamente desde un `groupBy` — soporta `social` sin cambios y sin superficie nueva. |

### Known Threat Patterns for TypeScript monorepo / refactor de constantes

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corrupción silenciosa de integridad de datos por descarte no observado (S-1: issues de una categoría no listada se pierden sin error) | Tampering (no adversarial, por defecto de diseño) | Test de exhaustividad en runtime (Pattern 2) + revisión del `if (bucket)` |
| Consulta sin cota (`fingerprint: { in: [...500] }` en `build.ts:222` y `resolvedIssues.map` sin cap en la UI) | Denial of Service (bajo — el input viene de datos propios, no de un atacante) | Cap explícito, o aceptación documentada. Escala con el tamaño del sitio auditado (máx. 500 URLs por cuota del producto), no con entrada del atacante. |
| Cast que miente sobre exhaustividad (`as Record<Category, ReportIssue[]>` en `build.ts:245` y `test-fixtures.ts:74`) | Tampering | Preferir construcción exhaustiva o cubrir con test; no agregar casts nuevos en esta fase. |

**Conclusión de seguridad:** riesgo neto de la fase = **muy bajo**. Sin entradas de usuario, sin red, sin credenciales, sin cambios de esquema, sin cambios de autorización. Los hallazgos "de seguridad" reales son de integridad de datos, ya recogidos como pitfalls.

## Sources

### Primary (HIGH confidence)

- Lectura directa del código base en HEAD (`8a18c95`):
  - `packages/scoring/src/overallScore.ts`, `categoryScore.ts`, `diff.ts`, `index.ts`, `overallScore.test.ts`
  - `packages/checks/src/registry.ts`, `registry.test.ts`, `types.ts`, `checks/onpage/index.ts`, `checks/onpage/openGraph.ts`, `checks/perf/checkIdCollision.test.ts`
  - `packages/report-model/src/build.ts`, `model.ts`, `build.test.ts`
  - `packages/export/src/labels.ts`, `pptx.ts`, `markdown.ts`, `pdf.tsx`, `priority.ts`, `test-fixtures.ts`, `markdown.test.ts`
  - `packages/cms-adapters/src/types.ts`, `wordpress.ts`, `coverage.test.ts`
  - `packages/db/prisma/schema.prisma`
  - `apps/worker/src/index.ts`
  - `apps/web/app/audits/[id]/page.tsx`, `app/components/ui/labels.ts`, `app/api/audits/[id]/route.ts`, `tests/pages/api/audits/[id]/export.test.ts`
  - `package.json`, `turbo.json`, `.planning/config.json`
- **Ejecución empírica en esta sesión** (cambio aplicado y revertido; `git status` confirma árbol limpio en `packages/scoring`):
  - `pnpm typecheck --continue` con `Category` ampliado → 3 errores exactos, transcritos verbatim
  - `pnpm test --continue` con `Category` ampliado → sólo falla `@auditor/scoring`; los otros 12 paquetes verdes (prueba de la ceguera de las omisiones silenciosas)
  - `pnpm --filter @auditor/scoring test` tras revertir → `Test Files 3 passed (3) / Tests 25 passed (25)`

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md`, `FEATURES.md`, `SUMMARY.md`, `PITFALLS.md` (research de milestone v1.6) — contexto de decisión sobre el destino de ONPAGE-05. Nota: `STACK.md:97` recomendaba **mantener** ONPAGE-05; `FEATURES.md:99` y `SUMMARY.md:65` recomendaban **retirarlo**. El roadmap y CONTEXT.md resolvieron a favor del retiro. Sin contradicción pendiente.
- `.planning/ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` — alcance y requisitos.

### Tertiary (LOW confidence)

- Ninguna. **No se consultó documentación externa ni se hicieron búsquedas web**: la fase no introduce ninguna librería, API ni patrón externo. Todo el conocimiento necesario es interno al repositorio y fue verificado por lectura y ejecución. Buscar documentación de terceros habría sido ruido.

## Metadata

**Confidence breakdown:**

- Ubicación del cambio (`Category`/`CATEGORY_WEIGHTS`): **HIGH** — archivo único, leído completo.
- Fan-out de compilación (3 sitios): **HIGH** — typecheck ejecutado, errores transcritos verbatim.
- Omisiones silenciosas (4 sitios): **HIGH** — suite completa ejecutada, confirmado que pasa verde sin cubrirlas.
- Retiro de ONPAGE-05: **HIGH** — 3 referencias exactas, sin test huérfano, grep exhaustivo del repo.
- Comportamiento con categoría sin checks: **HIGH** — leído en `overallScore.ts:84-92` y confirmado por el test análogo de `perf`.
- Impacto en el diff (`resolvedIssues`): **HIGH** en la mecánica (código leído punta a punta), **MEDIUM** en la magnitud real (depende del tamaño de los sitios en producción — ver A2).
- Render del PDF con categoría sin datos: **MEDIUM** — ver A1.
- Copy de la etiqueta "Meta Tags / Social": **LOW** — ver A3, decisión de producto no lockeada.

**Research date:** 2026-08-01
**Valid until:** indefinido mientras no se toque `packages/scoring/src/overallScore.ts` ni el catálogo de checks. Como es investigación de código propio (no de ecosistema externo), no caduca por el paso del tiempo — sólo por commits en los archivos listados en Sources.
