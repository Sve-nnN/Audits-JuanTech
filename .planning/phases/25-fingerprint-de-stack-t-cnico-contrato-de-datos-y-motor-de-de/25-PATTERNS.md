# Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 12 (nuevo paquete `@auditor/fingerprint` + captura en crawler + columnas DB)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/fingerprint/package.json` | config | — | `packages/graph/package.json` | exact |
| `packages/fingerprint/tsconfig.json` | config | — | `packages/graph/tsconfig.json` | exact |
| `packages/fingerprint/src/index.ts` | index/barrel | — | `packages/graph/src/index.ts` | exact |
| `packages/fingerprint/src/types.ts` | model (types) | transform | `packages/graph/src/types.ts` + `packages/checks/src/types.ts` | exact |
| `packages/fingerprint/src/detectStack.ts` | service (pure engine) | transform | `packages/checks/src/index.ts` (`runAllChecks`) | role-match |
| `packages/fingerprint/src/signatures/registry.ts` | registry | transform | `packages/checks/src/registry.ts` | exact |
| `packages/fingerprint/src/signatures/{cms,builder,cdn,hosting,jsFramework,analytics}.ts` | utility (signatures) | transform | `packages/checks/src/checks/schema/index.ts` (check module arrays) | role-match |
| `packages/fingerprint/src/__fixtures__/*.ts` | test fixture | — | `packages/checks/src/testUtils.ts` | role-match |
| `packages/fingerprint/src/*.test.ts` | test | — | `packages/scoring/src/categoryScore.test.ts` | exact |
| `packages/crawler/src/crawl.ts` (modificar) | crawler capture | request-response | self (`requestHandler` líneas 99-139) | in-place |
| `packages/crawler/src/*.test.ts` (nuevo) | test | — | `packages/scoring/src/categoryScore.test.ts` | role-match |
| `packages/db/prisma/schema.prisma` (modificar `Page`) | model/migration | — | self (`schemaGraph`/`schemaJson` líneas 118-121) | in-place |

## Pattern Assignments

### `packages/fingerprint/package.json` (config)

**Analog:** `packages/graph/package.json` (leído completo, líneas 1-24).

Copiar el shape exacto, cambiando el nombre a `@auditor/fingerprint` y **eliminando la dependencia `@auditor/crawler`** (el motor es puro, decisión de CONTEXT: desacoplado en runtime). Mantener solo `cheerio` como dependencia de runtime.

```json
{
  "name": "@auditor/fingerprint",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "cheerio": "^1.2.0" },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2",
    "vitest": "^4.1.9"
  }
}
```

Nota: `@auditor/graph` sí depende de `@auditor/crawler` — NO copiar esa línea aquí. El contrato de fingerprint define su propio `PageFingerprintInput`, sin importar `Page` de Prisma ni tipos del crawler.

---

### `packages/fingerprint/tsconfig.json` (config)

