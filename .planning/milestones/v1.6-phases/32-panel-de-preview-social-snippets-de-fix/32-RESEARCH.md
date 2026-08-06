# Phase 32: Panel de preview social + snippets de fix - Research

**Researched:** 2026-08-03
**Domain:** Server-derived social preview rendering + image proxy (SSRF-safe) inside an existing Next.js App Router report
**Confidence:** HIGH (todo lo afirmado abajo viene de leer el código real del repo, no de training data — única excepción marcada `[ASSUMED]`)

## Summary

Esta fase no introduce stack nuevo: es 100% composición sobre infraestructura ya construida en Phase 30/31. La pieza de research con más valor es dónde vive la derivación de datos del preview. `STATE.md` ya fija la convención del proyecto: *"lo derivado de v1.6 (preview social, snippet de fix, perf por página) se resuelve en lectura ahí [buildReportModel], mismo patrón que el fingerprint/CMS de v1.5"*. Eso significa que el parseo de `Page.html` con `extractMetaSocial` (Phase 30) NO debe vivir en `apps/web/app/audits/[id]/page.tsx` ni en un componente cliente — debe vivir en `packages/report-model/src/build.ts`, produciendo un campo nuevo y serializable en `ReportModel` (`socialPreviews`). Esto satisface también la restricción de `32-CONTEXT.md` ("nunca tocar `page.html` crudo desde el componente React ni parsear en el browser").

Se encontraron tres gaps concretos de código que el plan debe cerrar antes de que la UI pueda montarse:
1. `ReportIssue` (en `@auditor/report-model`) no expone `pageId` — sólo `url` derivado. Sin `pageId` no se puede hacer `prisma.page.findMany({ where: { id: { in: [...] } } })` de forma confiable (URL no es una clave robusta: trailing slash, `www.`, redirects). El dato YA está en la fila de Prisma (`Issue.pageId`); sólo falta pasarlo a través del mapeo.
2. El subtipo de un hallazgo de IMG-01 (p. ej. `og-image-unreachable` vs `og-image-suboptimal`) sólo existe embebido en `Issue.fingerprint` (`"IMG-01:og-image-unreachable:https://..."`) — la columna `Issue.checkId` es siempre el string plano `"IMG-01"` (decisión Phase 30). Las constantes de subtipo son `const` privados de módulo en `ogImageNetwork.ts`, no exportados. Hace falta exportarlos (o un helper de parseo) para que Phase 32 decida "placeholder vs proxy" sin volver a inventar el vocabulario.
3. Las defensas SSRF de Phase 31 (`assertPublicDestination`, `pinnedDispatcher`) viven en `packages/checks/src/checks/network/ssrfGuard.ts` pero **no se re-exportan** desde el barrel `network/index.ts` ni desde el índice raíz de `@auditor/checks`. Hoy sólo se pueden importar con un deep-import que el `exports` map de `package.json` bloquea (`"."` y `"./validate"` son los únicos subpaths declarados). Hace falta añadir el re-export.

Ninguno de estos tres gaps requiere una migración de base de datos ni una dependencia npm nueva — son cambios aditivos y de bajo riesgo en paquetes que ya son dependencias existentes de `apps/web`.

**Primary recommendation:** Extender `buildReportModel` (no `page.tsx`, no un componente cliente) para producir `ReportModel.socialPreviews: Record<pageId, SocialPreviewData>` reusando `@auditor/meta-social`; exportar los tres símbolos de Phase 31 que hoy están atrapados como privados de módulo; montar `SocialPreviewPanel` desde dentro de `IssueTypeGroup` vía un prop nuevo opcional, tal como fija `32-UI-SPEC.md`.

## User Constraints

<user_constraints>
### Locked Decisions

- Sección nueva dentro del reporte existente en `/audits/[id]` — no ruta propia.
- Sólo se muestra para páginas con al menos un issue de categoría `social`. Sin cap adicional de cantidad de páginas.
- Los 3 layouts (Google/FB-LinkedIn/X) van en tabs dentro de la misma card de página — 1 página = 1 componente con 3 sub-vistas.
- Extender `CategoryAccordion`/`IssueTypeGroup` ya existentes para insertar el panel dentro del flujo de issues de la categoría social, en vez de crear un componente de nivel superior nuevo y desconectado.
- Preview Google (SERP): mockup CSS puro, nunca screenshot real (Out of Scope en REQUIREMENTS.md).
- Preview Facebook/LinkedIn: un solo componente compartido (layout 1.91:1).
- Preview X/Twitter: un componente con 2 variantes (`summary` vs `summary_large_image`) derivadas del valor real de `twitter:card` ya extraído en Phase 30.
- Fuente de los datos del preview: reusar `packages/meta-social` (motor puro de Phase 30), nunca volver a tocar `page.html` crudo desde el componente React ni parsear en el browser.
- Route del proxy: `apps/web/app/api/audits/[id]/preview-image/route.ts`, Node runtime.
- Allowlist: sólo permite proxear URLs cuyo origin coincide EXACTAMENTE con el origin de `audit.resolvedUrl`. Nunca hotlink directo desde el cliente.
- Snippet de fix: reusa `packages/meta-social`, genera HTML con valores REALES extraídos de esa página específica, nunca un template genérico.
- Botón de copiar: extiende el patrón de Clipboard API con fallback ya resuelto en `ExportMenu.tsx`.
- Si una og:image ya fue marcada `critical`/no verificable por IMG-01, el preview muestra placeholder — el proxy nunca intenta cargar una URL que Phase 31 ya determinó rota.
- Botón "copiar" es un `<button>` real con foco visible, nunca un `div` con `onClick`.
- El panel no se renderiza en absoluto para páginas sin ningún issue de categoría `social`.

### Claude's Discretion

- Nombres exactos de los componentes nuevos y su ubicación exacta (resuelto en `32-UI-SPEC.md`: carpeta propia `apps/web/app/audits/[id]/social/`).
- Estructura exacta de tabs vs. acordeón interno (resuelto en UI-SPEC: tabs WAI-ARIA manual-activation).
- Redacción exacta de los textos/labels (resuelto en UI-SPEC `## Copywriting Contract`).
- Estrategia exacta de CSP/allowlist adicional en `next.config.ts` (resuelto en UI-SPEC: no CSP nueva, sólo posible `transpilePackages`).

### Deferred Ideas (OUT OF SCOPE)

