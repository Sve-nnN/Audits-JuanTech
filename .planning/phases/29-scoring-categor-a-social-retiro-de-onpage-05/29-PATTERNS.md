# Phase 29: Scoring — categoría Social + retiro de ONPAGE-05 - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 11 (8 modificados, 3 tests nuevos/extendidos)
**Analogs found:** 11 / 11 (esta fase es 100% intra-repo: cada archivo a tocar YA existe y es su propio mejor análogo)

## Nota de encuadre

Fase de refactor, no de creación. Casi ningún archivo es nuevo: se modifican constantes existentes. Por eso el "análogo" de cada archivo suele ser (a) el propio archivo en HEAD (patrón a preservar al editar) o (b) el archivo gemelo que ya resolvió el mismo problema (ej. `apps/web/app/components/ui/labels.ts` es el gemelo verbatim de `packages/export/src/labels.ts`). Los únicos artefactos genuinamente nuevos son 3 tests de exhaustividad, y para esos sí hay un patrón de referencia claro en el repo.

## File Classification

| Archivo a crear/modificar | Rol | Data flow | Análogo más cercano | Calidad |
|---------------------------|-----|-----------|---------------------|---------|
| `packages/scoring/src/overallScore.ts` (MOD) | model / domain constant | transform (puro) | sí mismo en HEAD (`:4-29`) | exact |
| `packages/checks/src/checks/onpage/index.ts` (MOD) | registry barrel | batch | `packages/checks/src/checks/tech/index.ts` (mismo patrón array + named exports) | exact |
| `packages/checks/src/checks/onpage/openGraph.ts` (DELETE) | check | transform | — (eliminación) | n/a |
| `packages/export/src/labels.ts` (MOD) | config / presentation map | transform | `apps/web/app/components/ui/labels.ts` (gemelo verbatim) | exact |
| `apps/web/app/components/ui/labels.ts` (MOD) | config / presentation map | transform | `packages/export/src/labels.ts` (gemelo verbatim) | exact |
| `packages/report-model/src/build.ts` (MOD, `CATEGORY_ORDER` :25) | model builder | transform | `TEMPLATE_ORDER` en `packages/report-model/src/template.ts` (constante de orden exportada + testeada) | role-match |
| `apps/web/app/audits/[id]/page.tsx` (MOD, `CATEGORY_ORDER` :40) | component (RSC) | request-response | `apps/web/app/components/ui/labels.ts` (destino recomendado de la constante) | role-match |
| `packages/export/src/test-fixtures.ts` (MOD, `CATS` :44 + literal :68-74) | test fixture | transform | sí mismo | exact |
| `apps/web/tests/pages/api/audits/[id]/export.test.ts` (MOD, `emptyByCat` :82) | test | request-response | sí mismo | exact |
| `packages/scoring/src/overallScore.test.ts` (EXTEND) | test | transform | sí mismo `:40-49` (test de renormalización de `perf`) | exact |
| `packages/checks/src/registry.test.ts` (EXTEND) | test | batch | sí mismo `:27-38` (guardarraíl de contenido) | exact |
| Tests de exhaustividad `CATEGORY_ORDER` ×3 (NUEVO) | test | transform | `packages/checks/src/registry.test.ts` (guardarraíl de contenido en runtime) | role-match |

## Pattern Assignments

### `packages/scoring/src/overallScore.ts` (model, transform)

**Análogo:** sí mismo en HEAD. Patrones a preservar al editar.

**Comentario de cabecera + union + Record** (`:4-29`, código real):
```typescript
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

Convenciones observadas, a mantener: comentarios de dominio en **inglés** (todo el paquete `scoring` está en inglés); el orden del objeto es cronológico de introducción, NO alfabético, y NO coincide con el orden del union (`Category` va tech/onpage/schema/perf/aeo; `CATEGORY_WEIGHTS` va tech/perf/onpage/schema/aeo) — `social` va al final en ambos; los pesos se escriben como decimales cortos (`0.1`, no `0.10`).

**Segundo comentario desactualizado a corregir** (`:66-70`, que CONTEXT.md no menciona):
```typescript
/**
 * Computes the overall score (0-100) as a weighted average of the five
 * category scores. `categoryScores` holds the four Issue-derived categories
 * (tech/onpage/schema/aeo); `perf` is supplied separately (PSI averages) and
 * scored internally via `scorePerfCategory`.
 */