**Analog:** `packages/graph/tsconfig.json` (líneas 1-9). Copiar textual, sin cambios:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "lib": ["ES2022"], "types": ["node"] },
  "include": ["src"]
}
```

---

### `packages/fingerprint/src/index.ts` (barrel)

**Analog:** `packages/graph/src/index.ts` (líneas 1-2). Mismo patrón: export de la función + `export type` de los tipos públicos.

```typescript
export { detectStack } from "./detectStack";
export type {
  DetectedStack, AxisResult, Confidence, Signal, SignalStrength,
  Axis, PageFingerprintInput, Signature,
} from "./types";
```

---

### `packages/fingerprint/src/types.ts` (model, transform)

**Analog para el estilo de "tipo desacoplado":** `packages/graph/src/types.ts` (líneas 1-11) — el comentario `GraphPage` documenta explícitamente por qué el paquete redeclara una forma mínima de `Page` "decoupled from `@auditor/db` so the package stays pure". Replicar ese mismo comentario justificando `PageFingerprintInput`.

**Analog para el patrón registry-interface:** `packages/checks/src/types.ts` (líneas 69-83) — `PageCheck { checkId; run(ctx) }` es el análogo directo de `Signature { id; axis; test(ctx) }`.

Definir aquí: `Axis`, `Confidence`, `SignalStrength`, `Signal`, `AxisResult`, `DetectedStack`, `PageFingerprintInput`, `Signature`, `AggregatedInput`. El contrato completo ya está redactado en RESEARCH.md "Pattern 2" (líneas 235-279) — usarlo como fuente literal.

Puntos clave del contrato (de CONTEXT):
- `DetectedStack.analytics` es `AxisResult[]` (array), el resto son `AxisResult` único.
- `AxisResult = { value: string | null, confidence, signals: Signal[] }`.
- `Signature.test(ctx): number` devuelve **conteo** de marcadores (no boolean) para permitir el desempate de builders.

---

### `packages/fingerprint/src/detectStack.ts` (service, pure transform)

**Analog:** `packages/checks/src/index.ts` `runAllChecks` (líneas 52-83) — el patrón orquestador puro: itera páginas, `cheerio.load(page.html)` una vez por página (línea 61), corre cada elemento del registry, agrega resultados. Copiar este flujo de "load HTML once, run registry, collect".

**Import de cheerio** (mismo que checks línea 1):
```typescript
import * as cheerio from "cheerio";
```
Usar selectores cheerio para marcadores estructurales (`$('[class*="elementor-"]')`, `$('script#__NEXT_DATA__')`) en vez de regex — anti-pattern documentado en RESEARCH (líneas 303, 310). Regex solo para comentarios `<!-- wp:` y paths en atributos, y siempre lineal (mitigación ReDoS, V5 Input Validation).

**Esqueleto orquestador:** ya redactado en RESEARCH.md "Code Examples" (líneas 433-469). Incluye `aggregate()` (normaliza headers a lowercase, une cookieNames, elige HTML home→fallback, trunca a ~256KB), `resolveAxis`, `resolveBuilder`, `resolveAnalytics`, `emptyAxis`.

**Resolvedor de confianza** (reglas explícitas, no score numérico) — RESEARCH líneas 287-296:
```typescript
function resolveConfidence(signals: Signal[]): Confidence {
  const strong = signals.filter((s) => s.strength === "fuerte").length;
  const weak = signals.filter((s) => s.strength === "debil").length;
  if (strong >= 2) return "alto";
  if (strong === 1 && isUnequivocal(signals)) return "alto";
  if (strong === 1) return "medio";
  if (weak >= 1) return "bajo";
  return "no-detectado"; // 0 señales → NUNCA forzar (FPRINT-08)
}
```

Regla dura builder: si `cms.value === "WordPress"` y ningún builder matchea → `emptyAxis()`. Nunca default a Gutenberg (Gutenberg necesita marcador positivo propio).

---

### `packages/fingerprint/src/signatures/registry.ts` (registry, transform)

**Analog:** `packages/checks/src/registry.ts` (líneas 17-24) — agrega arrays de checks por tipo (`onPageChecks`, `techPageChecks`, ...) en listas combinadas. Replicar: importar el array de signatures de cada eje y exponer un objeto `registry: Record<Axis, Signature[]>`.

```typescript
import { cmsSignatures } from "./cms";
import { builderSignatures } from "./builder";
import { cdnSignatures } from "./cdn";
import { hostingSignatures } from "./hosting";
import { jsFrameworkSignatures } from "./jsFramework";
import { analyticsSignatures } from "./analytics";
import type { Axis, Signature } from "../types";

