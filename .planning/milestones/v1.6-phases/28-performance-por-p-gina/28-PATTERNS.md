# Phase 28: Performance por página - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 9 (3 nuevos de código + 2 tests nuevos + 4 modificados)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/crawler/src/pageMetrics.ts` (NUEVO) | utility (crawler) | transform (response → métricas) | `packages/crawler/src/captureHeaders.ts` | exact |
| `packages/crawler/src/pageMetrics.test.ts` (NUEVO) | test | — | `packages/crawler/src/captureHeaders.test.ts` | exact |
| `packages/crawler/src/crawl.ts` (MOD) | service / crawler orchestrator | streaming → CRUD (upsert) | sí mismo, líneas 110-148 (patrón FPRINT-01) | exact (self) |
| `packages/crawler/src/index.ts` (MOD, opcional) | barrel | — | sí mismo | exact (self) |
| `packages/db/prisma/schema.prisma` (MOD) | model / migration | schema aditivo | `model Page` campos `responseHeaders`/`cookieNames` (Phase 25) | exact |
| `packages/checks/src/checks/perf/responseTime.ts` (NUEVO) | check (pure fn) | transform | `packages/checks/src/checks/onpage/contentLength.ts` | exact |
| `packages/checks/src/checks/perf/htmlSize.ts` (NUEVO) | check (pure fn) | transform | `packages/checks/src/checks/onpage/contentLength.ts` | exact |
| `packages/checks/src/checks/perf/*.test.ts` (NUEVOS) | test | — | `packages/checks/src/checks/onpage/h1.test.ts` | exact |
| `packages/checks/src/checks/perf/index.ts` (NUEVO) | barrel | — | `packages/checks/src/checks/onpage/index.ts` | exact |
| `packages/checks/src/registry.ts` (MOD) | registry | — | sí mismo, líneas 17-22 | exact (self) |
| `packages/checks/src/index.ts` (MOD) | barrel | — | sí mismo, líneas 12-16 | exact (self) |
| `packages/checks/src/testUtils.ts` (MOD) | test fixture | — | sí mismo, líneas 4-20 | exact (self) |

---

## Pattern Assignments

### `packages/crawler/src/pageMetrics.ts` (utility, transform)

**Analog:** `packages/crawler/src/captureHeaders.ts`

Es el precedente exacto: helper puro extraído del `requestHandler`, con doc-comment en español que
explica de dónde sale el dato y por qué no agrega requests, funciones exportadas nombradas, testeable
en aislamiento.

**Doc-comment de cabecera** (`captureHeaders.ts:1-12`):
```typescript
/**
 * Captura de fingerprinting a partir de los headers ya disponibles en el
 * `requestHandler` del crawler (Phase 25, FPRINT-01). No agrega requests: sólo
 * cura/normaliza lo que la respuesta ya trae.
 *
 * Reglas duras:
 * - `curateHeaders` itera SOLO sobre el allowlist ...
 */
```
Replicar la misma estructura para Phase 28: "Captura de métricas de performance por página a partir
de la respuesta ya disponible en el `requestHandler` (Phase 28, PAGEPERF-01/02). No agrega requests."
Documentar en las "reglas duras" los dos hallazgos de RESEARCH: (a) la fuente elegida de timings y
por qué (`wait` de socket es propio del crawler, no del sitio auditado — Pitfall 3), y (b) que
`htmlBytes` es HTML **descomprimido** (Pitfall 4).

**Firma de función pura + guards** (`captureHeaders.ts:63-73`):
```typescript
export function curateHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CURATED_HEADER_KEYS) {
    const v = headers[key];
    if (v == null) continue;
    ...
  }
  return out;
}
```
Patrón a copiar: parámetro tipado de forma laxa (lo que realmente llega de got), guard `== null`,
retorno explícito. Para Phase 28: `extractPageMetrics(response, html) → { responseMs: number | null; htmlBytes: number | null }`.

**Constantes exportadas + `as const`** (`captureHeaders.ts:18-57`): si se exporta la fuente de timing
elegida o una constante, seguir el mismo estilo (`export const ... as const` + `export type X = (typeof X)[number]`).

---

### `packages/crawler/src/pageMetrics.test.ts` (test)

**Analog:** `packages/crawler/src/captureHeaders.test.ts`

