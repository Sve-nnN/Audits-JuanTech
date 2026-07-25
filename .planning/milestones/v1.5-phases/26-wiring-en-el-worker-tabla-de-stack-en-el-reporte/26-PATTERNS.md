# Phase 26: Wiring en el worker + tabla de stack en el reporte - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 10 (4 new, 6 modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema.prisma` (mod: add `Audit.stack Json?`) | model/migration | persistence | `Audit.scores Json?` / `Audit.stats Json?` (mismo modelo) | exact |
| `apps/worker/src/index.ts` (mod: invoke `detectStack` + persist) | worker | transform → CRUD | `scores`/`graph` en `crawlAndCheck()` mismo archivo | exact |
| `apps/worker/package.json` (mod: add dep) | config | — | `@auditor/graph`/`@auditor/scoring` deps existentes | exact |
| `packages/report-model/src/model.ts` (mod: `ReportStack`) | model | transform | `ReportArchitecture`/`ReportPerf` interfaces | exact |
| `packages/report-model/src/build.ts` (mod: `toReportStack`) | service | transform | `architecture`/`perf` mapping en `buildReportModel` | exact |
| `packages/report-model/src/index.ts` (mod: export type) | config | — | export block existente | exact |
| `packages/report-model/package.json` (mod: add dep) | config | — | deps existentes | exact |
| `apps/web/app/components/ui/StackTable.tsx` (new) | component (RSC) | request-response (static) | `IssuesTable.tsx` (tabla) + `page.tsx` composición Badge | role-match |
| `apps/web/app/components/ui/StackTable.module.css` (new) | component style | — | `IssuesTable.module.css` + `Badge.module.css` (color-mix) | role-match |
| `apps/web/app/components/ui/Badge.tsx` + `.module.css` (mod: `warningSubtle`) | component | — | variantes existentes `warning`/`info` en mismo archivo | exact |
| `apps/web/app/audits/[id]/page.tsx` (mod: render `<StackTable>`) | page (RSC) | request-response | secciones hero + "Scores por categoría" mismo archivo | exact |
| `apps/web/app/components/ui/labels.ts` (mod: `AXIS_LABEL`/`CONFIDENCE_LABEL`) | utility | — | `CATEGORY_LABEL`/`STATUS_LABEL` maps existentes | exact |

## Shared type source

`@auditor/fingerprint` (`packages/fingerprint/src/index.ts`) exporta los tipos a importar directamente:
`DetectedStack`, `AxisResult`, `Confidence`, `PageFingerprintInput`, y la función `detectStack`.
`detectStack({ pages: PageFingerprintInput[] }): DetectedStack` — pura, sin I/O.
`DetectedStack.analytics` es `AxisResult[]` (array); cms/builder/cdn/hosting/jsFramework son `AxisResult` único.

## Pattern Assignments

### `packages/db/prisma/schema.prisma` (add `Audit.stack Json?`)

**Analog:** `Audit.scores` / `Audit.stats` en el mismo modelo `Audit`.

Columnas Json aditivas ya presentes (verificadas):
```prisma
stats     Json?
// ...
scores    Json?
```
Agregar en el mismo bloque, mismo patrón nullable-aditivo:
```prisma
stack     Json?   // DetectedStack (Phase 26). Nullable: audits pre-v1.5 quedan null.
```
Luego `pnpm --filter @auditor/db db:push` contra Neon (sin carpeta de migrations — schema-first, convención Phase 25). Sin backfill.

---

### `apps/worker/src/index.ts` (invoke `detectStack` + persist)

**Analog:** el propio `crawlAndCheck()` — cómo produce y persiste `scores`/`graph`.

**Punto de carga de `pages`** (L349-353) — `findMany` sin `select`, devuelve todos los escalares (`html`, `responseHeaders`, `cookieNames`):
```typescript
const [pages, robotsTxt, sitemapUrls] = await Promise.all([
  prisma.page.findMany({ where: { auditId }, orderBy: { createdAt: "asc" } }),
  fetchRobotsTxtBody(origin),
  discoverSitemapUrls(origin),
]);
```
`startUrl` está en scope (L300): `const startUrl = resolvedUrl;` — usar para derivar `isHome`.

**Return type de `crawlAndCheck()`** (L328-345): agregar `stack: DetectedStack` a la firma del objeto retornado, junto a `scores`/`graph`.

