# Phase 27: Motor de recomendaciones por CMS — patrón adaptador + fallback - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 13 (11 nuevos en `packages/cms-adapters`, 1 modificado `report-model/src/build.ts`, 1 modificado `report-model/package.json`, 1 nuevo script e2e)
**Analogs found:** 13 / 13 (todos con analog directo en `packages/fingerprint` / `report-model` / `apps/worker/scripts`)

## File Classification

| Nuevo/Modificado archivo | Rol | Data Flow | Analog más cercano | Match |
|--------------------------|-----|-----------|--------------------|-------|
| `packages/cms-adapters/package.json` | config | — | `packages/fingerprint/package.json` | exact |
| `packages/cms-adapters/tsconfig.json` | config | — | `packages/fingerprint/tsconfig.json` | exact |
| `packages/cms-adapters/src/index.ts` | barrel/config | — | `packages/fingerprint/src/index.ts` | exact |
| `packages/cms-adapters/src/types.ts` | model | transform | `packages/fingerprint/src/types.ts` | exact |
| `packages/cms-adapters/src/registry.ts` | registry | transform | `packages/fingerprint/src/signatures/registry.ts` | exact |
| `packages/cms-adapters/src/resolveCmsRecommendation.ts` | utility/service | transform | `packages/report-model/src/build.ts` (`toReportStack` pure fn) | role-match |
| `packages/cms-adapters/src/wordpress.ts` | data/model | transform | `packages/fingerprint/src/signatures/*.ts` (tablas de datos por eje) | role-match |
| `packages/cms-adapters/src/shopify.ts` | data/model | transform | idem | role-match |
| `packages/cms-adapters/src/webflow.ts` | data/model | transform | idem | role-match |
| `packages/cms-adapters/src/wixSquarespace.ts` | data/model | transform | idem | role-match |
| `packages/cms-adapters/src/resolveCmsRecommendation.test.ts` | test | — | `packages/fingerprint/src/signatures/registry.test.ts` | exact |
| `packages/cms-adapters/src/coverage.test.ts` | test | — | `packages/fingerprint/src/signatures/registry.test.ts` | exact |
| `packages/report-model/src/build.ts` | service | transform | (self — punto de inyección) | modificado |
| `packages/report-model/package.json` | config | — | (self — agregar dep) | modificado |
| `apps/worker/scripts/verify-cms-fix.mts` | script/test | batch | `apps/worker/scripts/verify-stack.mts` | exact |

## Pattern Assignments

### `packages/cms-adapters/package.json` (config)

**Analog:** `packages/fingerprint/package.json` (líneas 1-23)

Copiar shape verbatim, cambiar `name`, quitar `cheerio`, agregar dep `@auditor/fingerprint`:
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
Nota: `@auditor/fingerprint` va en `dependencies` (no devDependencies) aunque sea consumido type-only — mismo criterio que `report-model/package.json` L15-19, que lista `@auditor/fingerprint` como dependency y lo importa solo como tipo en build.ts L17.

### `packages/cms-adapters/tsconfig.json` (config)

**Analog:** `packages/fingerprint/tsconfig.json` (líneas 1-9) — idéntico, sin cambios:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "lib": ["ES2022"], "types": ["node"] },
  "include": ["src"]
}
```

### `packages/cms-adapters/src/index.ts` (barrel)

**Analog:** `packages/fingerprint/src/index.ts` (líneas 1-14) — patrón: bloque `export type { ... }` seguido de `export { runtimeFn }`.

Exportar solo lo que consume `report-model` + los tipos que necesitan los tests:
```typescript
export { resolveCmsRecommendation } from "./resolveCmsRecommendation";
export { SUPPORTED_CHECK_IDS } from "./types";
export type { CmsLabel, CmsAdapter } from "./types";
```

### `packages/cms-adapters/src/types.ts` (model)

**Analog:** `packages/fingerprint/src/types.ts` (líneas 1-131) — convención: tipos con JSDoc en español neutro, `export type` / `export interface`.

**HALLAZGO CLAVE (Pitfall 3):** NO existe `CmsPlatform` exportado por fingerprint. `AxisResult.value` es `string | null` (types.ts L53-59). `cms-adapters` declara su unión local:
```typescript
export type CmsLabel = "WordPress" | "Shopify" | "Webflow" | "Wix" | "Squarespace";