- Previews de WhatsApp/Discord/Slack/Telegram (SOCIAL-10) — diferido a v1.6.x/v1.7.
- Editor de preview interactivo (cambiar texto y ver la card actualizarse en vivo) — v2, fuera del modelo "detecta y recomienda, no produce".
- CMSFIX-08 (snippets por CMS vía cms-adapters) — diferido a v1.7/backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREVIEW-01 | Preview Google (estilo SERP) | `GooglePreview.tsx` (mockup CSS, ver UI-SPEC); datos desde `SocialPreviewData.ogTitle`/`ogDescription`/`ogUrl` o fallback `<title>`/meta description existentes |
| PREVIEW-02 | Preview Facebook/LinkedIn (layout 1.91:1 compartido) | `SocialCardPreview.tsx`; datos desde `SocialPreviewData.ogTitle`/`ogDescription`/`ogImage` + `imageStatus` |
| PREVIEW-03 | Preview X/Twitter (summary vs summary_large_image) | `XPreview.tsx`; variante resuelta server-side en `buildReportModel` contra `TWITTER_CARD_VALUES` (`@auditor/meta-social`), con fallback OG idéntico al de SOCIAL-07 (`twitterCard.ts`) |
| PREVIEW-04 | Proxy server-side con allowlist del origen auditado, sin hotlink directo | `apps/web/app/api/audits/[id]/preview-image/route.ts`, Node runtime, allowlist exacto sobre `audit.resolvedUrl` origin + reuso del SSRF guard de Phase 31 |
| FIX-01 | Snippet HTML prellenado con valores reales de la página | Función pura recomendada en `@auditor/meta-social` (o `report-model`), input = `SocialPreviewData` + lista de checkIds fallidos de esa página |
| FIX-02 | Snippet accesible/copiable en el panel | `FixSnippet.tsx` reusando el patrón exacto de `ExportMenu.tsx` (Clipboard API + fallback a descarga) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extracción de meta OG/Twitter desde `page.html` | Frontend Server (SSR) — `packages/report-model` (`buildReportModel`) | — | Convención ya fijada en `STATE.md`: todo lo derivado de v1.6 se resuelve en lectura dentro de `buildReportModel`, no en el componente de página ni en el cliente |
| Decisión placeholder-vs-proxy de imagen (IMG-01) | Frontend Server (SSR) — `packages/report-model` | — | Depende de `Issue` rows ya cargadas por `buildReportModel`; el componente cliente sólo debe recibir un enum ya resuelto (`imageStatus`) |
| Generación del snippet HTML de fix | Frontend Server (SSR) o pure package (`@auditor/meta-social`) | — | Debe usar valores reales ya extraídos; nunca se genera ni se completa en el browser |
| Renderizado de los 3 layouts (Google/FB/X) | Browser / Client | — | Componentes puramente presentacionales (`"use client"`), reciben `SocialPreviewData` ya resuelto como props, cero fetch/parseo propio |
| Proxy de bytes de imagen | API / Backend — App Router route handler (Node runtime) | — | Necesita `fetch` a un origen arbitrario del sitio auditado + control fino de headers de respuesta; no puede vivir en Edge ni en el cliente (hotlink prohibido) |
| Copiar snippet al portapapeles | Browser / Client | — | `navigator.clipboard` es una API sólo de browser; el fallback de descarga también es client-side (mismo patrón que `ExportMenu`) |

## Standard Stack

Sin librerías nuevas. Esta fase es composición sobre paquetes ya instalados.

### Core (ya instalado, reusado)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cheerio` | `1.2.0` [VERIFIED: npm registry — `npm view cheerio version` → `1.2.0`] | Parseo de `page.html` server-side | Ya es la dependencia única de runtime de `@auditor/meta-social`; el resto del repo la usa igual |
| `@auditor/meta-social` | workspace | Extracción pura de tags OG/Twitter + umbrales/constantes compartidas | Diseñado explícitamente en Phase 30 para ser reusado por esta fase (docblock de `types.ts`: *"Phase 32 can reuse it from the Vercel graph"*) |
| `lucide-react` | `^1.23.0` [CITED: `32-UI-SPEC.md`] | Iconos (`ClipboardCopy`, `Check`, `ImageOff`, `AlertTriangle`) | Ya instalado; UI-SPEC ya confirmó Registry Safety PASS |

### Supporting (requieren wiring, no instalación)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@auditor/checks` (subset: `ssrfGuard.ts`, `redirects.ts`) | workspace | Reuso de la defensa SSRF de Phase 31 en el proxy de imágenes | El proxy NUNCA debe reimplementar `assertPublicDestination`/`pinnedDispatcher` — debe importarlos, una vez exportados (ver Gap 3 abajo) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusar `ssrfGuard.ts` de `@auditor/checks` | Reimplementar una validación de origin-only (sin resolución DNS/pinning) en el route handler | Más simple pero MÁS DÉBIL: un origin-match no protege contra que el DNS del sitio auditado resuelva (hoy o en el futuro) a una IP privada. `32-CONTEXT.md` exige explícitamente "reusar o espejar" el patrón de Phase 31, no una versión reducida |
| Derivar el preview en `buildReportModel` | Derivarlo ad-hoc en `page.tsx` (mismo patrón que `pages/[pageId]/page.tsx` con `extractEntitiesFromHtml`) | Técnicamente funciona (hay precedente exacto en el repo) pero contradice la convención explícita de `STATE.md` para v1.6 y dejaría la lógica fuera de la única fuente de verdad que alimenta también los 3 exports (`@auditor/export`) — si más adelante se quiere el preview social en el PDF/PPTX, ya estaría disponible en el modelo |

**Installation:** Ninguna — todo son cambios de código en paquetes ya presentes en el workspace, más 1-2 líneas de `package.json` (`@auditor/meta-social` + `cheerio` como dependencias de `@auditor/report-model`).

## Package Legitimacy Audit

No aplica — cero dependencias npm nuevas en esta fase (confirmado por `32-UI-SPEC.md` `## Registry Safety`: *"No se introduce ninguna dependencia npm nueva en esta fase"*). `cheerio@1.2.0` ya está instalado y verificado contra el registro (`npm view cheerio version`).

## Concrete Gaps to Close (blocking, found by reading the actual code)

### Gap 1 — `ReportIssue` no expone `pageId`