```
Ambas frases ("five category scores", "four Issue-derived categories") pasan a seis / cinco.

**Renormalización — NO tocar** (`:84-92`):
```typescript
const present = (Object.keys(byCategory) as Category[]).filter((cat) => byCategory[cat] !== undefined);
const totalWeight = present.reduce((sum, cat) => sum + CATEGORY_WEIGHTS[cat], 0);
if (present.length === 0 || totalWeight === 0) {
  return { overall: 0, status: statusForScore(0), byCategory };
}
const weightedSum = present.reduce((sum, cat) => sum + byCategory[cat]!.score * CATEGORY_WEIGHTS[cat], 0);
const overall = Math.round(weightedSum / totalWeight);
```
Es la razón por la que `social` sin datos no rompe nada. Cero cambios aquí.

**Firma que hereda `social` automáticamente** (`:77`): `Partial<Record<Exclude<Category, "perf">, CategoryScoreResult>>` — al ampliar el union, `social` entra solo en el input de `scoreOverall` sin editar la firma.

---

### `packages/scoring/src/overallScore.test.ts` (test, transform)

**Análogo:** el propio archivo. Dos bloques sirven de plantilla directa.

**Guardarraíl de suma — YA EXISTE, no duplicar** (`:5-10`):
```typescript
describe("CATEGORY_WEIGHTS", () => {
  it("sums to 1.0", () => {
    const sum = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
```
La tarea es agregar un `it` hermano DENTRO de este mismo `describe` con los seis valores exactos (`toBe(0.1)` para onpage/social, `toBe(0.05)` para schema, etc.), porque hoy la suma pasaría igual con onpage y schema invertidos.

**Plantilla exacta para el test de renormalización sin `social`** (`:40-49`, patrón de `perf` a replicar):
```typescript
it("renormalizes weights when perf is unavailable", () => {
  const perfect = scoreCategory([]);
  const result = scoreOverall(
    { tech: perfect, onpage: perfect, schema: perfect, aeo: perfect },
    { mobileAvgScore: null, desktopAvgScore: null }
  );
  // perf excluded entirely; remaining 4 categories are all 100 -> still 100
  expect(result.overall).toBe(100);
  expect(result.byCategory.perf).toBeUndefined();
});
```
El test de `social` es este mismo con `byCategory.social` en vez de `.perf` y con PSI presente.

Convenciones del archivo: nombres de `it` en **inglés**; helper local `many(ok, warning, critical)` (`:55-59`) para armar sets de issues; comentarios de cálculo inline (`// 80*0.7 + 90*0.3 = 83`). Nótese que `:30` dice literalmente `"computes a weighted average across all 5 categories"` — ese texto también queda desactualizado.

---

### `packages/checks/src/checks/onpage/index.ts` (registry barrel, batch)

**Análogo:** sí mismo + los barrels gemelos `tech/index.ts`, `schema/index.ts`, `aeo/index.ts` (idéntico patrón).

**Estado actual — tres puntos de eliminación** (código real, `:1-31`):
```typescript
import { altTextCheck } from "./altText";
import { openGraphCheck } from "./openGraph";      // ← :6 eliminar
import { contentLengthCheck } from "./contentLength";

export const onPageChecks: PageCheck[] = [
  titleCheck, metaDescriptionCheck, h1Check, altTextCheck,
  openGraphCheck,                                  // ← :16 eliminar
  contentLengthCheck, langCheck, headingsCheck,
];

export {
  titleCheck, metaDescriptionCheck, h1Check, altTextCheck,
  openGraphCheck,                                  // ← :27 eliminar
  contentLengthCheck, langCheck, headingsCheck,
};
```
Patrón: import por línea (uno por check) → array plano en orden de import → re-export nombrado en el mismo orden. Quitar las 3 líneas mantiene el patrón intacto. `registry.ts:19` sólo importa `onPageChecks`, así que no hay cuarto punto.

---

### `packages/checks/src/registry.test.ts` (test, batch)

**Análogo:** sí mismo. Es el patrón de guardarraíl de contenido que RESEARCH.md señala como el correcto para SOCIAL-09.

**Justificación del archivo, reutilizable en el comentario del test nuevo** (`:5-14`):
```typescript
/**
 * Guardarraíl de contenido del registry.
 *
 * Hasta ahora ningún test verificaba QUÉ contiene `pageChecks`. Un check
 * implementado pero registrado a medias ... pasa completamente desapercibido:
 * el archivo existe, sus tests unitarios pasan en aislamiento, y el check
 * simplemente nunca corre en producción. Este archivo convierte ese defecto
 * silencioso en una suite roja.
 */
```

**Forma positiva a invertir** (`:27-38`):
```typescript
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
El guardarraíl de SOCIAL-09 es `expect(pageChecks.map((c) => c.checkId)).not.toContain("ONPAGE-05")` dentro de este mismo `describe`.

**Plantilla del guardarraíl end-to-end** (`:41-63`, para "runAllChecks no emite ONPAGE-05"):
```typescript
const { issues } = await runAllChecks({
  pages: [page],
  origin: ORIGIN,
  sitemapUrls: [],
  includeNetworkChecks: false,
});
expect(issues.filter((i) => PERF_CHECK_IDS.includes(i.checkId as never))).toEqual([]);
```
Usa `makePage({...})` de `./testUtils` (`:3`) para construir la página. Constantes en MAYÚSCULAS al tope del archivo (`ORIGIN`, `URL`, `PERF_CHECK_IDS ... as const`). Nombres de `it` en **español neutro** en este paquete (a diferencia de `scoring`).

---

### `packages/export/src/labels.ts` y `apps/web/app/components/ui/labels.ts` (config, transform)

**Análogos mutuos.** Son gemelos por diseño y el comentario de `export/labels.ts:3-8` lo documenta explícitamente:
```typescript
/**
 * Neutral-Spanish labels (sin voceo) for the export serializers. Copied
 * verbatim from the on-screen report (`apps/web/app/components/ui/labels.ts`)
 * so exports read identically to the UI, without the export package depending
 * on the web app.
 */
export const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];

export const CATEGORY_LABEL: Record<Category, string> = {
  tech: "SEO Técnico",
  perf: "Rendimiento / CWV",
  onpage: "On-Page",
  schema: "Datos Estructurados",
  aeo: "AEO (Visibilidad en IA)",
};
```

`apps/web/app/components/ui/labels.ts:10-16` tiene el objeto **verbatim idéntico** (mismo copy, mismo orden), pero NO tiene `CATEGORY_ORDER` — el de web vive en `page.tsx:40`.

**Regla de edición:** cualquier label agregado va idéntico carácter por carácter en ambos archivos. Copy en español neutro, sin voceo (ver `TEMPLATE_LABEL`, `CONFIDENCE_LABEL` en el archivo de web como muestras del registro). Etiqueta candidata (A3 de RESEARCH, no lockeada): `"Meta Tags / Social"`.

**Patrón para labels con explicación** (`apps/web/.../labels.ts:63-66`) — si `social` necesita nota, el estilo es un docblock arriba de la constante, en español, explicando el criterio semántico, no la implementación.

---

### `packages/report-model/src/build.ts` (model builder, transform) — S-1, el más grave

**Análogo:** `TEMPLATE_ORDER` en `packages/report-model/src/template.ts`, que es la constante de orden hermana y **sí se exporta** (se importa en `build.ts:19`) y tiene test propio (`template.test.ts`).

**Estado actual** (`:25`):
```typescript
const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];
```
Nótese: `const`, **no exportado** — a diferencia de `TEMPLATE_ORDER`. Para poder escribir el test de exhaustividad hay que exportarlo (patrón ya validado por `MAX_PRIORITY_ROWS` en `:23`, que sí es `export const` y vive junto a él).

**El descarte silencioso** (`:243-249`):
```typescript
const issuesByCategory = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [c, [] as ReportIssue[]])
) as Record<Category, ReportIssue[]>;
for (const issue of issuesForDetail as unknown as IssueRow[]) {
  const bucket = issuesByCategory[issue.category as Category];
  if (bucket) bucket.push(toReportIssue(issue, rawStack));
}
```
No editar la lógica (el cast `as Record<...>` miente, pero refactorizarlo está fuera de alcance). Basta agregar `"social"` al array + el test de exhaustividad.

---

### `apps/web/app/audits/[id]/page.tsx` (component RSC, request-response) — S-3

**Estado actual** (`:40`):
```typescript
const CATEGORY_ORDER: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];
```
Local al archivo de página, no exportado. **Recomendación para el planner:** mover la constante a `apps/web/app/components/ui/labels.ts` (junto a `CATEGORY_LABEL`, que es su par natural y ya es el módulo compartido de presentación de la web) e importarla en `page.tsx`. Razón: `vitest.config.ts` de web incluye `app/**/*.test.ts`, así que un `app/components/ui/labels.test.ts` puede importar la constante; en cambio, agregar un named export a un archivo de página de App Router es un antipatrón. Esto además alinea la web con `packages/export/src/labels.ts`, donde `CATEGORY_ORDER` y `CATEGORY_LABEL` ya conviven en el mismo módulo.

Patrón de constantes en el archivo (`:42-47`), a respetar si se deja algo ahí:
```typescript
/** Estado de score → variante de Badge (reusa el eje de severidad, DS-02). */
const STATUS_BADGE_VARIANT: Record<ScoreStatus, "ok" | "warning" | "critical"> = { ... };
```
Comentario de una línea con referencia al requisito entre paréntesis.

---

### `packages/export/src/test-fixtures.ts` (test fixture, transform) — S-4

**Análogo:** sí mismo. Dos sitios, ambos con la lista hardcodeada (`:44` y `:68-74`):
```typescript
const CATS: Category[] = ["tech", "perf", "onpage", "schema", "aeo"];

