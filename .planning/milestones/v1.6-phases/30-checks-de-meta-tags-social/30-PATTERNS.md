# Phase 30: Checks de meta tags/social - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 24 (nuevos) + 3 (modificados)
**Analogs found:** 27 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/meta-social/package.json` (nuevo) | config | — | `packages/fingerprint/package.json` | exact |
| `packages/meta-social/tsconfig.json` (nuevo) | config | — | `packages/fingerprint/tsconfig.json` | exact |
| `packages/meta-social/src/index.ts` (nuevo) | barrel | — | `packages/fingerprint/src/index.ts` | exact |
| `packages/meta-social/src/types.ts` (nuevo) | model | transform | `packages/fingerprint/src/types.ts` | exact |
| `packages/meta-social/src/extract.ts` (nuevo) | utility (motor puro) | transform | `packages/fingerprint/src/detectStack.ts` | role-match |
| `packages/meta-social/src/charset.ts` (nuevo) | utility | transform (bytes) | `packages/fingerprint/src/detectStack.ts:36-41` (`truncateHtml`) | exact |
| `packages/meta-social/src/thresholds.ts` (nuevo) | config/constantes | — | consts al tope de `onpage/title.ts:4-6` | role-match |
| `packages/meta-social/src/extract.test.ts`, `charset.test.ts` (nuevos) | test | — | `packages/checks/src/checks/onpage/title.test.ts` | role-match |
| `packages/meta-social/src/__fixtures__/*.html` (nuevos) | fixture | — | fixtures inline de `phase11-guardrail.test.ts:29-31` | partial |
| `packages/checks/src/checks/social/ogTitle.ts` (SOCIAL-01) | check (PageCheck) | transform → IssueDraft | `onpage/title.ts` | exact |
| `.../ogDescription.ts` (SOCIAL-02) | check | transform | `onpage/metaDescription.ts` | exact |
| `.../ogImage.ts` (SOCIAL-03) | check | transform + URL normalize | `tech/canonical.ts:66-67` | role-match |
| `.../ogUrl.ts` (SOCIAL-04) | check | transform + URL normalize | `tech/canonical.ts` | exact |
| `.../ogType.ts` (SOCIAL-05) | check | transform | `onpage/title.ts` (rama presencia + rama ok) | exact |
| `.../ogDuplicates.ts` (SOCIAL-06) | check | transform (multi-hallazgo) | `tech/canonicalDeep.ts:68-80` + `onpage/headings.ts:48-63` | role-match |
| `.../twitterCard.ts` (SOCIAL-07) | check | transform (multi-hallazgo) | `onpage/headings.ts` (helper `push(subtype,…)`) | role-match |
| `.../charset.ts` (SOCIAL-08) | check | transform sobre `page.html` crudo | `onpage/title.ts` (forma) + `detectStack.ts` (bytes) | role-match |
| `.../social/index.ts` (nuevo barrel) | barrel | — | `packages/checks/src/checks/onpage/index.ts` | exact |
| `.../social/*.test.ts` (8 nuevos) | test | — | `onpage/title.test.ts` | exact |
| `.../social/social-guardrail.test.ts` (nuevo) | test integración | — | `checks/phase11-guardrail.test.ts` + `perf/checkIdCollision.test.ts:85-124` | exact |
| `packages/checks/src/checks/social/social-calibration.test.ts` (nuevo, 30-06 Tarea 3) | test calibración | — | `packages/checks/src/checks/perf/checkIdCollision.test.ts` | role-match |
| `packages/checks/src/registry.ts` (mod) | registry | — | patrón propio, líneas 4-24 | exact |
| `packages/checks/src/index.ts` (mod) | barrel raíz | — | líneas 12-17 | exact |
| `packages/checks/package.json` (mod) | config | — | bloque `dependencies` | exact |
| `packages/checks/src/registry.test.ts` (mod) | test | — | líneas 55-75 | exact |

## Pattern Assignments

### `packages/meta-social/package.json` + `tsconfig.json` (config)

**Analog:** `packages/fingerprint/package.json` (verbatim, 23 líneas) y `packages/fingerprint/tsconfig.json` (verbatim, 9 líneas).

Copiar tal cual cambiando sólo `"name": "@auditor/meta-social"`. Puntos no negociables verificados en el analog:
- `"main"`/`"types"`/`"exports"` apuntan a `./src/index.ts` (sin build).
- Scripts exactamente dos: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`. **No hay** script `build`, **no hay** `vitest.config.ts`.
- `dependencies`: sólo `"cheerio": "^1.2.0"`. `devDependencies`: `@types/node ^22.10.0`, `typescript ^5.7.2`, `vitest ^4.1.9`.
- tsconfig: `extends "../../tsconfig.base.json"`, `compilerOptions: { outDir: "dist", lib: ["ES2022"], types: ["node"] }`, `include: ["src"]`. El `types: ["node"]` es lo que habilita `Buffer` en `charset.ts`.

### `packages/meta-social/src/index.ts` (barrel)

**Analog:** `packages/fingerprint/src/index.ts` (11 líneas, archivo completo):

```ts
export type {
  Axis, Confidence, SignalStrength, Signal, AxisResult,
  DetectedStack, PageFingerprintInput, AggregatedInput, Signature,
} from "./types";

export { detectStack, MAX_HTML_BYTES } from "./detectStack";
```

Patrón: `export type { … } from "./types"` separado de `export { fn, CONST } from "./modulo"`. Las constantes públicas (aquí `OG_TITLE_MIN/MAX`, `CHARSET_WINDOW_BYTES`) se exportan igual que `MAX_HTML_BYTES`.

### `packages/meta-social/src/charset.ts` (utility, bytes)

**Analog:** `packages/fingerprint/src/detectStack.ts:33-41` — truncado por bytes UTF-8:

```ts
export const MAX_HTML_BYTES = 256 * 1024;

/** Trunca el HTML a `MAX_HTML_BYTES` bytes UTF-8 (defensa DoS previa a cheerio). */
function truncateHtml(html: string): string {
  const buf = Buffer.from(html, "utf8");
  if (buf.byteLength <= MAX_HTML_BYTES) return html;
  return buf.subarray(0, MAX_HTML_BYTES).toString("utf8");
}
```

Copiar la mecánica `Buffer.from(html,"utf8").subarray(0,N).toString("utf8")` con `N = 1024`, y aplicar el regex **sólo** sobre la ventana recortada (`[^>]+`, nunca `.*`). Copiar también el estilo del docblock: explica el porqué defensivo, no el qué.

### `packages/checks/src/checks/social/ogTitle.ts` (SOCIAL-01) — y molde de los 8

**Analog:** `packages/checks/src/checks/onpage/title.ts` (archivo completo, 102 líneas).

**Imports + constantes** (líneas 1-6):
```ts
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";