export const registry: Record<Axis, Signature[]> = {
  cms: cmsSignatures, builder: builderSignatures, cdn: cdnSignatures,
  hosting: hostingSignatures, jsFramework: jsFrameworkSignatures,
  analytics: analyticsSignatures,
};
```

---

### `packages/fingerprint/src/signatures/{cms,builder,cdn,hosting,jsFramework,analytics}.ts` (utility, transform)

**Analog:** `packages/checks/src/checks/schema/index.ts` (líneas 1-20) — cada módulo exporta un array tipado de objetos-regla (`schemaPageChecks: PageCheck[] = [...]`). Aquí cada archivo exporta `xxxSignatures: Signature[] = [...]`.

Cada `Signature` es un objeto declarativo `{ id, axis, value, strength, test(ctx) }`. Las tablas de firmas concretas por eje (headers/cookies/HTML markers, marcadas `[fuerte]`/`[debil]`) están en RESEARCH.md "Signatures por eje" (líneas 317-392):
- cms.ts → líneas 321-330 (WordPress, Shopify, Webflow, Wix, Squarespace)
- builder.ts → líneas 373-386 (Elementor, WPBakery, Divi, Gutenberg; `test` devuelve conteo para desempate)
- cdn.ts → líneas 334-342 (Cloudflare, Fastly, Akamai, CloudFront)
- hosting.ts → líneas 344-352 (Vercel, Netlify, WP Engine; nginx/Apache débil; no-detectado bajo CDN)
- jsFramework.ts → líneas 354-362 (Next.js, Nuxt, React, Vue)
- analytics.ts → líneas 364-371 (GA4, GTM, Meta Pixel)

---

### `packages/fingerprint/src/*.test.ts` (test)

**Analog:** `packages/scoring/src/categoryScore.test.ts` (líneas 1-30) — estructura Vitest estándar del monorepo: `import { describe, it, expect } from "vitest"`, sin config custom, aserciones `toEqual`. Un test por eje, cada uno alimentando un fixture a `detectStack` y verificando `{ value, confidence }`.

```typescript
import { describe, it, expect } from "vitest";
import { detectStack } from "./detectStack";
import { shopifyPage } from "./__fixtures__/shopify";

describe("detectStack cms", () => {
  it("detects Shopify with alta confianza", () => {
    const r = detectStack({ pages: [shopifyPage] });
    expect(r.cms).toMatchObject({ value: "Shopify", confidence: "alto" });
  });
});
```

Cubrir explícitamente FPRINT-08: input sin señales → `{ value: null, confidence: "no-detectado" }`; WordPress sin builder → builder no-detectado (nunca Gutenberg).

---

### `packages/fingerprint/src/__fixtures__/*.ts` (test fixture)

**Analog:** el ejemplo de fixture ya está en RESEARCH.md líneas 473-481 (`shopifyPage: PageFingerprintInput`). Uno por firma (CMS/builder/CDN/framework/analytics). Son objetos `PageFingerprintInput` con `html`, `responseHeaders` (keys lowercase — Pitfall 5), `cookieNames`, `isHome`.

---

### `packages/crawler/src/crawl.ts` (MODIFICAR — captura headers/cookies)

**Punto de inserción:** dentro de `requestHandler(ctx)`, entre línea 108 (`statusCode`) y el `prisma.page.upsert` (línea 114). `ctx.response.headers` ya está disponible aquí (destructurado en línea 100). NO agregar requests.

**Añadir dos derivaciones** (código completo en RESEARCH líneas 196-227):
```typescript
const responseHeaders = curateHeaders(response?.headers ?? {});
const cookieNames = parseCookieNames(response?.headers?.["set-cookie"]);
```
Con `CURATED_HEADER_KEYS`, `curateHeaders()` y `parseCookieNames()` como helpers a nivel de módulo (arriba, junto a las otras constantes líneas 7-22).

**Añadir a ambos bloques del upsert** (`create` líneas 114-128 y `update` líneas 129-138), siguiendo el estilo de los campos existentes:
```typescript
responseHeaders: responseHeaders as never,  // Json — mismo cast que redirectChain (línea 122)
cookieNames,                                 // String[]
```
Notas: `response.headers` de got-scraping entrega keys en minúscula y `set-cookie` como `string[]` (Pitfall 3/5, código defensivo `Array.isArray(...)` ya en el helper). Cookies: solo nombres, nunca valores.

---

### `packages/db/prisma/schema.prisma` (MODIFICAR — modelo `Page`)

**Analog in-place:** líneas 118-121, columnas `schemaGraph Json?` y `schemaJson Json?` — patrón Json aditivo/nullable con comentario de fase. Añadir junto a ellas:
```prisma
  /** Headers HTTP curados relevantes a fingerprinting (server, x-powered-by, cf-ray, ...) — Phase 25 (FPRINT-01). */
  responseHeaders Json?
  /** Nombres de cookie (no valores) parseados de Set-Cookie — Phase 25 (FPRINT-01). */
  cookieNames     String[]