**Estructura** (líneas 1-15):
```typescript
import { describe, it, expect } from "vitest";
import { curateHeaders, parseCookieNames, CURATED_HEADER_KEYS } from "./captureHeaders";

describe("curateHeaders", () => {
  it("keeps only allowlisted keys present in the input, dropping the rest", () => {
    const out = curateHeaders({ server: "cloudflare", "cf-ray": "abc", "x-irrelevante": "z" });
    expect(out).toEqual({ server: "cloudflare", "cf-ray": "abc" });
    expect(out).not.toHaveProperty("x-irrelevante");
  });
```

**Patrón de test de regresión con comentario explicativo** (líneas 17-29) — usarlo para blindar los
hallazgos de RESEARCH:
```typescript
  it("keeps the Hostinger origin headers that pass through a fronting CDN (platform, panel)", () => {
    // Regresión (fingerprint-cms-not-detected): ariannalupi.com sirve detrás de
    // Cloudflare pero deja pasar `platform: hostinger` / `panel: hpanel`. Sin
    // capturarlos, la signature hosting.hostinger nunca los ve ...
```
Casos obligatorios para Phase 28: `response` undefined → `null`; `timings` ausente → `null`;
`html` undefined → `htmlBytes` null; string con acentos → `byteLength` > `String.length`
(RESEARCH "Don't Hand-Roll": `github.com` dio `strLen=591675` vs `byteLength=591772`).

---

### `packages/crawler/src/crawl.ts` (crawler orchestrator, streaming → CRUD)

**Analog:** sí mismo — el patrón FPRINT-01 ya implementado justo arriba del punto de inserción.

**Punto de derivación + comentario justificativo** (`crawl.ts:109-117`):
```typescript
const statusCode = response?.statusCode ?? null;
// Fingerprinting raw material from headers already loaded here — no extra
// request (FPRINT-01). Only curated headers + cookie NAMES are persisted.
const responseHeaders = curateHeaders(response?.headers ?? {});
const cookieNames = parseCookieNames(response?.headers?.["set-cookie"]);
const html = typeof body === "string" ? body : body?.toString("utf-8");
// Extract the HTML <title> once from the already-loaded Cheerio `$`
// (no HTML re-parse anywhere else — ARCH-03). Empty/missing => NULL.
const title = $("title").first().text().trim() || null;
```
Las métricas nuevas van inmediatamente después de `const html = ...` (línea 114), con el mismo estilo
de comentario referenciando el requirement (`PAGEPERF-01/02`).

**Upsert con campo en AMBAS ramas** (`crawl.ts:119-148`) — regla crítica de RESEARCH Pattern 1:
```typescript
await prisma.page.upsert({
  where: { auditId_url: { auditId, url } },
  create: {
    auditId, url, title, statusCode, finalUrl,
    redirectChain: redirectChain as never,
    contentType: contentType?.type ?? null,
    depth: userData?.depth ?? 0,
    fromSitemap: userData?.fromSitemap ?? false,
    html,
    responseHeaders: responseHeaders as never,
    cookieNames,
    fetchedAt: new Date(),
  },
  update: {
    title, statusCode, finalUrl,
    redirectChain: redirectChain as never,
    contentType: contentType?.type ?? null,
    html,
    responseHeaders: responseHeaders as never,
    cookieNames,
    fetchedAt: new Date(),
    error: null,
  },
});
```
Nótese que `responseHeaders`/`cookieNames` aparecen en `create` **y** en `update`. Copiar exactamente:
`responseMs`/`htmlBytes` en las dos ramas, o un re-crawl deja valores rancios.

**Import:** agregar junto a los ya existentes de helpers locales (mismo estilo que
`import { curateHeaders, parseCookieNames } from "./captureHeaders";`).

**Barrel del paquete** (`packages/crawler/src/index.ts`, líneas 1-5) — sólo si el helper se consume
fuera del paquete. Nota: `captureHeaders` **no** se exporta ahí, así que el default es NO exportar
`pageMetrics` (helper interno); mantener la simetría.

---

### `packages/db/prisma/schema.prisma` — `model Page` (model, migración aditiva)

**Analog:** los campos añadidos en Phase 25 dentro del mismo modelo (`schema.prisma:123-130`):
```prisma
  /** Entity graph built from this page's JSON-LD (schema.org): { nodes, edges } — Phase 4. */
  schemaGraph   Json?
  /** JSON-LD plano por entidad ... — Phase 24 (SDVIZ-02). */
  schemaJson    Json?
  /** Headers HTTP curados relevantes a fingerprinting — Phase 25 (FPRINT-01). */
  responseHeaders Json?
  /** Nombres de cookie (no valores) parseados de Set-Cookie — Phase 25 (FPRINT-01). */
  cookieNames String[]
```

