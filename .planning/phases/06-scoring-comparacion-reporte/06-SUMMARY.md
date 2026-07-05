# Phase 6 Summary: Scoring, comparación de corridas y reporte

**Requirements:** SCORE-01..05, REPORT-01/02, DIFF-01/02
**One-liner:** Modelo de scoring determinístico (penalización por severidad + promedio ponderado por categoría), diff de issues por fingerprint entre corridas, y un reporte visual self-contained en `/audits/[id]`.

## What was built

### 1. DB (`packages/db/prisma/schema.prisma`)
- `Audit.scores Json?` — snapshot de scoring calculado al completar la auditoría: `{ overall, status, byCategory: { [category]: { score, status } }, diff: { newCount, persistentCount, resolvedCount, resolvedFingerprints, previousAuditId } }`.
- `Issue.diffStatus String?` — `'new' | 'persistent' | null` persistido en cada Issue de la corrida actual (los issues `resolved` no tienen fila en la corrida actual, así que se resumen en `Audit.scores.diff` en vez de marcarse en una fila).
- Aplicado con `prisma db push` contra Neon + `prisma generate`. Confirmado en logs: "Your database is now in sync with your Prisma schema."

### 2. `packages/scoring` (`@auditor/scoring`) — nuevo paquete
- **`categoryScore.ts`** — `scoreCategory(issues)`: modelo "porcentaje de checks pasados ponderado por severidad". Base 100, penalización fija por issue: `critical: -15`, `warning: -5`, `ok: 0` (constante tuneable `SEVERITY_PENALTY`). Determinístico, independiente del orden, sin negativos (floor en 0). Estados: `>=90` bueno, `50-89` necesita mejora, `<50` crítico (constante `STATUS_THRESHOLDS`).
- **`overallScore.ts`** — `scoreOverall(categoryScores, perf)`: promedio ponderado de las 5 categorías vía `CATEGORY_WEIGHTS` (tuneable): `tech: 0.30, perf: 0.30, onpage: 0.15, schema: 0.10, aeo: 0.15` (suma 1.0, verificado por test). El score de `perf` NO se deriva de Issues sino de PerfMetric: `scorePerfCategory` pondera el Performance Score promedio de PSI **móvil 70% / desktop 30%** (`PERF_STRATEGY_WEIGHTS`), igual que el reporte de referencia. Si una categoría no tiene datos (ej. PSI falló), se excluye y los pesos restantes se renormalizan a 1 — evita que una categoría faltante hunda el score general artificialmente.
- **`diff.ts`** — `diffIssues(current, previous)`: puro, compara sets de fingerprints. Cada issue actual es `new` (fingerprint nuevo) o `persistent` (ya existía); cada fingerprint que estaba en la corrida anterior y ya no está en la actual es `resolved`.
- **`index.ts`** re-exporta todo. 24 tests (vitest) cubriendo determinismo, no-negatividad, umbrales de estado, ponderación de perf móvil/desktop, renormalización de pesos, y clasificación new/persistent/resolved (incluye caso "sitio mayormente sano" que valida el rango 75-92 usado como target de coherencia con la referencia ~86/100).

### 3. Worker (`apps/worker/src/index.ts`)
Al completar el crawl+checks+PSI de una auditoría:
1. Busca la auditoría `done` más reciente del mismo `siteId` (excluyendo la actual).
2. Trae solo los `fingerprint` de los issues de esa auditoría previa.
3. Corre `diffIssues` contra los issues recién generados (antes de persistir) y añade `diffStatus` a cada fila antes del `createMany`.
4. Agrupa los issues persistidos por categoría (excluyendo `perf`, que no cuenta para su propio score de categoría) y corre `scoreCategory` por categoría.
5. Corre `scoreOverall` combinando esos category scores con los promedios de PSI (`perfSummary.mobile.avgScore` / `.desktop.avgScore`, ya calculados en Fase 5).
6. Persiste todo en `Audit.scores` junto al resto de `stats` en el mismo `update` final.

Idempotente: como el resto del pipeline, un re-run de la misma auditoría recalcula todo desde cero (delete + re-create de Issues, incluyendo `diffStatus`) sin acumular estado. El worker sigue sin importar nada de Next.

### 4. Web — reporte (`apps/web/app`)
- **`/audits/[id]/page.tsx`** — reporte principal (server component):
  - Hero con score general (círculo grande, color por estado) + badge Bueno/Necesita mejora/Crítico.
  - Grid de tarjetas por categoría (SEO Técnico, Rendimiento/CWV, On-Page, Datos Estructurados, AEO) con score + estado.
  - Sección "Cambios desde la auditoría anterior" (solo si hay una previa): contadores nuevo/persistente/resuelto + lista de issues resueltos (recuperados de la auditoría previa por fingerprint).
  - Tabla "Issues prioritarios": todos los `critical`/`warning` ordenados por severidad (Prisma ordena por el orden del enum de Postgres: `critical, warning, ok`, que coincide con la prioridad deseada), con categoría, título, badge de severidad, valor medido y badge de diff. Cap de 60 filas con nota de "mostrando N de M" si se trunca (evita tablas gigantes en crawls de 500 URLs).
  - "Resumen de rendimiento": tarjetas móvil/desktop con Performance Score, LCP, CLS, INP, TTFB (de `Audit.stats.perf`, calculado en Fase 5).
  - "Detalle por categoría": un `<details>`/`<summary>` nativo (sin JS) por categoría, cada issue con Valor medido / Fuente / Criterio / Recomendación vía `<dl>`.
  - Link al grafo de entidades por página (`/audits/[id]/pages`), ya existente de Fase 4.
  - Mientras la auditoría no está `done`, renderiza `<AuditProgress>` (client component) que hace polling a `/api/audits/[id]` cada 2.5s y recarga la página al terminar, para que el server component renderice el reporte completo.
  - Estilos: `report.module.css` (CSS Modules — compilado a hoja de estilos same-origin en build time, cero requests externos, compatible con CSP estricta `style-src 'self'`). Soporta `prefers-color-scheme: dark`.