const issuesByCategory = {
  tech: [] as ReportIssue[],
  perf: [] as ReportIssue[],
  onpage: [] as ReportIssue[],
  schema: [] as ReportIssue[],
  aeo: [] as ReportIssue[],
} as Record<Category, ReportIssue[]>;
```
El segundo es el cast `as` que TypeScript no verifica. Alternativa de menor deuda, consistente con `build.ts:243`: derivarlo de `CATS` con `Object.fromEntries`. Decisión del planner; el mínimo es agregar `social` en ambos.

---

### Tests de exhaustividad `CATEGORY_ORDER` ×3 (NUEVO)

**Análogo de patrón:** `packages/checks/src/registry.test.ts` (guardarraíl de contenido en runtime, ver arriba). **Fuente de verdad en runtime:** `CATEGORY_WEIGHTS`, único objeto exhaustivo por construcción (`Record<Category, number>`).

**Forma canónica a replicar en los 3 paquetes:**
```typescript
import { CATEGORY_WEIGHTS, type Category } from "@auditor/scoring";

it("CATEGORY_ORDER cubre todas las categorías del modelo de scoring", () => {
  const all = Object.keys(CATEGORY_WEIGHTS) as Category[];
  expect([...CATEGORY_ORDER].sort()).toEqual([...all].sort());
});
```

Ubicación sugerida por paquete, siguiendo la convención de test colocado junto al fuente:

| Paquete | Archivo de test | Import necesario | Nota |
|---------|-----------------|------------------|------|
| `packages/report-model` | `src/build.test.ts` (ya existe, extender) | requiere `export` en `build.ts:25` | Cubre S-1 |
| `packages/export` | `src/labels.test.ts` (nuevo) o extender `priority.test.ts` | `CATEGORY_ORDER` ya se exporta | Cubre S-2; agregar también assert sobre las claves de `CATEGORY_LABEL` y sobre `CATS` de `test-fixtures.ts` (S-4) |
| `apps/web` | `app/components/ui/labels.test.ts` (nuevo) | requiere mover `CATEGORY_ORDER` desde `page.tsx` | Cubre S-3; `vitest.config.ts` incluye `app/**/*.test.ts` |

Convención de idioma en nombres de `it`: español neutro en `checks`, `export`, `report-model` y `web`; inglés sólo en `scoring`.

## Shared Patterns

### Guardarraíl de contenido en runtime
**Fuente:** `packages/checks/src/registry.test.ts:5-38`
**Aplicar a:** el test de retiro de ONPAGE-05 y los 3 tests de exhaustividad de `CATEGORY_ORDER`
Assertar QUÉ contiene una colección de producción (no cómo se comporta cada elemento aislado), con un docblock que explique qué defecto silencioso convierte en suite roja.

### Duplicación deliberada de labels UI ↔ export
**Fuente:** `packages/export/src/labels.ts:3-8`
**Aplicar a:** `packages/export/src/labels.ts` y `apps/web/app/components/ui/labels.ts`
Los dos mapas se mantienen verbatim idénticos a propósito, para que el export no dependa de la app web. Todo label nuevo entra en ambos, con el mismo copy.

### Constantes de orden exportadas + testeadas
**Fuente:** `TEMPLATE_ORDER` en `packages/report-model/src/template.ts` (importado en `build.ts:19`, cubierto por `template.test.ts`)
**Aplicar a:** `CATEGORY_ORDER` en `report-model` y en `apps/web`
El repo ya tiene el patrón "constante de orden exportada desde un módulo dedicado y verificada por test". Las dos `CATEGORY_ORDER` privadas son la desviación; alinearlas es el arreglo estructural de esta fase.

### Comentarios de dominio con referencia al requisito
**Fuente:** `apps/web/app/audits/[id]/page.tsx:42` (`(reusa el eje de severidad, DS-02)`), `packages/report-model/src/build.ts:27` (`(Phase 6, SCORE-01..05 + DIFF-01/02)`)
**Aplicar a:** el comentario de rebalanceo en `CATEGORY_WEIGHTS`
Anotar el ID del requisito entre paréntesis al justificar un cambio de constante: `onpage: 0.1, // .15 → .10 (SCORE-02)`.