`packages/report-model/src/model.ts` (`ReportIssue`) y `packages/report-model/src/build.ts` (`IssueRow`, `toReportIssue`) sólo derivan `url` desde `source`/`scope`. El dato `Issue.pageId` YA llega en la fila cruda de Prisma (`issuesForDetail` en `build.ts` no usa `select`, trae la columna completa) — sólo falta:
1. Añadir `pageId: string | null` a `interface IssueRow` (`build.ts` línea ~82-95).
2. Añadir `pageId: string | null` a `interface ReportIssue` (`model.ts` línea ~20-34).
3. Pasar `pageId: issue.pageId` en `toReportIssue()` (`build.ts` línea ~124-143).

Sin esto, resolver "¿qué `Page.id` corresponde a este issue de categoría social?" obligaría a re-matchear por URL (frágil: trailing slash, `www.`, y `Page.url` vs `Page.finalUrl` no son la misma columna que `ReportIssue.url`).

### Gap 2 — Subtipo de IMG-01 no es recuperable desde la fila persistida

`Issue.checkId` para toda fila de IMG-01 es siempre el string plano `"IMG-01"` (decisión deliberada de Phase 30: *"checkId plano ... con subtipo sólo en el fingerprint"*). El subtipo real (`og-image-unreachable`, `og-image-unverifiable`, `og-image-svg`, `og-image-not-image`, `og-image-too-small`, `og-image-suboptimal`, `og-image-heavy`, `og-image-too-large`, `og-image-undetermined`) vive SÓLO como fragmento del `fingerprint`, con el formato exacto:

```
"IMG-01:<subtype>:<pageUrl>"
```

(`packages/checks/src/checks/network/ogImageNetwork.ts` línea ~300: `fingerprint: pageFingerprint(\`${CHECK_ID}:${finding.subtype}\`, affected.url)`, y `pageFingerprint(checkId, url) = \`${checkId}:${url}\`` en `packages/checks/src/util.ts`).

Las 9 constantes de subtipo (`UNREACHABLE_SUBTYPE`, `UNVERIFIABLE_SUBTYPE`, `SVG_SUBTYPE`, `NOT_IMAGE_SUBTYPE`, `TOO_SMALL_SUBTYPE`, `SUBOPTIMAL_SUBTYPE`, `HEAVY_SUBTYPE`, `TOO_LARGE_SUBTYPE`, `UNDETERMINED_SUBTYPE`) son hoy `const` privados de módulo en `ogImageNetwork.ts` (líneas 24-33), no exportados.

**Regla de decisión exacta que la fase necesita ("¿placeholder o proxy?")**, derivada de `severity` (columna real, siempre disponible) + el subtipo:

| Subtipo | Severity | ¿Imagen realmente cargable? | Decisión del panel |
|---------|----------|------------------------------|---------------------|
| `og-image-unreachable` | critical | No | Placeholder |
| `og-image-svg` | critical | No (formato no renderizable) | Placeholder |
| `og-image-not-image` | critical | No | Placeholder |
| `og-image-too-small` | critical | Sí, pero política del proyecto la marca crítica | Placeholder |
| `og-image-too-large` | critical | Sí, pero política del proyecto la marca crítica | Placeholder |
| `og-image-unverifiable` | **warning** | Desconocido (rechazada por la defensa SSRF, sin respuesta HTTP) | **Placeholder** (única severidad `warning` que placeholder-ea, por texto explícito de `32-CONTEXT.md`: "critical/no verificable") |
| `og-image-suboptimal` | warning | Sí (dimensión/ratio subóptimos, pero la imagen responde) | Proxy normal |
| `og-image-heavy` | warning | Sí (pesada, pero responde) | Proxy normal |
| `og-image-undetermined` | ok | Sí | Proxy normal |
| (sin fila IMG-01 para esa página) | — | Imagen nunca evaluada (fuera de la muestra gratuita, o simplemente correcta — una imagen sin ningún hallazgo NO emite fila) | Proxy normal (el proxy vuelve a aplicar su propia validación en runtime) |

**Recomendación:** exportar las 9 constantes desde `ogImageNetwork.ts` (renombradas con un prefijo público, p. ej. `OG_IMAGE_UNREACHABLE_SUBTYPE`) y re-exportarlas por `packages/checks/src/checks/network/index.ts` → `packages/checks/src/index.ts`. Añadir un helper puro y testeable junto a ellas, p. ej. `subtypeFromImgFingerprint(fingerprint: string): string | null`, que aplique el parseo exacto de arriba (`fingerprint.replace(/^IMG-01:/, "").split(":")[0]`) — así ni `report-model` ni ningún consumidor futuro reimplementa el parseo de string a mano.

### Gap 3 — El SSRF guard de Phase 31 no es importable desde `apps/web` con el `exports` map actual

`packages/checks/package.json` declara:
```json
"exports": { ".": "./src/index.ts", "./validate": "./src/validate.ts" }
```
`assertPublicDestination`, `pinnedDispatcher`, `REASON_NOT_PUBLIC`, `REASON_UNRESOLVABLE` (en `ssrfGuard.ts`) y `resolveRedirect`, `isRedirectStatus`, `MAX_REDIRECT_HOPS` (en `redirects.ts`) NO se re-exportan desde `packages/checks/src/checks/network/index.ts` (que sólo exporta los 3 objetos `NetworkCheck`), y por lo tanto tampoco desde `packages/checks/src/index.ts` (que hace `export * from "./checks/network"`, heredando ese mismo barrel limitado).