- **`app/page.tsx`** (home) — reescrito: formulario de URL limpio (`home.module.css`), POST a `/api/audits`, redirect (`router.push`) a `/audits/[id]` (antes hacía polling inline en la misma página; ahora ese polling vive en el reporte).
- **`app/globals.css`** — reset mínimo self-contained (fuente del sistema, sin CDN), importado desde `layout.tsx`.
- **`GET /api/audits/[id]`** — ahora incluye `scores` en la respuesta (antes solo `stats`/`issuesByCategory`/`perf`).

### 5. Tests
`packages/scoring`: 24 tests vitest, 100% offline (sin red, sin DB) — `categoryScore.test.ts`, `overallScore.test.ts`, `diff.test.ts`.

## Verification run

```
pnpm install                      # OK
pnpm db:push                      # "Your database is now in sync with your Prisma schema"
pnpm -r typecheck                 # OK (8/8 packages incl. nuevo @auditor/scoring)
pnpm -r build                     # OK (apps/web Next build + apps/worker tsc build)
pnpm --filter @auditor/scoring test   # 24/24 passed
pnpm -r test                      # 124/124 passed (scoring 24, psi 25, crawler 16, checks 59)
```

No se corrió una auditoría real contra juan-tech.com (fuera de alcance para el ejecutor; el orquestador la verifica). La coherencia del modelo con el score de referencia (~86/100) se validó con un test unitario que simula un sitio "mayormente sano" (algunos warnings dispersos, un crítico en tech, PSI móvil/desktop decente) y confirma que el overall cae en el rango 75-92.

## Cómo verificar en vivo (para el orquestador)

1. Levantar el worker (`pnpm --filter @auditor/worker dev`) y el web (`pnpm --filter @auditor/web dev`).
2. Ir a `/`, ingresar `juan-tech.com`, enviar el formulario → redirige a `/audits/[id]`.
3. La página hace polling automático (componente `AuditProgress`) hasta que el status es `done`, y entonces recarga mostrando el reporte completo.
4. Verificar: score general en rango ~75-92, 5 tarjetas de categoría con estado, tabla de issues prioritarios ordenada por severidad, detalle por categoría expandible con los 4 campos, resumen de rendimiento móvil/desktop.
5. Lanzar una segunda auditoría del mismo dominio (mismo formulario) → en su reporte debería aparecer la sección "Cambios desde la auditoría anterior" con nuevo/persistente/resuelto, y la tabla de issues prioritarios debería mostrar badges de diff.

## Deviations from plan

None significant — se siguió el plan tal como está escrito. Decisiones tomadas dentro del "Claude's Discretion" del contexto:
- **Dónde computar el diff:** en el worker (persistiendo `Issue.diffStatus` + resumen en `Audit.scores.diff`), no al vuelo en el endpoint — mantiene el reporte simple (solo lee columnas ya calculadas) y deja el estado de diff disponible también para futuras notificaciones por email (Fase 7).
- **Persistencia de scores:** `Audit.scores Json?` (no columnas separadas), como sugerido en el contexto — flexible para iterar el modelo sin migraciones.
- **Estética:** CSS Modules en vez de inline `style={{}}` extensivo (como las páginas de Fase 4) para un layout más cuidado (grid de tarjetas, tabla, accordion) manteniendo el requisito CSP de cero CDN/assets externos.
- **Home page:** cambiado de polling-inline a redirect + polling en la página del reporte, para que cada auditoría tenga una única URL canónica desde el primer momento (REPORT-02), incluso mientras está corriendo.

## Known Stubs

Ninguno. Todos los datos mostrados en el reporte vienen de tablas ya pobladas por fases anteriores (Issue, PerfMetric, Audit.stats) o del nuevo `Audit.scores` calculado en esta fase.

## Threat Flags

Ninguno. No se agregaron endpoints nuevos ni rutas de autenticación; `/audits/[id]` y `GET /api/audits/[id]` ya existían (Fase 1/4) y solo se ampliaron los campos leídos/devueltos.

## Tunable constants (para ajustar el modelo sin tocar la lógica)

- `packages/scoring/src/categoryScore.ts` → `SEVERITY_PENALTY` (penalización por severidad).
- `packages/scoring/src/status.ts` → `STATUS_THRESHOLDS` (umbrales bueno/necesita mejora/crítico).
- `packages/scoring/src/overallScore.ts` → `CATEGORY_WEIGHTS` (pesos por categoría en el score general) y `PERF_STRATEGY_WEIGHTS` (móvil/desktop dentro de la categoría perf).

## Key files

**Created:**
- `packages/scoring/package.json`, `tsconfig.json`, `src/{index,status,categoryScore,overallScore,diff}.ts` + `*.test.ts`
- `apps/web/app/audits/[id]/page.tsx`, `AuditProgress.tsx`, `report.module.css`
- `apps/web/app/globals.css`, `apps/web/app/home.module.css`

**Modified:**
- `packages/db/prisma/schema.prisma` (`Audit.scores`, `Issue.diffStatus`)
- `apps/worker/src/index.ts` (scoring + diff al completar la auditoría), `apps/worker/package.json`
- `apps/web/app/page.tsx` (home rediseñado), `apps/web/app/layout.tsx` (import globals.css), `apps/web/app/api/audits/[id]/route.ts` (incluye `scores`), `apps/web/package.json`