**Construcción + return** (patrón de `scores` L585-598) — insertar antes del `return`:
```typescript
const fpInput: PageFingerprintInput[] = pages
  .filter((p) => p.html != null && p.html !== "")
  .map((p) => ({
    url: p.url,
    isHome: p.url === startUrl || p.finalUrl === startUrl, // Pitfall 6
    html: p.html,
    responseHeaders: (p.responseHeaders ?? {}) as Record<string, string>,
    cookieNames: p.cookieNames ?? [],
  }));
const stack = detectStack({ pages: fpInput }); // pura, sin I/O
return { summary, issueCounts, perfSummary, scores, graph, stack };
```

**Persistencia — mismo `audit.update` único** (L601 destructuring + L607-624). Agregar `stack` al destructuring y una línea al `data` junto a `scores`:
```typescript
const { summary, issueCounts, perfSummary, scores, graph, stack } = await withTimeout(
  crawlAndCheck(), JOB_TIMEOUT_MS, `audit ${auditId} crawl+checks+perf`
);
await prisma.audit.update({
  where: { id: auditId },
  data: {
    status: "done",
    // ...stats, scores existentes...
    scores: scores as unknown as Prisma.InputJsonValue,
    stack: stack as unknown as Prisma.InputJsonValue,   // NUEVO
  },
});
```
Anti-pattern: NO crear un segundo `prisma.audit.update` solo para el stack.

Import a agregar: `import { detectStack, type PageFingerprintInput, type DetectedStack } from "@auditor/fingerprint";`

---

### `apps/worker/package.json` + `packages/report-model/package.json` (add dep)

**Analog:** deps `workspace:*` existentes (`@auditor/graph`, `@auditor/scoring`, `@auditor/db`).

Pitfall 1 (verificado): `@auditor/fingerprint` NO está declarado en ninguno de los dos. Agregar a `dependencies`:
```jsonc
"@auditor/fingerprint": "workspace:*"
```
Luego `pnpm install` (relink workspace).

---

### `packages/report-model/src/model.ts` (add `ReportStack`)

**Analog:** `ReportArchitecture` (L114-117) y `ReportPerf` (L50-56) — interfaces serializables puras + campo opcional en `ReportModel`.

Patrón de interface serializable (sin clases, sin señales de debug):
```typescript
import type { Confidence } from "@auditor/fingerprint";

export interface ReportStackAxis {
  value: string | null;      // "WordPress (Elementor)", "Cloudflare", ... o null
  confidence: Confidence;    // "alto" | "medio" | "bajo" | "no-detectado"
}

export interface ReportStack {
  cms: ReportStackAxis;      // ya combina builder → "WordPress (Elementor)"
  cdn: ReportStackAxis;
  hosting: ReportStackAxis;
  jsFramework: ReportStackAxis;
  analytics: ReportStackAxis[]; // vacío → fila "No detectado con certeza"
}
```
Campo opcional en `ReportModel` — mismo patrón que `perf?` / `architecture?` (L146-152):
```typescript
/** Stack técnico detectado (Phase 26). `undefined` cuando Audit.stack es null
 *  (audits pre-v1.5) — la UI oculta la sección entera. */
stack?: ReportStack;
```
Descartar `signals`/`evidence` en el transform (Security Domain: no filtrar debug al cliente).

---

### `packages/report-model/src/build.ts` (add `toReportStack` + return field)

**Analog:** el mapeo de `architecture` (L272-291) y el patrón de lectura de campo Json escalar `audit.scores`/`audit.stats` (L137-138).

`audit.stack` ya viene en el `findUnique` (L130-133, sin `select`). Leer y transformar:
```typescript
import type { DetectedStack, AxisResult } from "@auditor/fingerprint";

const rawStack = audit.stack as unknown as DetectedStack | null;
const stack: ReportStack | undefined = rawStack ? toReportStack(rawStack) : undefined;
```
`toReportStack` compone el label CMS+builder (Pitfall 5): si `cms.value === "WordPress"` y `builder.value != null` → `"WordPress (Elementor)"`; confianza mostrada = `cms.confidence`. Mapea cada `AxisResult` a `{ value, confidence }` descartando `signals`. `analytics.map(...)`.

Agregar al objeto de retorno (L301-321), junto a `perf`/`architecture`:
```typescript
return {
  // ...existing fields...,
  perf,
  architecture,
  stack,   // NUEVO — undefined cuando audit.stack es null
};
```
Anti-pattern: NUNCA query paralela a `audit.stack` en `page.tsx` — todo por `buildReportModel`.