**Recomendación:** añadir a `packages/checks/src/checks/network/index.ts`:
```ts
export { assertPublicDestination, pinnedDispatcher, REASON_NOT_PUBLIC, REASON_UNRESOLVABLE } from "./ssrfGuard";
export { resolveRedirect, isRedirectStatus, MAX_REDIRECT_HOPS, REASON_TOO_MANY_REDIRECTS, REASON_INVALID_REDIRECT } from "./redirects";
```
Como `apps/web` ya depende de `@auditor/checks` (root export `"."`) y `@auditor/checks` ya está en `transpilePackages` de `next.config.ts`, esto es suficiente — no hace falta ningún subpath nuevo en `exports`.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ apps/web/app/audits/[id]/page.tsx  (Server Component, async)         │
│                                                                        │
│  await buildReportModel(auditId)  ───────────────────────────┐       │
│                                                                 │       │
└─────────────────────────────────────────────────────────────┼───────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ packages/report-model/src/build.ts :: buildReportModel()             │
│                                                                        │
│  1. issuesForDetail = prisma.issue.findMany({ auditId })  (ya existe)│
│  2. socialProblemPageIds = únicos pageId con                         │
│     category==="social" && severity in [critical,warning]            │
│  3. pages = prisma.page.findMany({                                   │
│       where: { id: { in: socialProblemPageIds } },                   │
│       select: { id, url, finalUrl, html } })         ◄── NUEVO       │
│  4. por página: cheerio.load(html) → extractMetaSocial($)            │
│     (@auditor/meta-social)                             ◄── NUEVO     │
│  5. resuelve imageStatus (Gap 2) leyendo issuesForDetail ya cargado   │
│  6. resuelve variante X (summary/summary_large_image) contra         │
│     TWITTER_CARD_VALUES + fallback OG (mismo criterio SOCIAL-07)     │
│  7. genera snippet de fix con valores reales                         │
│                                                                        │
│  → ReportModel.socialPreviews: Record<pageId, SocialPreviewData>     │
└─────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ page.tsx — bucle CATEGORY_ORDER.map, rama category==="social"        │
│                                                                        │
│  <CategoryAccordion title="Meta Tags / Social">                      │
│    <AccordionSubgroup kind="problems">                               │
│      <IssueTypeGroup                                                 │
│        issues={problems}                                             │
│        socialPreviews={dedupe(problems.map(i=>i.pageId))             │
│                          .map(id => model.socialPreviews[id])}        │
│                                                    ◄── NUEVO prop     │
│      />                                                               │
│    </AccordionSubgroup>                                              │
│  </CategoryAccordion>                                                │
└─────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ IssueTypeGroup.tsx ("use client")                                     │
│                                                                        │
│  {socialPreviews?.map(p => <SocialPreviewPanel data={p} auditId={..}/>)}│
│  {groups.map(...)}  (comportamiento existente, sin cambios)          │
└─────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SocialPreviewPanel.tsx (tabs) → GooglePreview / SocialCardPreview /   │
│ XPreview → PreviewImage.tsx                                           │
│                                                                        │
│  imageStatus==="unavailable" → placeholder, SIN request               │
│  imageStatus==="ok"          → <img src="/api/audits/[id]/            │
│                                  preview-image?url=<ogImage>" />       │
└─────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ apps/web/app/api/audits/[id]/preview-image/route.ts (Node runtime)   │
│                                                                        │
│  1. audit = prisma.audit.findUnique({ id }, select: resolvedUrl)     │
│  2. targetOrigin = new URL(query.url).origin                         │
│     auditedOrigin = new URL(audit.resolvedUrl).origin                │
│     if (targetOrigin !== auditedOrigin) → 403, sin detalle            │
│  3. assertPublicDestination(query.url)  (reuso Phase 31, Gap 3)      │
│     → si falla, 403 (mismo motivo público "destino no verificable")  │
│  4. fetch con pinnedDispatcher + redirect:"manual" + revalidación     │
│     por salto (mismo patrón que imageProbe.ts)                       │
│  5. Content-Type re-derivado y forzado a allowlist                   │
│     (image/png|jpeg|webp|gif|avif), Content-Disposition: inline,     │
│     X-Content-Type-Options: nosniff, cap de bytes                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/web/app/audits/[id]/social/
├── SocialPreviewPanel.tsx       # contenedor + tabs WAI-ARIA
├── SocialPreviewPanel.module.css
├── GooglePreview.tsx            # mockup SERP
├── GooglePreview.module.css
├── SocialCardPreview.tsx        # Facebook/LinkedIn compartido, 1.91:1
├── SocialCardPreview.module.css
├── XPreview.tsx                 # summary / summary_large_image
├── XPreview.module.css
├── PreviewImage.tsx             # <img> vía proxy + placeholder
├── PreviewImage.module.css
├── FixSnippet.tsx               # bloque de código + botón copiar
└── FixSnippet.module.css

apps/web/app/api/audits/[id]/preview-image/
└── route.ts                     # proxy Node runtime

packages/report-model/src/
├── build.ts                     # + bloque de derivación social (Gap 1 resuelto aquí)
├── model.ts                     # + SocialPreviewData, + ReportModel.socialPreviews, + ReportIssue.pageId
└── socialPreview.ts             # NUEVO: función pura extractSocialPreview(html, pageUrl) → SocialPreviewData (testeable sin Prisma)

packages/checks/src/checks/network/
├── ogImageNetwork.ts            # exportar las 9 constantes de subtipo (Gap 2)
└── index.ts                     # re-exportar ssrfGuard.ts + redirects.ts (Gap 3)