**Convención a copiar:** campos nuevos se agregan **al final** del bloque de campos (después de
`createdAt`, antes de las relaciones `issues`/`perfMetrics`), cada uno precedido de un doc-comment
`/** ... — Phase NN (REQ-ID). */` en español que explica el dato y su unidad. Para Phase 28 el
comentario debe incluir la unidad y la semántica exacta (ms desde el crawl / bytes descomprimidos),
porque es justo la ambigüedad que RESEARCH marca en Pitfalls 3 y 4.

**Tipo:** `Int?` nullable, alineado con `statusCode Int?` / `depth Int?` (líneas 113, 118). Sin
`@default`, sin backfill.

---

### `packages/checks/src/checks/perf/responseTime.ts` y `htmlSize.ts` (check, transform)

**Analog:** `packages/checks/src/checks/onpage/contentLength.ts` (archivo completo, 48 líneas)

Es el analog exacto que CONTEXT.md nombra: umbral numérico, dos niveles de severidad, fila "ok"
explícita, `measuredValue` con unidad.

**Estructura completa a copiar** (`contentLength.ts:1-48`):
```typescript
import type { PageCheck } from "../../types";
import { extractVisibleText, pageFingerprint, wordCount } from "../../util";

const CHECK_ID = "ONPAGE-06";
const MIN_WORDS = 300;

/** ONPAGE-06: content length (visible body word count). */
export const contentLengthCheck: PageCheck = {
  checkId: CHECK_ID,
  run({ page, $ }) {
    const url = page.finalUrl ?? page.url;
    const text = extractVisibleText($);
    const words = wordCount(text);

    if (words < MIN_WORDS) {
      return [
        {
          checkId: CHECK_ID,
          category: "onpage",
          title: "Contenido escaso",
          severity: words < MIN_WORDS / 2 ? "critical" : "warning",
          measuredValue: `${words} palabras`,
          source: url,
          criterion: `Mínimo recomendado: ${MIN_WORDS} palabras`,
          recommendation:
            "Amplía el contenido de la página con información relevante y original para el usuario; el contenido delgado suele posicionar peor.",
          fingerprint: pageFingerprint(CHECK_ID, url),
          pageId: page.id,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "onpage",
        title: "Longitud de contenido correcta",
        severity: "ok",
        measuredValue: `${words} palabras`,
        source: url,
        criterion: `Mínimo recomendado: ${MIN_WORDS} palabras`,
        recommendation: "Sin acción necesaria.",
        fingerprint: pageFingerprint(CHECK_ID, url),
        pageId: page.id,
      },
    ];
  },
};
```

**Elementos concretos a replicar:**
1. `const CHECK_ID = "PERF-10"` / `"PERF-11"` como constante de módulo (nunca literal inline). Ver
   Pitfall 1 de RESEARCH: `PERF-07`/`PERF-08` de CONTEXT.md colisionan con `packages/psi/src/issues.ts`.
2. Umbrales como constantes nombradas en mayúsculas al lado del `CHECK_ID` (`MIN_WORDS` → p.ej.
   `WARN_MS`/`CRIT_MS`, `WARN_BYTES`/`CRIT_BYTES`).
3. `const url = page.finalUrl ?? page.url;` — primera línea de `run`, invariable en todo el catálogo.
   Es además la línea que genera la colisión de fingerprint con PSI si se reusa un checkId ocupado.
4. Severidad ternaria en una sola expresión: `severity: words < MIN_WORDS / 2 ? "critical" : "warning"`.
   Para Phase 28 la comparación es estrictamente `>` (lockeado en CONTEXT.md).
5. `measuredValue` string con unidad legible (`` `${words} palabras` `` → `` `${ms} ms` `` /
   `` `${Math.round(bytes / 1024)} KB` ``).
6. `criterion` describe el umbral en la misma unidad que `measuredValue`. Añadir la aclaración de
   Pitfalls 3/4 aquí: "medido durante el rastreo desde nuestro servidor" / "HTML sin comprimir".
7. `recommendation: "Sin acción necesaria."` — string literal exacto para la rama "ok" de todo el catálogo.
8. `fingerprint: pageFingerprint(CHECK_ID, url)` + `pageId: page.id`, siempre los dos últimos campos.
9. Doc-comment de una línea `/** PERF-10: ... */` sobre el export.
10. Tono del copy: imperativo neutro sin voceo ("Amplía el contenido...", "Agrega <link rel=canonical>..."
    en `tech/canonical.ts:26`). **No** copiar el tono de `packages/psi/src/issues.ts`, que usa voceo rioplatense.

