# Phase 31: Validación de og:image - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 8 (4 nuevos, 4 modificados)
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/checks/src/checks/network/imageProbe.ts` (nuevo) | service / transport | request-response + streaming | `packages/checks/src/checks/network/linkChecker.ts` | role-match (transporte HTTP; no hay analog que lea body por streaming) |
| `packages/checks/src/checks/network/ogImageNetwork.ts` (nuevo) | check (`NetworkCheck`) | request-response, batch dedupe | `packages/checks/src/checks/network/brokenResources.ts` | exact |
| `packages/checks/src/checks/network/imageProbe.test.ts` (nuevo) | test (transporte) | request-response | `packages/psi/src/client.test.ts` | role-match |
| `packages/checks/src/checks/network/ogImageNetwork.test.ts` (nuevo) | test (clasificación) | batch | `packages/checks/src/checks/network/brokenExternalLinks.test.ts` | exact |
| `packages/checks/src/checks/network/index.ts` (modificado) | barrel / registro | — | él mismo (5 líneas) | exact |
| `packages/meta-social/src/thresholds.ts` (modificado) | config / constantes | — | él mismo | exact |
| `packages/checks/package.json` (modificado) | config | — | él mismo | exact |
| Helper SSRF compartido, ej. `packages/checks/src/checks/network/ssrfGuard.ts` (nuevo, si entra en alcance) | utility | request-response | **ninguno** | sin analog |

> Nota de nombre: ya existe `packages/checks/src/checks/social/ogImage.ts` (SOCIAL-03, `PageCheck`). El archivo nuevo debe llamarse distinto (`ogImageNetwork.ts`) para no tener dos `ogImage.ts` en el árbol.

## Contratos exactos que el código nuevo debe cumplir

**`NetworkCheck`** (`packages/checks/src/types.ts:80-83`):

```typescript
export interface NetworkCheck {
  checkId: string;
  run(ctx: SiteCheckCtx): Promise<IssueDraft[]>;
}
```

**`IssueDraft`** (`types.ts:23-37`) — sólo `checkId`, `category`, `title`, `severity` y `fingerprint` son obligatorios; `measuredValue`, `source`, `criterion`, `recommendation`, `pageId`, `scope` son opcionales.

**`SiteCheckCtx`** (`types.ts:46-67`) — el `NetworkCheck` recibe `pages`, `origin`, `robotsTxt`, `sitemapUrls`, `depthByUrl?`, `renderVerdictByPageId?`. **No recibe `$`**: cada `NetworkCheck` hace su propio `cheerio.load`.

**Fingerprints** (`packages/checks/src/util.ts:19-26`):

```typescript
export function pageFingerprint(checkId: string, url: string): string { return `${checkId}:${url}`; }
export function siteFingerprint(checkId: string, scope: string): string { return `${checkId}:${scope}`; }
```

---

## Pattern Assignments

### `packages/checks/src/checks/network/ogImageNetwork.ts` (NetworkCheck, request-response + dedupe)

**Analog:** `packages/checks/src/checks/network/brokenResources.ts` (78 líneas, copiar la estructura casi literal)

**Imports + constante de módulo** (`brokenResources.ts:1-7`):

```typescript
import * as cheerio from "cheerio";
import { normalizeUrl } from "@auditor/crawler";
import type { IssueDraft, NetworkCheck } from "../../types";
import { siteFingerprint } from "../../util";
import { checkLinks, MAX_URLS_PER_NETWORK_CHECK } from "./linkChecker";