packages/meta-social/src/
└── fixSnippet.ts                # NUEVO (recomendado): buildFixSnippet(data, missingCheckIds) → string HTML
```

### Pattern 1: Derivación server-side de HTML crudo (precedente exacto ya en el repo)

**What:** Un Server Component (o, en este caso, `buildReportModel`) lee `Page.html` de Prisma sólo cuando hace falta y lo parsea con Cheerio, nunca en el cliente.
**When to use:** Cada vez que se necesite releer el HTML persistido para datos que no están en columnas dedicadas.
**Example — precedente real ya en producción:**
```typescript
// Source: apps/web/app/audits/[id]/pages/[pageId]/page.tsx (líneas 73-80)
let entities = buildEntities(page.schemaJson, null);
if (entities.length === 0 && page.schemaJson === null) {
  const withHtml = await prisma.page.findFirst({
    where: { id: pageId, auditId },
    select: { html: true },
  });
  entities = buildEntities(null, withHtml?.html ?? null);
}
```
Phase 32 debe seguir el mismo principio (pedir `html` sólo para el subconjunto de páginas que lo necesitan) pero moviendo la llamada a `packages/report-model`, no a `page.tsx`, por la convención de `STATE.md`.

### Pattern 2: Extender un componente existente con un prop condicional (mounting point exacto)

**What:** `IssueTypeGroup` gana un prop opcional `socialPreviews?: SocialPreviewData[]` y lo renderiza ANTES del `.map(groups...)` existente, sin afectar ningún otro consumidor (Issues prioritarios, resto de categorías, vista por plantilla).
**When to use:** Es el único punto de inserción compatible con `32-CONTEXT.md` ("extender IssueTypeGroup ya existente") dado que `groupIssuesByType` agrupa por TIPO de issue (checkId+title), no por página — el panel necesita agrupar por PÁGINA, así que es una sección adicional antes del contenido agrupado por tipo, no una modificación del agrupador.
**Example:**
```typescript
// packages/report-model/src/grouping.ts NO cambia — sigue agrupando por tipo.
// apps/web/app/components/ui/IssueTypeGroup.tsx — extensión propuesta:
interface IssueTypeGroupProps {
  issues: ReportIssue[];
  siteHost?: string | null;
  /** Sólo se pasa para la categoría "social", subgrupo "problems". */
  socialPreviews?: SocialPreviewData[];
}
```

### Pattern 3: Fallback OG→Twitter, mismo criterio que SOCIAL-07 (para que el preview y el issue coincidan)

**What:** Cuando `twitter:title`/`twitter:description`/`twitter:image` faltan, X usa el equivalente `og:*`. El preview debe replicar EXACTAMENTE esta regla — si el issue de SOCIAL-07 dice "falta twitter:title y también og:title" pero el preview mostrara el og:title real (que sí existiera para otro campo), habría una contradicción entre el issue y la card.
**Example — criterio ya codificado en Phase 30, a espejar:**
```typescript
// Source: packages/checks/src/checks/social/twitterCard.ts (líneas 30-34, 91-109)
const FALLBACK_FIELDS = [
  { field: "title", subtype: "missing-title" },
  { field: "description", subtype: "missing-description" },
  { field: "image", subtype: "missing-image" },
] as const;
// title/description/image resueltos = firstValue(data, `twitter:${field}`) ?? firstValue(data, `og:${field}`)
```

### Pattern 4: Clipboard con fallback a descarga (patrón exacto a extender)

**What:** `navigator.clipboard.writeText()` envuelto en try/catch, con `copied` state (`role="status"`, TTL 4000ms) y fallback a `Blob` + `<a download>` + revoke diferido.
**Example — extraído tal cual de `ExportMenu.tsx` (líneas 200-224, 104-128):**
```typescript
const clipboard = navigator.clipboard;
if (clipboard?.writeText) {
  try {
    await clipboard.writeText(text);
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_TTL_MS);
    return;
  } catch { /* cae a descarga */ }
}
triggerDownload(new Blob([text], { type: "text/plain" }), filename); // FixSnippet: .html o .txt
```
`FixSnippet` no necesita el `fetch()` previo que tiene `ExportMenu` (el texto ya llega como prop, calculado server-side) — el resto del patrón (estado `copied`, TTL, fallback, `role="status"`) se copia igual.

### Pattern 5: Proxy de imagen — Route Handler App Router (Node runtime), precedente exacto de convenciones

**Example — extraído tal cual de rutas ya existentes bajo `app/api/audits/[id]/`:**
```typescript
// Source: apps/web/app/api/audits/[id]/pages/route.ts (líneas 1-21, patrón idéntico en route.ts)
import { NextResponse } from "next/server";
import { prisma } from "@auditor/db";