**Guard de dato ausente** — patrón de retorno vacío temprano, tomado de `tech/canonical.ts:10-13`
(mismo esqueleto, retorno distinto):
```typescript
run({ page, $ }) {
  const url = page.finalUrl ?? page.url;
  const canonicalTags = $('link[rel="canonical"]');
  if (canonicalTags.length === 0) { return [ /* ... */ ]; }
```
Para Phase 28 el guard es `if (page.responseMs == null) return [];` justo después de la línea de `url`.
Usar `== null` (no falsy) — `0 ms` / `0 bytes` son valores válidos que un guard falsy descartaría.

**Nota de firma:** estos checks no usan `$`. Declarar `run({ page })` y omitir `$` del destructuring;
`PageCheck.run(ctx: PageCheckCtx): IssueDraft[]` (`types.ts:69-72`) no lo exige.

---

### `packages/checks/src/checks/perf/*.test.ts` (test)

**Analog:** `packages/checks/src/checks/onpage/h1.test.ts` (archivo completo, 27 líneas)

```typescript
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { h1Check } from "./h1";
import { makePage } from "../../testUtils";

function run(html: string) {
  const $ = cheerio.load(html);
  const page = makePage({ url: "https://example.com/page" });
  return h1Check.run({ page, $ });
}

describe("h1Check (ONPAGE-03)", () => {
  it("flags missing H1 as critical", () => {
    const [issue] = run("<html><body><p>no h1 here</p></body></html>");
    expect(issue?.severity).toBe("critical");
  });
  ...
```

**Patrón:** helper local `run(...)` que arma la fixture, `describe("<nombre> (<CHECK_ID>)")`,
un `it` por rama de severidad, destructuring `const [issue] = ...` + `issue?.severity`.
Para Phase 28 el helper toma el valor numérico en vez de HTML:
`function run(responseMs: number | null) { ... makePage({ url, html: "<html></html>", responseMs }) ... }`.

Casos: por debajo del umbral → `"ok"`; en el umbral exacto → `"ok"` (comparación `>` estricta,
lockeada); sobre warning → `"warning"`; sobre critical → `"critical"`; `null` → `[]` con un comentario
que explique que el caso no es alcanzable vía `runAllChecks` por el guard `!page.html`
(Pitfall 6), para que no se lea como código muerto.

**Test de fingerprint único** — analog `packages/checks/src/checks/phase11-guardrail.test.ts:23-45`:
```typescript
const combined: IssueDraft[] = [...canonicalIssues, ...headingIssues];
const fingerprints = combined.map((i) => i.fingerprint);
```
Dado Pitfall 1, vale un test que compruebe que los fingerprints de los checks nuevos no colisionan
con los de `packages/psi/src/issues.ts` sobre la misma URL. Mismo estilo: comentario de cabecera
explicando qué concern integrado blinda que ningún test aislado cubre.

---

### `packages/checks/src/checks/perf/index.ts` (barrel)

**Analog:** `packages/checks/src/checks/onpage/index.ts` (archivo completo)
```typescript
import type { PageCheck } from "../../types";
import { titleCheck } from "./title";
import { contentLengthCheck } from "./contentLength";
...
export const onPageChecks: PageCheck[] = [
  titleCheck,
  ...
];

export {
  titleCheck,
  ...
};
```
Doble export literal: el array agrupado tipado `PageCheck[]` **y** los checks individuales por nombre.

---

### `packages/checks/src/registry.ts` (registry)

**Analog:** sí mismo, líneas 4-22
```typescript
import { onPageChecks } from "./checks/onpage";
import { techPageChecks, techSiteChecks } from "./checks/tech";
import { aeoPageChecks, aeoSiteChecks, aeoNetworkChecks } from "./checks/aeo";

export const pageChecks: PageCheck[] = [
  ...onPageChecks,
  ...techPageChecks,
  ...schemaPageChecks,
  ...aeoPageChecks,
];
```
Un import + un spread al final del array. Nada más en este archivo.

**Guard de `runAllChecks` a tener presente** (`registry.ts:59-64`) — no se modifica:
```typescript
for (const page of pages) {
  if (!page.html) continue;
  const $ = cheerio.load(page.html);
  for (const check of pageChecks) {
    issues.push(...check.run({ page, $ }));
  }
```