const CHECK_ID = "TECH-13";
```

Para el archivo nuevo: `const CHECK_ID = "IMG-01";`, y en vez de `checkLinks` importar `probeImage` de `./imageProbe`, más `MAX_URLS_PER_NETWORK_CHECK` que se sigue importando de `./linkChecker` (es el único export compartible de ese módulo). Sumar `import { extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";` (patrón exacto de `social/ogImage.ts:1`).

**Recolección + dedupe** (`brokenResources.ts:16-36`) — el molde a copiar cambiando el selector por la lectura de `og:image`:

```typescript
export const brokenResourcesCheck: NetworkCheck = {
  checkId: CHECK_ID,
  async run({ pages }) {
    const resources = new Map<string, string>(); // normalized url -> source page

    for (const page of pages) {
      if (!page.html) continue;
      const baseUrl = page.finalUrl ?? page.url;
      const $ = cheerio.load(page.html);
      for (const { selector, attr } of RESOURCE_SELECTORS) {
        $(selector).each((_i, el) => {
          const value = $(el).attr(attr);
          if (!value) return;
          const normalized = normalizeUrl(value, baseUrl);
          if (!normalized) return;
          if (!resources.has(normalized)) resources.set(normalized, baseUrl);
        });
      }
    }

    if (resources.size === 0) return [];
```

Sustitución exacta del cuerpo del bucle para IMG-01 (una URL por página, no un selector múltiple):

```typescript
const raw = firstValue(extractMetaSocial($), "og:image");
if (!raw) continue;                        // SOCIAL-03 ya reporta la ausencia
const normalized = normalizeUrl(raw, baseUrl);
if (!normalized) continue;                 // data:/javascript:/no parseable → SOCIAL-03
```

> Si el planner elige la **opción A** del Pitfall 1 (fan-out de filas por página), el `Map<string, string>` pasa a `Map<string, string[]>` acumulando todas las páginas, y la emisión usa `pageFingerprint(CHECK_ID, pageUrl)` + `pageId` en lugar de `siteFingerprint` + `scope`. El dedupe del **fetch** se mantiene igual: `Array.from(map.keys())`.

**Cap + issue informativo** (`brokenResources.ts:38-57`) — copiar la forma literal, cambiando `category` a `"social"` y el `scope`:

```typescript
    const allUrls = Array.from(resources.keys());
    const urls = allUrls.slice(0, MAX_URLS_PER_NETWORK_CHECK);
    const results = await checkLinks(urls);

    const issues: IssueDraft[] = [];

    if (allUrls.length > urls.length) {
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Verificación de recursos limitada",
        severity: "ok",
        measuredValue: `Se verificaron ${urls.length} de ${allUrls.length} recursos únicos`,
        source: "",
        criterion: "En el plan gratuito se verifica una muestra de recursos para acotar el tiempo de auditoría",
        recommendation: "Sin acción necesaria. El resto de los recursos se verificarán en próximas auditorías o en un plan superior.",
        fingerprint: siteFingerprint(CHECK_ID, "resources-capped"),
        scope: "resources-capped",
      });
    }
```

`brokenExternalLinks.ts:65` usa `source: origin` en vez de `source: ""` para el mismo issue de cap. **Preferir `origin`** (el `""` de `brokenResources` es el outlier, y `report-model` deriva `url` de `source.split(" ")[0]`).

**Emisión por resultado** (`brokenResources.ts:58-74`):

```typescript
    for (const result of results) {
      if (result.ok) continue;
      const sourcePage = resources.get(result.url) ?? "";
      const scope = `resource:${result.url}`;
      issues.push({
        checkId: CHECK_ID,
        category: "tech",
        title: "Recurso roto (imagen, CSS o JS)",
        severity: "warning",
        measuredValue: result.status ? `HTTP ${result.status}` : result.reason,
        source: `${result.url} (referenciado desde ${sourcePage})`,
        criterion: "Los recursos referenciados (imágenes, CSS, JS) deben cargar correctamente",
        recommendation: "Corrige la ruta del recurso o restáuralo; ...",
        fingerprint: siteFingerprint(CHECK_ID, scope),
        scope,
      });
    }

    return issues;
```

**Desviación obligatoria para IMG-01:** el `if (result.ok) continue;` de `:59` **no aplica**. IMG-03/IMG-04 exigen filas para imágenes que sí cargan pero miden mal o pesan de más, así que hay que clasificar todo resultado.

**Rama "no verificable" (status bloqueado)** — copiar de `brokenExternalLinks.ts:17-27` + `:79-94`:

```typescript
function isBlockedStatus(status: number | null): boolean {
  if (status === null) return false;
  if (status === 401 || status === 402 || status === 403) return true;
  if (status === 405 || status === 406 || status === 429) return true;
  if (status >= 520) return true;
  return false;
}
```

y la emisión asociada (`brokenExternalLinks.ts:79-93`), que usa `severity: "ok"` + `scope` con subtipo + `continue`:

```typescript
      if (isBlockedStatus(result.status)) {
        const scope = `external-link-unverifiable:${result.url}`;
        issues.push({
          checkId: CHECK_ID,
          category: "tech",
          title: "Enlace externo no verificable",
          severity: "ok",
          measuredValue: `HTTP ${result.status}`,
          source: `${result.url} (enlazado desde ${sourcePage})`,
          criterion: "Algunos destinos bloquean bots o requieren autenticación/pago y no se pueden verificar automáticamente",
          recommendation: "No requiere acción: ... Confirmá el enlace manualmente si tenés dudas.",
          fingerprint: siteFingerprint(CHECK_ID, scope),
          scope,
        });
        continue;
      }
```

**Ojo con el copy:** ese `recommendation` es el único voceo residual del repo ("Confirmá", "tenés"). **No copiarlo.** El copy nuevo va en tuteo neutro, como toda Phase 30.

**Cap de texto controlado por el sitio** — patrón de `packages/checks/src/checks/social/ogImage.ts:1,16`:

```typescript
import { extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";

const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);
```

Aplicar `cap()` sólo a `measuredValue`. **Nunca a `scope`/`fingerprint`** (`brokenResources.ts:61` no recorta el scope; recortarlo colisionaría dos CDN URLs con prefijo común).

---

### `packages/checks/src/checks/network/imageProbe.ts` (service, transporte HTTP + streaming)

**Analog primario:** `packages/checks/src/checks/network/linkChecker.ts` (estructura, tipo de resultado, runner de concurrencia)
**Analog secundario:** `packages/checks/src/checks/aeo/llmsTxt.ts:13-26` (timeout con `clearTimeout` en `finally`)

**Constantes de módulo + tipo de resultado** (`linkChecker.ts:1-13`) — el molde de `ImageProbeResult`:

```typescript
const REQUEST_TIMEOUT_MS = 5_000;
const CONCURRENCY = 12;
/**
 * Hard cap on how many unique URLs a single network check will probe. ...
 */
export const MAX_URLS_PER_NETWORK_CHECK = 150;

export type LinkCheckResult =
  | { url: string; ok: true; status: number }
  | { url: string; ok: false; status: number | null; reason: string };
```

`REQUEST_TIMEOUT_MS` y `CONCURRENCY` **no están exportados**; `imageProbe.ts` declara los suyos con los mismos valores (5000 / 12) o el planner los extrae a un módulo compartido.

**Timeout + fetch abortable** (`linkChecker.ts:16-36`) — el patrón exacto, incluyendo el `clearTimeout` en ambas ramas:

```typescript
async function checkOne(url: string): Promise<LinkCheckResult> {
  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, signal: controller.signal, redirect: "follow" });
      clearTimeout(timeout);
      if (res.status >= 400) {
        if (method === "HEAD") continue; // retry with GET before giving up
        return { url, ok: false, status: res.status, reason: `HTTP ${res.status}` };
      }
      return { url, ok: true, status: res.status };
    } catch (error) {
      clearTimeout(timeout);
      if (method === "HEAD") continue;
      const message = error instanceof Error ? error.message : "unknown error";
      return { url, ok: false, status: null, reason: message };
    }
  }
  return { url, ok: false, status: null, reason: "unreachable" };
}
```

**Desviaciones obligatorias en `imageProbe`:**
- `redirect: "follow"` → `redirect: "manual"` con bucle propio de máximo 3 saltos, revalidando el destino en cada uno (Pitfall 4).
- Camino principal: **un solo GET con `Range: bytes=0-65535`**; HEAD sólo como fallback ante 405/501.
- Nunca `res.arrayBuffer()`: leer con `res.body.getReader()` y cancelar a los 64 KiB (Pitfall 3).
- Preferir la variante `finally { clearTimeout(timeout); }` de `llmsTxt.ts:23-25` sobre la duplicación de `clearTimeout` de `linkChecker.ts`.

**Timeout con `finally`** (`packages/checks/src/checks/aeo/llmsTxt.ts:13-26`):

```typescript
async function fetchText(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ok: false };
    const body = await res.text();
    return { ok: true, body };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
```

**Runner de concurrencia acotada** (`linkChecker.ts:38-55`) — copiar tal cual, o extraerlo a `mapWithConcurrency<T,R>` y hacer que `checkLinks` lo use también (refactor puro, sin cambio de comportamiento):

```typescript
export async function checkLinks(urls: string[]): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < urls.length) {
      const current = index++;
      const url = urls[current];
      if (url === undefined) continue;
      results[current] = await checkOne(url);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
```

El patrón preserva el orden (`results[current]`, índice preasignado), lo que el check consumidor asume al mapear resultado → página de origen.

---

### `packages/checks/src/checks/network/index.ts` (barrel / registro)

**Analog:** él mismo. Archivo completo (5 líneas efectivas):

```typescript
import type { NetworkCheck } from "../../types";
import { brokenExternalLinksCheck } from "./brokenExternalLinks";
import { brokenResourcesCheck } from "./brokenResources";

export const networkChecks: NetworkCheck[] = [brokenExternalLinksCheck, brokenResourcesCheck];

export { brokenExternalLinksCheck, brokenResourcesCheck };
```

Tres ediciones: `import`, entrada en el array, entrada en el re-export.

> `registry.ts:80-84` ya itera `networkChecks` secuencialmente dentro del `if (includeNetworkChecks)`; **no hay que tocar `registry.ts`**:
> ```typescript
>   if (includeNetworkChecks) {
>     for (const check of networkChecks) {
>       issues.push(...(await check.run(siteCtx)));
>     }
>   }
> ```

---

### `packages/meta-social/src/thresholds.ts` (config / constantes)

**Analog:** él mismo. Los umbrales de IMG (200×200, 600×315, 1.91:1, 1 MB, 5 MB) van acá, no en el archivo del check. El docblock del archivo lo exige ("This file is the single home for the category's thresholds because Phase 32 reuses them... No check file redeclares a threshold of its own", `thresholds.ts:10-13`).

**Forma de export a copiar** (`thresholds.ts:15-19`) — una constante nombrada por umbral, cada una con su docblock de una línea:

```typescript
/** Minimum recommended og:title length, in characters of the trimmed value. */
export const OG_TITLE_MIN = 10;

/** Maximum recommended og:title length, in characters of the trimmed value. */
export const OG_TITLE_MAX = 60;
```

Para listas, el patrón es anotación de tipo explícita, **no** `as const` (`thresholds.ts:65`, con la razón documentada arriba de la declaración):

```typescript
export const TWITTER_CARD_VALUES: readonly string[] = ["summary", "summary_large_image", "app", "player"];
```

Verificar que `packages/meta-social/src/index.ts` re-exporte los nuevos símbolos (hoy exporta `MAX_MEASURED_VALUE_CHARS`, que `social/ogImage.ts:1` importa directo del paquete).

---

### `packages/checks/package.json` (config)

**Analog:** él mismo (`packages/checks/package.json:16-22`):

```json
  "dependencies": {
    "@auditor/crawler": "workspace:*",
    "@auditor/db": "workspace:*",
    "@auditor/meta-social": "workspace:*",
    "cheerio": "^1.2.0",
    "robots-parser": "^3.0.1"
  },
```

Las dependencias externas se declaran con rango caret y versión exacta pineada por el lockfile. Comando: `pnpm --filter @auditor/checks add image-size@2.0.2`. Después correr `pnpm assert:web-boundary` (este paquete lo resuelve `apps/web`).

---

### `packages/checks/src/checks/network/ogImageNetwork.test.ts` (test de clasificación)

**Analog:** `packages/checks/src/checks/network/brokenExternalLinks.test.ts` (exact match)

**Mock del módulo de red + helper de contexto** (`brokenExternalLinks.test.ts:1-28`):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePage } from "../../testUtils";
import type { SiteCheckCtx } from "../../types";