export const dynamic = 'force-dynamic'
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  // ... allowlist + SSRF guard + fetch + headers propios de la Route del proxy
}
```
Nota: TODAS las rutas App Router existentes en este repo declaran `export const dynamic = 'force-dynamic'` (defensa contra builds self-hosted sin red a Postgres/Redis) — el proxy debe mantener la misma línea aunque no toque datos estáticos, por consistencia con el resto de `app/api/`.

### Anti-Patterns to Avoid
- **Parsear `page.html` en un Client Component o pasar HTML crudo como prop:** viola `32-CONTEXT.md` explícitamente y expondría contenido no saneado del sitio auditado al bundle del cliente sin necesidad.
- **Reimplementar la validación SSRF con un simple `origin === origin` sin resolución DNS:** dejaría el proxy vulnerable a que el dominio auditado (legítimo) resuelva, ahora o en el futuro, a una IP privada — exactamente la amenaza que Phase 31 ya cerró para el fetch de imágenes en el crawl.
- **Reescribir el fallback OG→Twitter con lógica propia en el componente de preview:** duplicaría (y podría desincronizar) la regla ya codificada en `twitterCard.ts` para SOCIAL-07, produciendo un preview que contradice al issue que el usuario ve dos secciones más abajo en el mismo reporte.
- **Persistir el subtipo de IMG-01 como una columna nueva en `Issue`:** no hace falta una migración — el subtipo ya es recuperable parseando `fingerprint`, y el proyecto es schema-first (`db:push`) por lo que cualquier cambio de schema debe evitarse si hay una alternativa sin migración (Gap 2 ya la ofrece).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Validar que un destino no sea una IP privada/loopback/metadata | Un regex sobre el hostname o un chequeo de string | `assertPublicDestination` + `pinnedDispatcher` de `packages/checks/src/checks/network/ssrfGuard.ts` (Gap 3) | Ya resuelve IPv4/IPv6, DNS rebinding (pinning), y está probado (`ssrfGuard.test.ts`). Un regex de hostname es exactamente el error que el docblock de ese archivo explica que no funciona |
| Extraer og:title/og:description/og:image/twitter:* de HTML | Un `$('meta[property="og:title"]')` nuevo en el componente | `extractMetaSocial` + `firstValue` de `@auditor/meta-social` | Ya maneja la mezcla `property`/`name` (Yoast y otros plugins mezclan vocabularios) y el caso de clave hostil vía `Object.prototype` (mitigación T-30-01 documentada) |
| Decidir variante `summary` vs `summary_large_image` de X | Un `if (twitterCard === "summary_large_image")` suelto en el componente cliente | Resolver server-side contra `TWITTER_CARD_VALUES` (`@auditor/meta-social`) con el mismo fallback OG que SOCIAL-07 | Evita que el preview y el issue persistido diverjan sobre qué tag "cuenta" como declarada |
| Seguir redirects de la imagen al proxearla | Un `fetch(url, { redirect: "follow" })` simple | `resolveRedirect`/`isRedirectStatus` de `redirects.ts` (Gap 3) con revalidación SSRF en cada salto | `redirect: "follow"` automático es exactamente el bypass clásico que Phase 31 cerró (un destino público que redirige al bucle local) |

**Key insight:** Todo lo que esta fase necesita para "leer datos de forma segura desde una fuente no confiable" (HTML del sitio auditado, imagen del sitio auditado) ya fue resuelto y probado en Phase 30/31. El trabajo real de Phase 32 es *wiring* — exportar lo que hoy es privado, pasar `pageId` a través de una capa que hoy lo descarta, y montar componentes de presentación sobre datos ya seguros.

## Common Pitfalls

### Pitfall 1: Fetch de `Page.html` sin cap puede ser pesado en auditorías con muchos defectos sociales

**What goes wrong:** `32-CONTEXT.md` bloquea explícitamente "sin cap adicional de cantidad de páginas" — en un sitio con 300 páginas sin `og:title` (un defecto muy común), `buildReportModel` haría un único `findMany` que trae la columna `html` (`@db.Text`) de 300 filas en una sola consulta. Cada HTML puede pesar decenas a cientos de KB.
**Why it happens:** El filtro "al menos un issue de categoría social" es intencionalmente amplio (evitar ruido en páginas perfectas, pero sin límite superior de páginas imperfectas).
**How to avoid:** No violar la decisión de scope (está locked), pero sí acotar el `select` de Prisma a exactamente `{ id, url, finalUrl, html }` (nunca `SELECT *`) y ejecutar la consulta UNA sola vez con `findMany({ where: { id: { in: [...] } } })` (ya es el patrón recomendado arriba) en vez de N consultas por página.
**Warning signs:** Tiempo de carga de `/audits/[id]` degradado notablemente en auditorías de sitios grandes con muchos defectos sociales — verificar con una auditoría real (p. ej. aprendoclub, ya usado como referencia en el proyecto) antes de cerrar la fase.

### Pitfall 2: Confundir `Page.url` con `Issue.source`/`ReportIssue.url` al mapear página → preview

**What goes wrong:** `ReportIssue.url` es un STRING derivado (`issue.source ?? issue.scope`, primer token) — no es necesariamente idéntico a `Page.url` ni a `Page.finalUrl` byte a byte (algunos checks anexan `" (enlazado desde X)"` al `source`, ya despojado por `issueUrl()`, pero la comparación por string sigue siendo fráфgil ante normalización de barra final).
**Why it happens:** Antes de Gap 1, no existe otra forma de relacionar un `ReportIssue` con su `Page`.
**How to avoid:** Cerrar Gap 1 (`ReportIssue.pageId`) y usar SIEMPRE `pageId` para el join, nunca comparación de URLs, para construir `model.socialPreviews`.

### Pitfall 3: El proxy vuelve a intentar cargar una imagen que Phase 31 ya marcó rota, por revisar mal la severidad

**What goes wrong:** Si el componente cliente decide "placeholder vs proxy" mirando sólo `severity === "critical"` y olvida el caso especial `og-image-unverifiable` (severity `warning`), la UI llamaría al proxy para una imagen que la propia defensa SSRF del crawl ya rechazó — inconsistencia visible y trabajo de red desperdiciado (aunque el proxy la rechazará también, por diseño).
**Why it happens:** La única excepción "warning pero igual placeholder" no es intuitiva sin leer `ogImageNetwork.ts` (ver Gap 2, tabla de decisión).
**How to avoid:** Resolver `imageStatus: "ok" | "unavailable"` una sola vez, server-side, en `buildReportModel`, usando la tabla de decisión completa del Gap 2 — nunca reimplementarla en el cliente.

### Pitfall 4: `transpilePackages` — falso positivo de "hace falta" sin verificarlo

**What goes wrong:** `32-UI-SPEC.md` sugiere condicionalmente añadir `transpilePackages: ["@auditor/meta-social"]`. Pero `@auditor/report-model`, `@auditor/scoring` y `@auditor/export` YA se importan y ejecutan en tiempo de ejecución desde `apps/web/app/audits/[id]/page.tsx` SIN estar en `transpilePackages` hoy — y funcionan (evidenciado por que Phase 29-31 ya están en producción con esos paquetes activos).
**Why it happens:** El comentario de `next.config.ts` explica por qué ciertos paquetes SÍ necesitan `transpilePackages` (workspace TS source), pero no todos los workspace-TS-source packages parecen necesitarlo en la práctica — posible que la resolución de symlinks de pnpm ya lo resuelva para paquetes sin dependencias problemáticas.
**How to avoid:** Si `@auditor/meta-social` se añade como dependencia de `@auditor/report-model` (NO de `apps/web` directamente, ver recomendación de Standard Stack), es muy probable que no haga falta tocar `next.config.ts` en absoluto — pero **DEBE verificarse empíricamente** corriendo `pnpm --filter web build` tras el wiring, antes de dar la fase por cerrada. `[ASSUMED]` — no se pudo ejecutar un build completo de Next dentro de esta sesión de research.

## Code Examples

### Extracción de un campo con fallback OG→Twitter (reuso directo)
```typescript
// Source: packages/meta-social/src/extract.ts (ya existente, sin cambios)
import { extractMetaSocial, firstValue } from "@auditor/meta-social";
import * as cheerio from "cheerio";

const $ = cheerio.load(page.html);
const data = extractMetaSocial($);
const ogTitle = firstValue(data, "og:title");
const twitterTitle = firstValue(data, "twitter:title") ?? ogTitle; // mismo criterio que SOCIAL-07
```

### Resolución de variante X contra el vocabulario cerrado
```typescript
// Source: packages/meta-social/src/thresholds.ts (TWITTER_CARD_VALUES, ya existente)
import { TWITTER_CARD_VALUES } from "@auditor/meta-social";

const rawCard = firstValue(data, "twitter:card")?.trim().toLowerCase();
const variant =
  rawCard && TWITTER_CARD_VALUES.includes(rawCard) && rawCard === "summary_large_image"
    ? "summary_large_image"
    : "summary"; // default si falta o es inválida, per 32-UI-SPEC.md ("nunca se fuerza summary_large_image")
```

### Allowlist de origen del proxy (núcleo de PREVIEW-04)
```typescript
// Nuevo, apps/web/app/api/audits/[id]/preview-image/route.ts
const audit = await prisma.audit.findUnique({ where: { id }, select: { resolvedUrl: true } });
if (!audit?.resolvedUrl) return new Response(null, { status: 404 });

let target: URL;
try {
  target = new URL(request.nextUrl.searchParams.get("url") ?? "");
} catch {
  return new Response(null, { status: 400 });
}