**Tests** (`build.test.ts`, Wave 0): stack presente (5 ejes), `audit.stack = null` → `model.stack === undefined`, analytics array múltiple, CMS+builder combinado.

---

### `packages/report-model/src/index.ts` (export types)

**Analog:** el bloque `export type { ... } from "./model";` (L8-21).

Agregar `ReportStack`, `ReportStackAxis` a ese bloque.

---

### `apps/web/app/components/ui/Badge.tsx` + `Badge.module.css` (add `warningSubtle`)

**Analog:** variantes existentes en el mismo archivo — `warning` (ámbar sólido) e `info` (patrón de color por token).

`BadgeVariant` (Badge.tsx L14-22): agregar `| "warningSubtle"` a la unión.
`VARIANT_CLASS` (L34-43): agregar `warningSubtle: styles.warningSubtle,`.

`Badge.module.css` — patrón `color-mix` sobre token, CSP-safe, cero hex (verificado en `.badge` L11-14 y variantes L28-66). Agregar clase nueva con outline tenue (UI-SPEC: fondo transparente + borde ámbar 35%):
```css
.warningSubtle {
  color: var(--warning);
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 35%, transparent);
}
```
(usar `box-shadow inset` o `border` según convención del primitivo; el `.badge` base no define borde, así que `box-shadow` no altera el box-model de las otras variantes). Foreground `--warning` ya es AA sobre `--surface` (mismo que `medio`).

---

### `apps/web/app/components/ui/StackTable.tsx` (NEW — Server Component)

**Analog:** `IssuesTable.tsx` (estructura `<table>` semántica) + composición Badge de `audits/[id]/page.tsx`. NO reusar la API genérica de columnas de IssuesTable ni su responsive (scroll horizontal — Pitfall 2).

Estructura semántica a copiar de IssuesTable (L100-141): `<table>` real, `<caption className={styles.caption}>` visually-hidden, `<th scope="row">` para la etiqueta de eje (row-header, no col-header). NO lleva `"use client"` (es RSC estático; compone `Badge` que sí es client, sin fricción — patrón ya usado con Badge/DiffBadge en page.tsx).

Mapeos puros (definidos una vez en el componente):
```tsx
import { Badge, type BadgeVariant } from "./Badge";
import type { ReportStack } from "@auditor/report-model";
import type { Confidence } from "@auditor/fingerprint";
import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import styles from "./StackTable.module.css";

const CONFIDENCE_BADGE: Record<Confidence, BadgeVariant> = {
  alto: "ok", medio: "warning", bajo: "warningSubtle", "no-detectado": "neutral",
};
const CONFIDENCE_ICON: Record<Confidence, LucideIcon | undefined> = {
  alto: CheckCircle2, medio: AlertTriangle, bajo: AlertTriangle, "no-detectado": undefined,
};
```
Copy de confianza/ejes desde `labels.ts` (`CONFIDENCE_LABEL`, `AXIS_LABEL`), no strings inline.
Fila Analytics: `stack.analytics.map(a => <Badge>)` — chips múltiples; array vacío → "No detectado con certeza" + Badge neutral (Pitfall 4).
XSS: renderizar `value` como texto plano (React escapa); NUNCA `dangerouslySetInnerHTML`.

**Icono lucide en Badge:** el `Badge` acepta `icon?: LucideIcon` (14px, aria-hidden) — pasar `CONFIDENCE_ICON[c]`.

---

### `apps/web/app/components/ui/StackTable.module.css` (NEW — tokens-only)

**Analog:** `IssuesTable.module.css` (superficie, padding de celda, hover, caption visually-hidden) + `Badge.module.css` (color-mix sobre token, cero hex).

Tokens a usar (UI-SPEC): contenedor `--surface` + borde `1px --border` + `--radius-md`; celda `padding: var(--space-3) var(--space-4)` (idéntico a IssuesTable td); divisor fila `1px --border`, hover `--surface-hover`; gap chips `--space-2`; sección `margin-bottom --space-10`.
Título de sección: reusar la clase `.sectionTitle` de `report.module.css` (Khand, `--font-size-2xl`, `--weight-semibold`) — renderizar como `<h3>`.
Responsive (Pitfall 2 — NO copiar scroll horizontal de IssuesTable): CSS Grid propio que colapsa a lista vertical bajo `--bp-sm` (640px); etiqueta de eje arriba (`--text-secondary`, `margin-bottom --space-1`), detección debajo. Sin overflow horizontal.
Guard anti-hex (Wave 0): `! grep -nE "#[0-9a-fA-F]{3,6}" StackTable.module.css`.