// Mock the network layer so no real HTTP is issued — we only test how the
// check CLASSIFIES the statuses returned by checkLinks.
vi.mock("./linkChecker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./linkChecker")>();
  return { ...actual, checkLinks: vi.fn() };
});

import { checkLinks } from "./linkChecker";
import { brokenExternalLinksCheck } from "./brokenExternalLinks";

const mockedCheckLinks = vi.mocked(checkLinks);

function ctxWithExternalLinks(hrefs: string[]): SiteCheckCtx {
  const anchors = hrefs.map((h) => `<a href="${h}">x</a>`).join("");
  return {
    pages: [makePage({ url: "https://aprendoclub.com/", html: `<html><body>${anchors}</body></html>` })],
    origin: "https://aprendoclub.com",
    robotsTxt: null,
    sitemapUrls: [],
  } as unknown as SiteCheckCtx;
}

describe("brokenExternalLinksCheck classification", () => {
  beforeEach(() => mockedCheckLinks.mockReset());
```

Adaptación: `vi.mock("./imageProbe", ...)` con `probeImage: vi.fn()`, y el helper de contexto construye páginas con `<meta property="og:image" content="...">` en el `<head>`.

**Forma de aserción** (`brokenExternalLinks.test.ts:42-49`) — un `it` por rama de severidad, aserción sobre `severity` + `title`, no sobre el texto completo:

```typescript
    const issues = await brokenExternalLinksCheck.run(ctxWithExternalLinks(urls));

    expect(issues).toHaveLength(3);
    for (const issue of issues) {
      expect(issue.severity).toBe("ok");
      expect(issue.title).toBe("Enlace externo no verificable");
    }
```

**Fábrica de `Page` de test** (`packages/checks/src/testUtils.ts:4-22`) — usar siempre `makePage`, nunca construir el objeto a mano:

```typescript
export function makePage(overrides: Partial<Page> & { url: string }): Page {
  return {
    id: overrides.id ?? `page-${overrides.url}`,
    auditId: overrides.auditId ?? "audit-1",
    url: overrides.url,
    statusCode: overrides.statusCode ?? 200,
    html: overrides.html ?? null,
    finalUrl: overrides.finalUrl ?? overrides.url,
    // ...
  } as Page;
}
```

---

### `packages/checks/src/checks/network/imageProbe.test.ts` (test de transporte)

**Analog:** `packages/psi/src/client.test.ts` (stub del `fetch` global)

**Stub + limpieza** (`client.test.ts:1-18`):

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

function mockFetchOnce(response: { ok: boolean; status: number; json: () => Promise<unknown> }): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

describe("runPsi diagnostics wiring (PERF-05..09)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
```

Adaptación para `imageProbe`: el fake `Response` necesita `status`, `headers` (un `Headers` real, para `content-type` / `content-range` / `content-length`) y `body` como `ReadableStream` con un `getReader()` funcional, de modo que el test del corte a 64 KiB pueda emitir chunks indefinidamente y verificar que se llamó `reader.cancel()`.

**Fake timers cuando hay temporizadores en juego** (`client.test.ts:38-53`) — patrón para probar el timeout de 5 s sin esperar de verdad:

```typescript
    vi.useFakeTimers();
    try {
      // ...
      await vi.advanceTimersByTimeAsync(20_000);
      const result = await resultPromise;
      // ...
    } finally {
      vi.useRealTimers();
    }
```

**Nota:** `packages/checks` **no tiene `vitest.config.ts`** — corre con los defaults. No agregar uno.

---

### Helper SSRF (sin analog)

No existe ninguna defensa SSRF en el repo hoy: `linkChecker.ts:21` usa `redirect: "follow"` sin tope y sin validar destino, y `llmsTxt.ts:17` sólo golpea el propio `origin`. El planner debe construirlo desde cero siguiendo `RESEARCH.md → Pitfall 4` (`dns.promises.lookup(host, {all:true})` + `net.isIP` + tabla de rangos privados, `redirect: "manual"` con tope de 3 saltos). Si se decide extenderlo a TECH-12/TECH-13, el punto de inserción es `linkChecker.ts:16-36` (dentro de `checkOne`, antes del `fetch`).

---

## Shared Patterns

### Fingerprint con subtipo dentro del `scope`
**Source:** `packages/checks/src/util.ts:24-26`, uso en `brokenResources.ts:61,71` y `brokenExternalLinks.ts:80,96`
**Apply to:** toda emisión site-level de `ogImageNetwork.ts`

```typescript
const scope = `resource:${result.url}`;
// ...
fingerprint: siteFingerprint(CHECK_ID, scope),
scope,
```

El subtipo va **dentro del scope**, nunca en el `checkId`. Resultado: `IMG-01:og-image-too-small:https://cdn.ejemplo.com/og.png`.

### `category` como string literal en cada issue
**Source:** `brokenResources.ts:47` (`"tech"`), `social/ogImage.ts:35` (`"social"`)
**Apply to:** todas las filas de IMG-01 → `category: "social"` (decisión bloqueada de CONTEXT.md), pese a que el patrón técnico venga de un check `tech`.

### Formato de `source` con la URL primero
**Source:** `brokenResources.ts:68`
**Apply to:** toda fila con URL de recurso

```typescript
source: `${result.url} (referenciado desde ${sourcePage})`,
```

`packages/report-model/src/build.ts:103-108` deriva `ReportIssue.url` de `source.split(" ")[0]`, así que lo que va primero es lo que la UI renderiza como enlace. Si se elige el fan-out por página (opción A), poner la URL de la **página** primero y la de la imagen en `measuredValue`.

### Cap de texto controlado por el sitio auditado
**Source:** `packages/meta-social/src/thresholds.ts:45` + `packages/checks/src/checks/social/ogImage.ts:16`
**Apply to:** todo `measuredValue` que contenga la URL de la imagen

```typescript
const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);
```

Nunca aplicarlo a `scope` ni a `fingerprint`.

### Issue "ok" informativo, nunca error, ante un límite o una imposibilidad de verificar
**Source:** `brokenResources.ts:44-57` (cap), `brokenExternalLinks.ts:79-93` (status bloqueado)
**Apply to:** cap de 150 imágenes, dimensiones indeterminadas, status 401/403/429/999/≥520

La disciplina anti-falso-positivo del proyecto: `severity: "ok"` con `recommendation` que empieza por "Sin acción necesaria" o "No requiere acción".

### Salida temprana antes de tocar la red
**Source:** `brokenResources.ts:36`, `brokenExternalLinks.ts:49`

```typescript
if (resources.size === 0) return [];
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ssrfGuard.ts` (o equivalente) | utility | request-response | Ninguna defensa SSRF existe hoy en el repo; los tres `NetworkCheck` actuales fetchean sin validar destino y con `redirect: "follow"` sin tope |
| Lectura de body por streaming con corte de bytes | transport (parte de `imageProbe.ts`) | streaming | Todo el I/O de red actual del repo consume la respuesta entera (`res.text()` en `llmsTxt.ts:19`, `res.json()` en `psi/src/client.ts`) o ninguna (`linkChecker.ts` sólo mira el status). No hay precedente de `res.body.getReader()` |

---

## Metadata

**Analog search scope:** `packages/checks/src/checks/network/`, `packages/checks/src/checks/social/`, `packages/checks/src/checks/aeo/`, `packages/checks/src/` (types, util, registry, testUtils), `packages/meta-social/src/`, `packages/psi/src/`
**Files scanned:** 13
**Pattern extraction date:** 2026-08-03