const CHECK_ID = "ONPAGE-01";
const MIN_LENGTH = 30;
const MAX_LENGTH = 60;
```
Para social: `import { extractMetaSocial, firstValue } from "@auditor/meta-social";` se suma acá; los umbrales vienen del paquete puro, no se redeclaran.

**Forma del check + rama de ausencia** (líneas 21-44):
```ts
/** ONPAGE-01: title tag presence, length (30-60 chars) and generic-word quality. */
export const titleCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const raw = $("title").first().text().trim();
    const url = page.finalUrl ?? page.url;

    if (!raw) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Falta la etiqueta title",
          severity: "critical",
          measuredValue: "sin title",
          source: url,
          criterion: "Toda página indexable debe tener un <title> único y descriptivo",
          recommendation:
            "Agrega una etiqueta <title> de entre 30 y 60 caracteres que describa el contenido principal de la página e incluya la palabra clave objetivo.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }
```

**Rama de longitud con 2 salidas** (líneas 67-85): un solo `if (length < MIN || length > MAX)` con `const tooShort = length < MIN_LENGTH;` y ternarios en `title`/`recommendation`. `measuredValue: \`${length} caracteres\``, `criterion: \`Longitud recomendada: ${MIN}-${MAX} caracteres\``.

**Rama `ok` explícita** (líneas 87-100): `severity: "ok"`, `title: "Title correcto"`, `recommendation: "Sin acción necesaria."` — literal exacto a reusar en los 8 checks.

**Convenciones de copy observadas:** docblock en inglés arriba del export; todo el texto de usuario (`title`/`criterion`/`recommendation`) en español neutro, imperativo impersonal en 2ª persona no-voseante ("Agrega", "Acorta", "Reemplaza"), sin em dashes.

### `packages/checks/src/checks/social/ogUrl.ts` (SOCIAL-04) y `ogImage.ts` (SOCIAL-03)

**Analog:** `packages/checks/src/checks/tech/canonical.ts`.

**Import de normalizeUrl** (línea 3): `import { normalizeUrl } from "@auditor/crawler";` — sólo en `packages/checks`, nunca en `meta-social`.

**Lectura de canonical + fallback + comparación** (líneas 11, 48, 66-69):
```ts
const url = page.finalUrl ?? page.url;
const href = canonicalTags.first().attr("href")?.trim();

const canonicalUrl = normalizeUrl(href, url) ?? href;
const selfUrl = normalizeUrl(url) ?? url;

if (canonicalUrl !== selfUrl) { /* issue */ }
```
SOCIAL-04 compara `normalizeUrl(ogUrlRaw, url)` contra `normalizeUrl(canonicalHref ?? url, url)` con el mismo `?? raw` de fallback. SOCIAL-03 detecta relativa comparando crudo vs resuelto (ver RESEARCH § Code Examples).