```
`String[]` en Postgres default a array vacío; `Json?` es nullable. Ambas aditivas — audits previos simplemente no las pueblan (idéntico a `schemaGraph`).

**Convención establecida:** schema-first, sin carpeta migrations. Correr `pnpm db:push` contra Neon tras editar el schema, antes de probar con datos reales (CONTEXT / STATE.md).

## Shared Patterns

### Paquete puro desacoplado del monorepo
**Source:** `packages/graph/` y `packages/scoring/` (package.json + tsconfig.json + index.ts barrel)
**Apply to:** todo `packages/fingerprint`
- `main`/`types` apuntan a `./src/index.ts` (sin build step para consumo interno).
- Redeclarar tipos mínimos de input en vez de importar `@auditor/db` (patrón `GraphPage`, graph/types.ts líneas 1-11). El motor NO importa `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime.

### Registry de reglas declarativas
**Source:** `packages/checks/src/types.ts` (líneas 69-83) + `packages/checks/src/registry.ts` (líneas 17-24)
**Apply to:** `types.ts` (`Signature` interface), `signatures/*.ts` (arrays), `registry.ts` (agregación)
- Cada regla es un objeto `{ id, ...metadata, run/test(ctx) }`; los módulos exportan arrays; el registry los combina. Idéntico a como checks combina `PageCheck[]`/`SiteCheck[]`.

### Orquestación pura sobre HTML con cheerio
**Source:** `packages/checks/src/index.ts` `runAllChecks` (líneas 52-83)
**Apply to:** `detectStack.ts`
- `import * as cheerio from "cheerio"` (línea 1); `cheerio.load(html)` una vez por página (línea 61); guardas `if (!page.html) continue`. Preferir selectores sobre regex (mitigación ReDoS, V5).

### Columnas Json/array aditivas en `Page` + `db:push`
**Source:** `Page.schemaGraph`/`Page.schemaJson` (schema.prisma líneas 118-121); escritura en worker (apps/worker/src/index.ts líneas 548-550)
**Apply to:** `Page.responseHeaders` / `Page.cookieNames`
- Nullable/aditivas, comentario de fase, `pnpm db:push` schema-first. El wiring de escritura post-crawl vía `page.update` (worker línea 550) es el patrón que Phase 26 replicará — NO en esta fase.

### Test Vitest sin config
**Source:** `packages/scoring/src/categoryScore.test.ts` (líneas 1-30)
**Apply to:** todos los `*.test.ts` de fingerprint y crawler
- `import { describe, it, expect } from "vitest"`; `pnpm --filter @auditor/fingerprint test`; sin archivo de config.

## No Analog Found

Ninguno. Todos los archivos nuevos tienen un análogo directo en el repo (paquetes puros `graph`/`scoring`, registry de `checks`, columnas aditivas de `Page`, captura en `crawl.ts`).

## Metadata

**Analog search scope:** `packages/{graph,scoring,checks,crawler,db}`, `apps/worker/src/index.ts`
**Files scanned:** graph (package.json, tsconfig.json, index.ts, types.ts), checks (types.ts, registry.ts, index.ts, schema/index.ts), scoring (categoryScore.test.ts), crawler (crawl.ts líneas 1-150), db (schema.prisma modelo Page), worker (grep escritura schema)
**Pattern extraction date:** 2026-07-21