export const SUPPORTED_CHECK_IDS = [
  "ONPAGE-01","ONPAGE-02","ONPAGE-03","ONPAGE-04","ONPAGE-05",
  "TECH-01","TECH-02","TECH-04","SD-01","SD-02",
] as const;

// AxisResult se importa type-only de fingerprint para tipar el builder en lookup()
import type { AxisResult } from "@auditor/fingerprint";
export interface CmsAdapter {
  lookup(checkId: string, builder: AxisResult): string | null;
}
```
`Confidence` (fingerprint types.ts L25: `"alto" | "medio" | "bajo" | "no-detectado"`) es el tipo de `cms.confidence` / `builder.confidence` que gatea el motor.

### `packages/cms-adapters/src/registry.ts` (registry)

**Analog:** `packages/fingerprint/src/signatures/registry.ts` (líneas 1-25)

Patrón exacto: `Record<KeyUnion, Value>` con un import por módulo de datos y JSDoc explicando que las reglas/datos calibrables quedan aislados del motor:
```typescript
import type { CmsLabel } from "./types";
import type { CmsAdapter } from "./types";
import { wordpressAdapter } from "./wordpress";
import { shopifyAdapter } from "./shopify";
import { webflowAdapter } from "./webflow";
import { wixSquarespaceAdapter } from "./wixSquarespace";

export const registry: Record<CmsLabel, CmsAdapter> = {
  WordPress: wordpressAdapter,
  Shopify: shopifyAdapter,
  Webflow: webflowAdapter,
  Wix: wixSquarespaceAdapter,          // mismo módulo,
  Squarespace: wixSquarespaceAdapter,  // distinto label interno
};
```
Fingerprint mapea `Axis → Signature[]`; aquí `CmsLabel → CmsAdapter`. Mismo shape estructural.

### `packages/cms-adapters/src/resolveCmsRecommendation.ts` (utility, transform)

**Analog:** función pura `toReportStack` en `packages/report-model/src/build.ts` (L143-158) — patrón de función pura exportada, sin I/O, con guards tempranos de `null`/valor.

Import type-only del boundary (regla dura del milestone; mismo estilo que build.ts L17 `import type { AxisResult, DetectedStack } from "@auditor/fingerprint"`):
```typescript
import type { DetectedStack } from "@auditor/fingerprint";
import { registry } from "./registry";
import type { CmsLabel } from "./types";