**Rama de valor vacío** (líneas 49-64): patrón "etiqueta presente pero sin valor" → issue propio, no rama `ok`. Reusable para `og:image`/`og:url` con `content` vacío.

### `packages/checks/src/checks/social/ogDuplicates.ts` (SOCIAL-06) y `twitterCard.ts` (SOCIAL-07)

**Analog primario:** `packages/checks/src/checks/onpage/headings.ts:47-63` — helper `push` con subtipo, para checks que emiten varios hallazgos:

```ts
const issues: IssueDraft[] = [];
const push = (subtype: string, title: string, criterion: string, recommendation: string, measuredValue?: string) => {
  issues.push({
    checkId: CHECK_ID,          // ← plano, sin ":"
    category: "onpage",
    title,
    severity: "warning",
    measuredValue,
    source: url,
    criterion,
    recommendation,
    fingerprint: pageFingerprint(`${CHECK_ID}:${subtype}`, url),  // ← subtipo SÓLO acá
    pageId: page.id,
  });
};
```

**Analog secundario:** `packages/checks/src/checks/tech/canonicalDeep.ts:68-76` — alias de fingerprint y dedup por valor normalizado:
```ts
const fp = (subtype: string) => pageFingerprint(`${CHECK_ID}:${subtype}`, url);
const distinctHrefs = new Set(hrefs.map((h) => normalizeUrl(h, url) ?? h));
if (distinctHrefs.size > 1) { /* conflicto */ }
```
SOCIAL-06 aplica el mismo `new Set(values).size > 1` sobre `MetaSocialData.tags`, no sobre `$('meta[property]')`.

También `headings.ts:45`: early return `if (headings.length === 0) return [];` — patrón "no aplica → cero filas".

### `packages/checks/src/checks/social/index.ts` (barrel)

**Analog:** `packages/checks/src/checks/onpage/index.ts` (archivo completo):
```ts
import type { PageCheck } from "../../types";
import { titleCheck } from "./title";
// …

export const onPageChecks: PageCheck[] = [titleCheck, metaDescriptionCheck, /* … */];

export { titleCheck, metaDescriptionCheck, /* … */ };
```
Triple patrón: imports individuales → array tipado exportado → re-export nominal de cada check. Wave 0 puede arrancar con `export const socialPageChecks: PageCheck[] = [];`.

### `packages/checks/src/registry.ts` (modificado)

**Analog:** el propio archivo, líneas 4-24. Un import de barrel y un spread, nada más:
```ts
import { perfPageChecks } from "./checks/perf";

export const pageChecks: PageCheck[] = [
  ...onPageChecks,
  ...techPageChecks,
  ...schemaPageChecks,
  ...aeoPageChecks,
  ...perfPageChecks,
];
```

### `packages/checks/src/index.ts` (modificado)

**Analog:** líneas 12-17 — `export * from "./checks/onpage";` … agregar `export * from "./checks/social";` al final de esa lista.

### `packages/checks/package.json` (modificado)

**Analog:** bloque `dependencies` (líneas 16-21) — agregar `"@auditor/meta-social": "workspace:*"` junto a `@auditor/crawler`/`@auditor/db`, ordenado alfabéticamente. Requiere `pnpm install` en la raíz.

### `packages/checks/src/checks/social/*.test.ts` (8 tests unitarios)

**Analog:** `packages/checks/src/checks/onpage/title.test.ts:1-30`:
```ts
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { titleCheck } from "./title";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return titleCheck.run({ page, $ });
}

describe("titleCheck (ONPAGE-01)", () => {
  it("flags missing title as critical", () => {
    const [issue] = run("<html><head></head><body></body></html>");
    expect(issue?.severity).toBe("critical");
  });
});
```
Patrón: helper `run(html)` local, HTML inline, `describe("<check> (<CHECK-ID>)")`, aserciones sobre `severity`/`title` con optional chaining. Para SOCIAL-08 el helper debe pasar `makePage({ url, html })` porque el check lee `page.html`.

### `packages/checks/src/checks/social/social-guardrail.test.ts` (Success Criterion #5)