const auditedOrigin = new URL(audit.resolvedUrl).origin;
if (target.origin !== auditedOrigin) {
  return new Response(null, { status: 403 }); // sin detalle — mismo criterio "destino no verificable" de Phase 31
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — primera fase con UI real desde Phase 6 (`app/audits/[id]/page.tsx`) que introduce un componente 100% cliente montado dentro de un `<details>` server-rendered | Sigue el patrón ya establecido (Server Component orquesta datos, componentes `"use client"` sólo para interactividad) | Sin cambio de paradigma — Phase 32 es coherente con Phase 6-31 | Ninguno; no hay stack legado que reemplazar |

**Deprecated/outdated:** No aplica — no hay ningún patrón obsoleto que esta fase reemplace.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `@auditor/meta-social` no necesitará entrar a `transpilePackages` de `next.config.ts` si se añade sólo como dependencia de `@auditor/report-model` (no de `apps/web` directamente) | Common Pitfalls #4 | Bajo — si falla, el error es un fallo de build/import claro y determinista (no un bug silencioso); la corrección es una línea en `next.config.ts` |
| A2 | Los valores retirados de `twitter:card` (`photo`, `gallery`, `product`) siguen sin ser aceptados por ningún cliente real de X en 2026 — heredado de `thresholds.ts`, no reverificado en esta sesión contra documentación oficial de X (que ya no publica un validador público) | Standard Stack / Pattern 3 | Bajo — sólo afecta la clasificación de "válido/inválido" de `twitter:card`, ya decidida y congelada en Phase 30; Phase 32 sólo consume esa lista, no la redefine |

## Open Questions

1. **¿El snippet de fix (FIX-01) incluye SÓLO las etiquetas con hallazgo (`critical`/`warning`) de esa página, o el bloque completo de meta tags sociales recomendadas (incluyendo las que ya están correctas)?**
   - What we know: la copy contract fija el heading "Etiquetas que faltan" y la ayuda "Pega estas etiquetas dentro del `<head>`" — ambos textos sugieren un set acotado a lo que falta/está mal, no un dump completo.
   - What's unclear: si un tag existe pero con longitud fuera de rango (p. ej. og:title de 80 caracteres), ¿el snippet ofrece un valor "corregido" (que implicaría truncar/editar el título real, un acto editorial) o simplemente no lo incluye (porque técnicamente no "falta")?
   - Recommendation: el planner debe decidir explícitamente el criterio de inclusión — sugerencia: incluir en el snippet sólo las etiquetas cuyo checkId de esa página tiene severity `critical`/`warning` Y cuyo problema es AUSENCIA (no longitud) — para longitud fuera de rango, mostrar el issue existente en la lista de abajo (ya lo hace) sin duplicar un "snippet corregido" que editorializaría el contenido real del usuario.

2. **¿El endpoint del proxy recibe la URL de la imagen vía querystring (`?url=`) o vía un identificador opaco (p. ej. `pageId` + resolución server-side de cuál es su `og:image`)?**
   - What we know: `32-CONTEXT.md`/`32-UI-SPEC.md` no fijan el contrato exacto del query param, sólo el path (`/api/audits/[id]/preview-image/route.ts`) y las reglas de allowlist/headers.
   - What's unclear: pasar la URL cruda por querystring es más simple y es lo que este research asumió en los ejemplos de código, pero expone la URL completa de la imagen en el HTML renderizado (visible en devtools) — no es un problema de seguridad per se (la URL ya es pública, es la imagen social del sitio auditado), pero vale confirmarlo explícitamente como decisión de diseño del plan.
   - Recommendation: usar `?url=<url absoluta de la imagen>` (más simple, sin estado adicional que mantener sincronizado); el allowlist de origen ya impide el abuso independientemente de cómo llegue la URL.

## Environment Availability

Skip — esta fase no introduce dependencias de entorno nuevas (no hay CLI, runtime, ni servicio externo nuevo). El proxy hace `fetch` a orígenes arbitrarios en runtime, pero eso es una capacidad de Node ya usada por Phase 31 (`imageProbe.ts`), no un requisito de entorno adicional a auditar.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (`apps/web`, `@auditor/report-model`, `@auditor/checks`, `@auditor/meta-social` todos usan la misma versión) |
| Config file | `apps/web/vitest.config.ts` (component tests con `@vitest-environment jsdom` docblock; route/API tests en entorno `node` por defecto) |
| Quick run command | `pnpm --filter web test -- IssueTypeGroup` / `pnpm --filter @auditor/report-model test` |
| Full suite command | `pnpm test` (raíz, corre todos los workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| PREVIEW-01 | Google preview renderiza título/dominio/descripción truncados con datos reales | unit (RTL, jsdom) | `pnpm --filter web test -- GooglePreview` | ❌ Wave 0 |
| PREVIEW-02 | Facebook/LinkedIn preview comparte layout 1.91:1, usa `imageStatus` para placeholder | unit (RTL, jsdom) | `pnpm --filter web test -- SocialCardPreview` | ❌ Wave 0 |
| PREVIEW-03 | X preview elige variante `summary`/`summary_large_image` según `twitter:card` real, default `summary` si ausente | unit (RTL, jsdom) + unit puro (resolución de variante) | `pnpm --filter web test -- XPreview` / `pnpm --filter @auditor/report-model test -- socialPreview` | ❌ Wave 0 |
| PREVIEW-04 | Proxy rechaza origin distinto al auditado (403, sin detalle); reusa SSRF guard; fuerza allowlist de Content-Type | unit (Request/Response nativos, mock de `@auditor/db`) | `pnpm --filter web test -- preview-image` | ❌ Wave 0 (primer test de un App Router route handler en el repo — sin precedente directo, ver nota abajo) |
| FIX-01 | Snippet contiene valores reales de la página (title/URL), nunca placeholders genéricos | unit puro | `pnpm --filter @auditor/meta-social test -- fixSnippet` (o `report-model`, según dónde se ubique la función) | ❌ Wave 0 |
| FIX-02 | Botón copiar: éxito con Clipboard API, fallback a descarga sin ella, foco visible, `role="status"` en confirmación | unit (RTL, jsdom, `Object.defineProperty(navigator, "clipboard", ...)` para simular ausencia) | `pnpm --filter web test -- FixSnippet` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** comando `test -- <archivo>` acotado al componente/módulo tocado.
- **Per wave merge:** `pnpm test` (raíz) + `pnpm typecheck` + `pnpm assert:web-boundary` (ya en el flujo de cierre de fase según `STATE.md`).
- **Phase gate:** full suite verde antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `apps/web/tests/app/api/audits/[id]/preview-image/route.test.ts` — **primer test de un route handler App Router en el repo**. El único precedente existente (`apps/web/tests/pages/api/audits/[id]/export.test.ts`) testea Pages Router (`NextApiRequest`/`NextApiResponse` mockeados), un contrato distinto. El patrón recomendado para App Router: construir `new Request(url)` real, invocar `GET(request, { params: Promise.resolve({ id }) })` directamente (sin mock de framework), y aserciones sobre el objeto `Response` nativo (`.status`, `.headers.get(...)`, `.arrayBuffer()`/`.text()`). Mockear `@auditor/db` (`prisma`) con `vi.mock("@auditor/db", ...)`, mismo patrón que el mock de `buildReportModel` en `export.test.ts`.
- [ ] Fixtures de `SocialPreviewData` para los tests de componentes (título largo, sin descripción, sin imagen, `imageStatus: "unavailable"`) — no existen hoy, deben crearse junto con el tipo.
- [ ] Test de `packages/report-model` que verifique la regla completa de la tabla del Gap 2 (los 9 subtipos → placeholder/proxy) contra fixtures de `Issue` sintéticas — sigue el patrón ya usado por `packages/checks/src/checks/network/ogImageNetwork.test.ts` para `classifyImageProbe` (datos sintéticos, nunca mutando código de producción, mismo principio que Phase 30-06 documentó para el calibration test).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V5 Input Validation | yes | Validación estricta del query param `url` del proxy (`new URL()` en try/catch, comparación exacta de `origin`) antes de cualquier I/O |
| V12 Files and Resources (SSRF) | yes | Reuso de `assertPublicDestination` + `pinnedDispatcher` (Gap 3) — resolución DNS + clasificación de IP privada + pinning anti-rebinding, `redirect: "manual"` con revalidación por salto, cap de bytes leídos, timeout de request |
| V14 Configuration | yes | `Content-Type` de la respuesta del proxy SIEMPRE re-derivado y forzado a un allowlist cerrado (`image/png|jpeg|webp|gif|avif`), nunca reenviado crudo desde el origen — cierra vectores de content-sniffing/XSS vía `X-Content-Type-Options: nosniff` |
| V2/V3/V4/V6 | no | Esta fase no toca autenticación, sesión, control de acceso ni criptografía — hereda el modelo ya existente del reporte (acceso por `auditId` en URL, sin autorización adicional, igual que el resto de `/audits/[id]/*`, decisión ya tomada en fases anteriores) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| SSRF vía el proxy de imágenes (URL que apunta a `169.254.169.254`, `127.0.0.1`, red interna de Railway) | Tampering / Elevation of Privilege | Allowlist de origin EXACTO contra `audit.resolvedUrl` + `assertPublicDestination`/`pinnedDispatcher` (Gap 3) — defensa en dos capas: origin-match primero (barato, rechaza el 99% de intentos), resolución DNS + pinning después (cierra el caso donde el propio dominio auditado, legítimo, resuelve a una IP privada) |
| DNS rebinding entre la validación del proxy y el `fetch` real | Tampering | `pinnedDispatcher(addresses)` — la conexión usa las direcciones ya clasificadas, nunca una segunda resolución de DNS |
| Content-type sniffing / imagen-que-no-es-imagen servida al `<img>` del cliente | Tampering / Information Disclosure | `Content-Type` re-derivado (nunca el crudo del origen) + forzado a allowlist + `X-Content-Type-Options: nosniff` |
| Filtración de detalle técnico interno (status HTTP, motivo SSRF, URL interna) en la UI | Information Disclosure | Ya resuelto por convención de Phase 31 ("un solo motivo público") y repetido en `32-UI-SPEC.md` — el proxy responde 403/404 genérico, la UI nunca muestra el código HTTP crudo |
| Denegación de servicio vía imagen que gotea bytes indefinidamente | Denial of Service | Mismo patrón que `imageProbe.ts`: el timer de abort cubre también la lectura del cuerpo, y el cap de bytes cancela el reader activamente (no confía en que el servidor honre `Range`/`Content-Length`) |

## Sources

### Primary (HIGH confidence — leído directamente del repo en esta sesión)
- `packages/meta-social/src/*.ts` — contrato de extracción, umbrales, `TWITTER_CARD_VALUES`
- `packages/checks/src/checks/social/*.ts` (`ogTitle.ts`, `ogUrl.ts`, `twitterCard.ts`) — patrones de check y fallback OG→Twitter
- `packages/checks/src/checks/network/ogImageNetwork.ts`, `imageProbe.ts`, `ssrfGuard.ts`, `redirects.ts` — clasificación IMG-01, defensa SSRF completa
- `packages/report-model/src/{model,build,grouping}.ts` — forma actual de `ReportModel`/`ReportIssue`, ausencia de `pageId`
- `packages/db/prisma/schema.prisma` — modelos `Page`/`Issue`/`Audit` reales (confirma `Page.html`, `Audit.resolvedUrl`, ausencia de columna `socialMeta`)
- `apps/web/app/audits/[id]/page.tsx`, `apps/web/app/audits/[id]/pages/[pageId]/page.tsx` — precedente exacto de re-parseo server-side de HTML
- `apps/web/app/components/ui/{CategoryAccordion,IssueTypeGroup,ExportMenu,url}.tsx/.ts` — componentes a extender y patrón de clipboard
- `apps/web/app/api/audits/[id]/{route,pages/route}.ts` — convención exacta de route handlers App Router
- `apps/web/tests/pages/api/audits/[id]/export.test.ts`, `apps/web/app/components/ui/IssueTypeGroup.test.tsx` — convenciones de test existentes
- `apps/web/app/tokens.css` — verificación de existencia de todos los tokens citados por `32-UI-SPEC.md`
- `scripts/assert-no-playwright-in-web.mjs` — confirma que reusar `@auditor/checks` en `apps/web` no viola el boundary guardrail
- `npm view cheerio version` → `1.2.0` — verificación de registro

### Secondary (MEDIUM confidence)
- Ninguna — no se necesitó WebSearch/Context7 para esta fase; todo el conocimiento requerido ya existía en el propio repo.

### Tertiary (LOW confidence)
- A1/A2 en `## Assumptions Log` — marcadas explícitamente como no reverificadas contra fuente oficial externa.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero dependencias nuevas, todo verificado leyendo package.json reales
- Architecture: HIGH — los 3 gaps y el patrón de mounting están respaldados por lectura directa de código, no inferencia
- Pitfalls: HIGH — derivados de las mismas fuentes primarias; A1 (transpilePackages) es la única incertidumbre real, marcada como tal

**Research date:** 2026-08-03
**Valid until:** 2026-09-02 (30 días — código interno estable, sin dependencia de APIs externas volátiles)