const ACTIVATING = new Set(["alto", "medio"]); // gate confianza (Pitfall 4)
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
  return instruction ?? generic; // catálogo ausente → fallback (CMSFIX-04)
}
```
Nota de firma: CONTEXT/RESEARCH nombran la firma `resolveCmsRecommendation(stack, checkId, genericRecommendation)`. El `stack` que se pasa es el `rawStack: DetectedStack | null`, NO el `ReportStack` (ver Pattern 3 / anti-patrones).

### `packages/cms-adapters/src/wordpress.ts` / `shopify.ts` / `webflow.ts` / `wixSquarespace.ts` (data)

**Analog:** módulos de datos por eje en `packages/fingerprint/src/signatures/*.ts` (arrays declarativos importados por registry.ts) — mismo rol: dato calibrable aislado del motor.

Cada módulo exporta un `CmsAdapter` con catálogo `Record<checkId, string>` plano + método `lookup`. WordPress añade variantes por builder para `ONPAGE-04`/`SD-01`/`SD-02` (gate builder Pitfall 5: variante solo si `builder.value ∈ {Elementor,Divi,WPBakery,Gutenberg}` y `builder.confidence ∈ {alto,medio}`, si no → rama "Si usas..."). `wixSquarespace.ts` tiene dos catálogos internos por label (Wix vs Squarespace).

**Copy fuente:** el catálogo completo 10×5 (borrador listo) y los strings genéricos verbatim para el fallback están en `27-RESEARCH.md` secciones "Catálogo de copy por plataforma" (L279-395) y "Fallback genérico verbatim" (L397-414). Ítems `[REVISAR]` → notas `checkpoint:human-verify` en el PLAN.

**Convención de verbos verificada en código** (calcar estilo, español neutro sin voceo): `checks/src/checks/title.ts` L38-80 usa `"Agrega una etiqueta <title>..."`, `"Reemplaza..."`, `"Amplía..."`, `"Acorta..."`; `canonical.ts` L24-80 usa `"Agrega <link rel=\"canonical\"...>"`, `"Deja una sola..."`, `"Completa..."`.

### `packages/cms-adapters/src/resolveCmsRecommendation.test.ts` + `coverage.test.ts` (test)

**Analog:** `packages/fingerprint/src/signatures/registry.test.ts` (líneas 1-40)

Patrón exacto: `import { describe, it, expect } from "vitest"`, archivo hermano junto al código, `it(...)` en español neutro, aserciones de cobertura sobre el `registry`. Ejemplo del analog:
```typescript
import { describe, it, expect } from "vitest";
import { registry } from "./registry";

describe("signatures registry", () => {
  it("expone exactamente las 6 claves de eje", () => {
    expect(Object.keys(registry).sort()).toEqual([...AXES].sort());
  });
  it("cada eje tiene al menos una signature", () => { /* ... */ });
});
```
Aplicar a: (a) `coverage.test.ts` → 10 checkIds × 5 labels = 50 entradas, ninguna vacía/faltante (iterar `SUPPORTED_CHECK_IDS × CMS_LABELS`, assert cada `lookup` devuelve string no vacío); (b) `resolveCmsRecommendation.test.ts` → fallback por combinación (los 4 valores de `Confidence`, guard `ok`, WP+Elementor sobre ONPAGE-04, `rawStack === null`).

### `packages/report-model/src/build.ts` (service — MODIFICADO)

**Punto de inyección único.** `toReportIssue` actual (L109-124):
```typescript
function toReportIssue(issue: IssueRow): ReportIssue {
  return {
    id: issue.id,
    checkId: issue.checkId,                    // L112
    category: issue.category,
    title: issue.title,
    severity: issue.severity as ReportSeverity,
    measuredValue: issue.measuredValue,
    source: issue.source,
    criterion: issue.criterion,
    recommendation: issue.recommendation,      // L119 ← se resuelve aquí
    fingerprint: issue.fingerprint,
    diffStatus: (issue.diffStatus as ReportDiffStatus | null) ?? null,
    url: issueUrl({ source: issue.source, scope: issue.scope }),
  };
}
```

Cambio requerido (agregar 2º parámetro + guard severidad `ok`):
```typescript
function toReportIssue(issue: IssueRow, stack: DetectedStack | null): ReportIssue {
  const recommendation =
    issue.severity === "ok"
      ? issue.recommendation // guard: nunca reescribir "Sin acción necesaria." (Pitfall 1)
      : resolveCmsRecommendation(stack, issue.checkId, issue.recommendation);
  return { /* ...campos existentes... */ recommendation };
}
```

**`rawStack` YA está en scope** (L182):
```typescript
const rawStack = audit.stack as unknown as DetectedStack | null;   // L182
const stack: ReportStack | undefined = rawStack ? toReportStack(rawStack) : undefined; // L183
```
**CRÍTICO — pasar `rawStack` (L182), NO `stack` (L183):** `toReportStack` (L143-158) fusiona el builder en el label (`"WordPress (Elementor)"`, L148-150) y descarta el eje `builder` — inservible para el matching. Ver anti-patrón.

**3 call sites de `toReportIssue` a actualizar** (todos deben pasar `rawStack`):
- L218: `(priorityCandidatesRaw as unknown as IssueRow[]).map(toReportIssue)` → `.map((i) => toReportIssue(i, rawStack))`
- L227: `bucket.push(toReportIssue(issue))` → `bucket.push(toReportIssue(issue, rawStack))`
- L234: `const reportIssue = toReportIssue(issue)` → `toReportIssue(issue, rawStack)`

**Import a agregar** (junto a L17, que ya trae `DetectedStack` type-only):
```typescript
import { resolveCmsRecommendation } from "@auditor/cms-adapters";
```

### `packages/report-model/package.json` (config — MODIFICADO)

Agregar a `dependencies` (L15-19, junto a `@auditor/fingerprint`):
```json
"@auditor/cms-adapters": "workspace:*"
```
Requiere `pnpm install` para enlazar el workspace nuevo.

### `apps/worker/scripts/verify-cms-fix.mts` (script e2e — NUEVO)

**Analog:** `apps/worker/scripts/verify-stack.mts` (líneas 1-45)

Patrón exacto: header JSDoc explicando propósito + Usage, `import { prisma } from "@auditor/db"`, resuelve audit por `argv[2]` o el más reciente `status = "done"`, falla ruidoso con `P1001` si no hay red (nunca fabrica datos). Reutiliza `DATABASE_URL`. Aquí: construir el `ReportModel` de un audit WordPress real conocido (ej. aprendoclub) y verificar que `recommendation` muestra el texto personalizado de la plataforma. Usage line:
```
pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts [auditId]
```

## Shared Patterns

### Paquete puro espejo de fingerprint
**Source:** `packages/fingerprint/{package.json, tsconfig.json, src/index.ts}`
**Apply to:** toda la estructura de `packages/cms-adapters`
`type: module`, `main`/`types` → `./src/index.ts`, scripts `typecheck`/`test`, `tsconfig` extiende `../../tsconfig.base.json`. Barrel exporta tipos con `export type` y runtime con `export`.

### Registry `Record<Key, Value>` con datos aislados del motor
**Source:** `packages/fingerprint/src/signatures/registry.ts` (L17-24)
**Apply to:** `registry.ts` + módulos de datos por plataforma
Un import por módulo de datos; el motor (lógica estable) nunca contiene los datos calibrables (copy).

### Import type-only del boundary
**Source:** `packages/report-model/src/build.ts` L17 (`import type { AxisResult, DetectedStack } from "@auditor/fingerprint"`)
**Apply to:** `resolveCmsRecommendation.ts`, `types.ts`
NUNCA import runtime de fingerprint; NUNCA import de `@auditor/checks` en ningún sentido. El único acoplamiento con checks es el string `checkId`.

### Tests vitest hermanos en español neutro
**Source:** `packages/fingerprint/src/signatures/registry.test.ts` (L1-40)
**Apply to:** ambos test files de cms-adapters
`describe`/`it`/`expect`, archivo `*.test.ts` junto al código, aserciones de cobertura sobre el registry.

### Script de verificación e2e contra audit real
**Source:** `apps/worker/scripts/verify-stack.mts` (L1-45)
**Apply to:** `verify-cms-fix.mts`
`prisma` de `@auditor/db`, resolución de audit por argv o más reciente `done`, fallo ruidoso sin red, cero fabricación.

## No Analog Found

Ninguno. Los 15 archivos tienen analog directo en el codebase (fingerprint, report-model, worker/scripts). El único trabajo sin analog de código es la **autoría de copy** (50 instrucciones + variantes builder), cuyo borrador ya está en `27-RESEARCH.md` L279-414 con referencia de tono en `checks/src/checks/{title,canonical,altText,jsonldPresence}.ts`.

## Metadata

**Analog search scope:** `packages/fingerprint/`, `packages/report-model/src/`, `packages/checks/src/checks/`, `apps/worker/scripts/`
**Files scanned:** 9 leídos completos/parciales (fingerprint package.json/tsconfig/index.ts/types.ts/registry.ts/registry.test.ts, report-model build.ts/package.json, verify-stack.mts)
**Pattern extraction date:** 2026-07-24