### Idioma por paquete
**Fuente:** contraste entre `packages/scoring/src/overallScore.test.ts` (inglés) y `packages/checks/src/registry.test.ts` (español neutro)
**Aplicar a:** todo comentario/nombre de test nuevo — seguir el idioma del archivo que se toca, no imponer uno global.

## No Analog Found

Ninguno. Los 3 tests nuevos son variantes del patrón de `registry.test.ts`; todo lo demás es edición de archivos existentes.

## Archivos explícitamente FUERA de alcance (verificado en RESEARCH.md)

| Archivo | Por qué no se toca |
|---------|--------------------|
| `apps/worker/src/index.ts:572-587` | Blacklist de `perf`, no whitelist — `social` fluye solo. Typecheck limpio verificado. |
| `packages/cms-adapters/**` (5 refs a `ONPAGE-05`) | Sirve copy de fix a reportes históricos en tiempo de lectura; quitarlo degrada reportes emitidos y rompe `coverage.test.ts:46`. |
| `packages/db/prisma/schema.prisma` | `Issue.category` es `String`, no enum. Cero `db:push`. |
| `packages/scoring/src/overallScore.ts:84-92` (renormalización) | Ya maneja categoría ausente por diseño. |

## Lectura obligatoria antes de editar (de A1 en RESEARCH.md)

`packages/export/src/pdf.tsx:180-200` — verificar el guard interno del `.map` antes de agregar `"social"` a `CATEGORY_ORDER` de export. Hay un bug de export PDF ya abierto en Deferred Items; una categoría sin datos podría romper el render.

## Metadata

**Analog search scope:** `packages/scoring`, `packages/checks`, `packages/report-model`, `packages/export`, `apps/web`, `apps/worker`
**Archivos leídos en esta sesión:** `overallScore.ts`, `overallScore.test.ts`, `registry.test.ts`, `checks/onpage/index.ts`, `export/labels.ts`, `web/components/ui/labels.ts`, `report-model/build.ts` (1-40), `export/test-fixtures.ts` (35-85), `web/audits/[id]/page.tsx` (30-49), `web/tests/.../export.test.ts` (70-95), los 3 `vitest.config.ts`
**Pattern extraction date:** 2026-08-01