---

### `packages/checks/src/index.ts` (barrel del paquete)

**Analog:** sí mismo, líneas 12-16
```typescript
export * from "./checks/onpage";
export * from "./checks/tech";
export * from "./checks/network";
export * from "./checks/schema";
export * from "./checks/aeo";
```
Una línea más: `export * from "./checks/perf";`.

---

### `packages/checks/src/testUtils.ts` (fixture de test) — MODIFICACIÓN OBLIGATORIA

**Analog:** sí mismo, líneas 4-20
```typescript
export function makePage(overrides: Partial<Page> & { url: string }): Page {
  return {
    id: overrides.id ?? `page-${overrides.url}`,
    auditId: overrides.auditId ?? "audit-1",
    url: overrides.url,
    statusCode: overrides.statusCode ?? 200,
    html: overrides.html ?? null,
    finalUrl: overrides.finalUrl ?? overrides.url,
    redirectChain: overrides.redirectChain ?? null,
    contentType: overrides.contentType ?? "text/html",
    depth: overrides.depth ?? 0,
    fromSitemap: overrides.fromSitemap ?? true,
    fetchedAt: overrides.fetchedAt ?? new Date(),
    error: overrides.error ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  } as Page;
}
```
Enumeración campo a campo con `overrides.X ?? default`, cerrando con `as Page`. **No hay `...overrides`**,
así que un campo no enumerado queda `undefined` aunque el test lo pase (Pitfall 7). Agregar en el
mismo estilo:
```typescript
    responseMs: overrides.responseMs ?? null,
    htmlBytes: overrides.htmlBytes ?? null,
```
Sin esto, los tests de umbral devuelven `[]` y "fallan misteriosamente".

---

## Shared Patterns

### Fingerprint estable
**Source:** `packages/checks/src/util.ts:18-21`
**Apply to:** los dos checks nuevos
```typescript
/** Builds a stable page-level fingerprint: checkId + normalized page URL. */
export function pageFingerprint(checkId: string, url: string): string {
  return `${checkId}:${url}`;
}
```
Siempre `pageFingerprint(CHECK_ID, page.finalUrl ?? page.url)`, nunca concatenación manual.
Formato byte-idéntico al de `packages/psi/src/issues.ts:320` — de ahí la colisión de Pitfall 1.

### Forma de `IssueDraft`
**Source:** `packages/checks/src/types.ts:23-37`
**Apply to:** todo issue emitido por los checks nuevos
```typescript
export interface IssueDraft {
  checkId: string;
  category: string;
  title: string;
  severity: IssueSeverityValue;   // "critical" | "warning" | "ok"  — NO existe "error"
  measuredValue?: string;
  source?: string;
  criterion?: string;
  recommendation?: string;
  fingerprint: string;
  pageId?: string;
  scope?: string;
}
```
`IssueSeverityValue` (línea 4) confirma Pitfall 5: `"error"` de REQUIREMENTS.md mapea a `"critical"`.
Los page-level usan `pageId`, nunca `scope`.

### Aislamiento de dependencias del paquete `checks`
**Source:** `packages/checks/src/types.ts:6-13`
**Apply to:** todo archivo nuevo bajo `packages/checks/`
```typescript
/**
 * Mirrors `@auditor/render`'s `RenderVerdict` ..., but is redeclared locally so
 * `@auditor/checks` never takes a dependency on the worker-only,
 * Playwright-carrying `@auditor/render` package — apps/web depends on
 * `@auditor/checks` and must never resolve Playwright (see
 * scripts/assert-no-playwright-in-web.mjs).
 */
```
Los checks nuevos sólo importan de `../../types` y `../../util`. Cero imports de `@auditor/crawler`
(que sí aparece en `tech/canonical.ts:3` — legítimo ahí, pero innecesario aquí y peor para el boundary).

### Orden de imports por archivo de check
**Source:** `contentLength.ts:1-2`, `canonical.ts:1-3`
```typescript
import type { PageCheck } from "../../types";
import { pageFingerprint } from "../../util";
```
Tipos primero (`import type`), luego utilidades relativas, luego paquetes del workspace.

---

## No Analog Found

Ninguno. Los 9 archivos tienen analog directo en el repo.

---

## Metadata

**Analog search scope:** `packages/crawler/src`, `packages/checks/src`, `packages/db/prisma`
**Files scanned:** 12 leídos + listados de 3 directorios
**Pattern extraction date:** 2026-07-31