---

### `apps/web/app/audits/[id]/page.tsx` (render `<StackTable>`)

**Analog:** las secciones hero "Score general" (termina L178) y "Scores por categoría" (empieza L181) del mismo archivo — patrón `<Reveal as="section" className={styles.section}>`.

Insertar entre L178 y L181 (después del `</Reveal>` del hero, antes del `<Reveal>` de categorías). Guard de render por el modelo (nunca tabla vacía):
```tsx
{model.stack && (
  <Reveal as="section" className={styles.section} delay={30}>
    <StackTable stack={model.stack} />
  </Reveal>
)}
```
(El título "Stack técnico detectado" `<h3 className={styles.sectionTitle}>` puede vivir dentro de `StackTable` o aquí — UI-SPEC lo pone dentro del componente). Import: `import { StackTable } from "@/app/components/ui/StackTable";` (seguir el estilo de import de los demás ui components en el archivo).

---

### `apps/web/app/components/ui/labels.ts` (add maps)

**Analog:** `CATEGORY_LABEL` / `STATUS_LABEL` / `SEVERITY_LABEL` (L10-28) — maps `Record<...>` es-neutral sin voceo.

Agregar:
```typescript
import type { Confidence } from "@auditor/fingerprint";

export const AXIS_LABEL = {
  cms: "CMS", cdn: "CDN / proxy", hosting: "Hosting",
  jsFramework: "Framework JS", analytics: "Analytics",
} as const;

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  alto: "Confianza alta", medio: "Confianza media",
  bajo: "Confianza baja", "no-detectado": "No detectado",
};
```
Copy verbatim del UI-SPEC Copywriting Contract. Los `value` de tecnología (WordPress, GA4, Google Tag Manager) van verbatim del motor, NO se localizan.

## Shared Patterns

### Columna Json aditiva en `Audit`
**Source:** `packages/db/prisma/schema.prisma` — `Audit.scores`, `Audit.stats`
**Apply to:** `Audit.stack Json?` (nullable, sin default, sin backfill; `db:push` a Neon).

### Escritura atómica única del audit
**Source:** `apps/worker/src/index.ts` L607-624 (`prisma.audit.update` final)
**Apply to:** persistir `stack` en ESE update, no en uno nuevo. `stack as unknown as Prisma.InputJsonValue`.

### `buildReportModel` como single source of truth
**Source:** `packages/report-model/src/build.ts` — lectura de `audit.scores`/`audit.stats` + mapeo `architecture`/`perf`, campo opcional `undefined` cuando el dato falta
**Apply to:** leer `audit.stack`, transformar con `toReportStack`, exponer `model.stack`. Nunca query paralela en la página.

### Badge primitivo tokenizado (color-mix sobre token, cero hex)
**Source:** `apps/web/app/components/ui/Badge.module.css` L8-66
**Apply to:** variante `warningSubtle`; confianza → variante; color nunca señal única (texto + icono redundante). NUNCA `critical` para confianza.

### Tabla semántica accesible
**Source:** `apps/web/app/components/ui/IssuesTable.tsx` L100-141
**Apply to:** `<table>` + `<caption>` visually-hidden + `<th scope="row">`. Diferencia: StackTable colapsa a vertical (Grid propio), NO scroll horizontal.

### Maps de copy es-neutral en `labels.ts`
**Source:** `apps/web/app/components/ui/labels.ts` L10-28
**Apply to:** `AXIS_LABEL`, `CONFIDENCE_LABEL`. Sin voceo. Value de tecnología verbatim (no se localiza).

### Sección del reporte con `<Reveal as="section">`
**Source:** `apps/web/app/audits/[id]/page.tsx` L178-183
**Apply to:** insertar StackTable entre hero y categorías, con guard `{model.stack && ...}`.

## No Analog Found

Ninguno. Los 10 archivos tienen analog exacto o role-match en el codebase; esta es una fase de cableado 100% codebase-grounded.

## Metadata

**Analog search scope:** `packages/db/prisma`, `apps/worker/src`, `packages/report-model/src`, `packages/fingerprint/src`, `apps/web/app/components/ui`, `apps/web/app/audits/[id]`
**Files scanned:** ~12
**Pattern extraction date:** 2026-07-21
</content>
</invoke>