**Analog A:** `packages/checks/src/checks/phase11-guardrail.test.ts:23-59` — no-colapso vía `diffIssues`:
```ts
import { diffIssues, scoreCategory, type ScorableIssue } from "@auditor/scoring";

const fingerprints = combined.map((i) => i.fingerprint);
expect(new Set(fingerprints).size).toBe(fingerprints.length);

const diff = diffIssues(combined, []);
expect(diff.statusByFingerprint.size).toBe(combined.length);
for (const fp of fingerprints) expect(diff.statusByFingerprint.get(fp)).toBe("new");
expect(diff.resolved).toEqual([]);
```
Segundo `describe` del mismo archivo: "estabilidad de score sobre fixture sana" — copiar esa estructura de dos bloques.

**Analog B:** `packages/checks/src/checks/perf/checkIdCollision.test.ts:102-124` — reconstrucción del fingerprint de un catálogo no importable + autoprueba de detección:
```ts
// PSI construye el fingerprint con el mismo formato byte a byte, así que se reproduce igual acá.
const psiFingerprints = extractPsiCheckIds().map((id) => `${id}:${TEST_URL}`);
const union = [...ownFingerprints, ...psiFingerprints];
expect(new Set(union).size).toBe(union.length);

it("detecta la colisión cuando existe (autoprueba con un checkId sintético)", () => {
  // …se inyecta un checkId REAL en la colección y se exige que lo reporte.
  // Datos sintéticos dentro del test: no se toca ni un archivo de `src`.
});
```
Para ONPAGE-05 usar `pageFingerprint("ONPAGE-05", TEST_URL)` (la función real), no el template literal.

### `packages/checks/src/registry.test.ts` (ampliar)

**Analog:** líneas 55-75 del propio archivo:
```ts
const RETIRED_CHECK_ID = "ONPAGE-05";

it("no tiene checkIds duplicados", () => {
  const registered = pageChecks.map((c) => c.checkId);
  expect(new Set(registered).size).toBe(registered.length);
});

it("ya no incluye el check retirado en v1.6", () => {
  const registered = pageChecks.map((c) => c.checkId);
  expect(registered).not.toContain(RETIRED_CHECK_ID);
});
```
Agregar `SOCIAL_CHECK_IDS = ["SOCIAL-01"… "SOCIAL-08"]` con el mismo loop `for (const id of …) expect(registered).toContain(id)` de las líneas 58-63.

## Shared Patterns

### Contrato `IssueDraft` / `PageCheck`
**Source:** `packages/checks/src/types.ts:23-43,69-72`
**Apply to:** los 8 checks
```ts
export interface IssueDraft {
  checkId: string; category: string; title: string;
  severity: "critical" | "warning" | "ok";
  measuredValue?: string; source?: string; criterion?: string; recommendation?: string;
  fingerprint: string; pageId?: string; scope?: string;
}
export interface PageCheckCtx { page: Page; $: CheerioAPI; }
export interface PageCheck { checkId: string; run(ctx: PageCheckCtx): IssueDraft[]; }
```
`run` es **síncrono** y devuelve array (nunca `null`).

### Fingerprint
**Source:** `packages/checks/src/util.ts:18-21`
**Apply to:** los 8 checks y el guardarraíl
```ts
export function pageFingerprint(checkId: string, url: string): string {
  return `${checkId}:${url}`;
}
```
Nunca escribir el template a mano. Subtipo: `pageFingerprint(\`${CHECK_ID}:${subtype}\`, url)`; `checkId` del draft queda plano.

### URL de la página
**Source:** `title.ts:26`, `canonical.ts:11` — `const url = page.finalUrl ?? page.url;` como primera línea de todo `run`.

### Fixture de `Page`
**Source:** `packages/checks/src/testUtils.ts:4-22` — `makePage({ url, html })`; ya rellena los 15 campos Prisma y hace el cast. Nunca objeto literal `as Page`.

### Defensa contra claves controladas por el sitio
**Source:** `packages/fingerprint/src/detectStack.ts:44-49` (docblock de `Object.create(null)` por `__proto__`/`constructor`) — en `meta-social` la mitigación equivalente es `Map<string,string[]>`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/meta-social/src/__fixtures__/*.html` | fixture | — | No existe hoy ningún directorio `__fixtures__` en el repo: todos los tests usan HTML inline. Es un patrón nuevo; si el plan prefiere consistencia, mantener el HTML inline como en `title.test.ts`/`phase11-guardrail.test.ts`. |
| `packages/meta-social/src/thresholds.ts` | config | — | No hay precedente de archivo de umbrales aislado; el patrón vigente son `const MIN_LENGTH = …` al tope del archivo del check (`title.ts:5-6`). Aquí se separa sólo porque Phase 32 los reusa. |

## Metadata

**Analog search scope:** `packages/checks/src/**`, `packages/fingerprint/**`, `packages/cms-adapters/**`, `packages/crawler/src/**`
**Files scanned:** 18 leídos, ~60 listados
**Pattern extraction date:** 2026-08-01
