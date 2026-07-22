---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
reviewed: 2026-07-22T13:51:02Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - packages/db/prisma/schema.prisma
  - apps/worker/src/index.ts
  - apps/worker/scripts/verify-stack.mts
  - packages/report-model/src/model.ts
  - packages/report-model/src/index.ts
  - packages/report-model/src/build.ts
  - packages/report-model/src/build.test.ts
  - apps/web/app/components/ui/Badge.tsx
  - apps/web/app/components/ui/Badge.module.css
  - apps/web/app/components/ui/labels.ts
  - apps/web/app/components/ui/StackTable.tsx
  - apps/web/app/components/ui/StackTable.module.css
  - apps/web/app/components/ui/StackTable.test.tsx
  - apps/web/app/audits/[id]/page.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: resolved
resolution:
  reviewed_at: 2026-07-22T13:51:02Z
  resolved_at: 2026-07-22
  fix_commits:
    - c279784  # WR-01 + WR-02
  outcomes:
    WR-01: fixed  # isHome vía normalizeUrl en index.ts + verify-stack.mts
    WR-02: fixed  # texto de confianza accesible en chips de analytics + test de regresión
    IN-01: fixed  # guard truthy en el fold de builder (build.ts)
    IN-02: accepted  # borde de Fase 25 garantiza headers string; documentado
    IN-03: deferred  # verify-stack.mts runtime pendiente de Juan (sin red a Neon en sandbox)
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-22T13:51:02Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Revisión adversarial del wiring de `detectStack` en el worker y de la tabla de stack técnico en el reporte. Los puntos de atención de seguridad y de contrato de la fase se verificaron y están correctos:

- **Seguridad OK.** `StackTable.tsx` y `Badge.tsx` no usan `dangerouslySetInnerHTML` (la única ocurrencia del string es un comentario). Todos los `value` (incluido `"WordPress (Elementor)"` y los nombres de analytics) se pintan como texto plano en JSX; el test `StackTable.test.tsx:114` prueba explícitamente que un payload `<img onerror>` se escapa y no inyecta DOM. `toReportStack` descarta `signals`/`evidence` (build.ts:127-129) y `build.test.ts` verifica que el JSON serializado no contiene `"signals"` ni `"evidence"`.
- **Worker OK.** `detectStack` se llama exactamente una vez (index.ts:621); hay un único `prisma.audit.update` de cierre que persiste `stack` junto a `stats`/`scores` (index.ts:632-649), sin segundo write.
- **report-model OK.** `grep detectStack` en `build.ts` da 0: `buildReportModel` lee el escalar `audit.stack` del `findUnique` existente, sin re-detección ni query paralela.
- **UI OK.** `StackTable` no lleva `"use client"`; `CONFIDENCE_BADGE` nunca mapea a `"critical"` (probado en el test); siempre se renderizan 5 filas; el CSS es tokens-only sin hex crudo (color-mix sobre `--warning`/`--success`/etc.).

Quedan 2 warnings (un supuesto de correctitud sin verificar y una brecha de accesibilidad/consistencia) y 3 items informativos. Ningún blocker.

## Warnings

### WR-01: `isHome` usa igualdad de string cruda, contradiciendo el matching normalizado que el propio worker exige para el grafo

**File:** `apps/worker/src/index.ts:616` (y réplica en `apps/worker/scripts/verify-stack.mts:84`)
**Issue:**
El `isHome` de cada página se deriva con igualdad de string cruda:

```ts
isHome: p.url === startUrl || p.finalUrl === startUrl,
```

Pocas líneas antes, en el mismo archivo, el llamado a `buildLinkGraph` (index.ts:369-376) documenta explícitamente que el matching de home **requiere normalización** porque la igualdad cruda no es fiable:

> "buildLinkGraph matches the home by exact normalized URL, so a path-bearing home would otherwise never match and the graph would come back empty (WR-01)."

El grafo funciona porque `buildLinkGraph` normaliza ambos lados internamente. Pero la derivación de `isHome` para `detectStack` hace `===` sin normalizar. Si el crawler persiste la URL de la home con una diferencia mínima frente a `resolvedUrl` (trailing slash, mayúsculas de host, `http`→`https` post-redirect, puerto por defecto), **ninguna** página queda marcada `isHome`, y `detectStack` cae al fallback silencioso (`aggregate()` en detectStack.ts:70-72 elige la primera página con html por `createdAt asc`). Eso anula el propósito de Pitfall 6: bajar la precisión de detección del CMS al elegir el HTML base incorrecto.

Crítico: el script `verify-stack.mts` fue escrito específicamente para validar este supuesto (A4) sobre datos reales, pero **no se pudo ejecutar** en este entorno (sin red a Neon → `P1001`, ver el bloque `main().catch`). El código se mergea sobre un supuesto no verificado que el propio equipo marcó como incierto (el script imprime `ADVERTENCIA: ninguna página quedó marcada isHome` justo para este caso).

**Fix:** Reusar la misma normalización que `buildLinkGraph` para derivar `isHome`, en vez de `===` crudo. Extraer el helper de normalización de URL a un módulo compartido y aplicarlo a ambos lados:

```ts
import { normalizeUrl } from "@auditor/graph"; // o el helper que ya usa buildLinkGraph
const startKey = normalizeUrl(startUrl);
// ...
isHome: normalizeUrl(p.url) === startKey || (p.finalUrl != null && normalizeUrl(p.finalUrl) === startKey),
```

Mínimo indispensable si no se comparte el helper: ejecutar `verify-stack.mts` contra una auditoría real y confirmar `isHome marcadas >= 1` antes de dar la fase por cerrada.

### WR-02: la confianza de los chips de Analytics se transmite solo por color + icono `aria-hidden`, sin texto accesible — inconsistente con las filas single-value y con el contrato del propio componente

**File:** `apps/web/app/components/ui/StackTable.tsx:109-117`
**Issue:**
Las filas single-value (CMS/CDN/Hosting/Framework) muestran la confianza como **texto** (`"Confianza alta/media/baja"`, vía `ConfidenceValue` → `CONFIDENCE_LABEL[confidence]`, líneas 47-49). En cambio, los chips de Analytics solo renderizan `tool.value` (el nombre) y transmiten la confianza **únicamente** por el color del Badge (`warning` ámbar vs `ok` verde vs `warningSubtle`) y un icono que es `aria-hidden="true"`:

```tsx
<Badge
  key={`${tool.value}-${i}`}
  variant={CONFIDENCE_BADGE[tool.confidence]}
  icon={CONFIDENCE_ICON[tool.confidence]}
>
  {tool.value}
</Badge>
```

Esto rompe el contrato que el mismo componente declara en su docstring (línea 78): *"texto + icono redundante (color nunca es señal única)"*, y el de `Badge.tsx` (línea 55): *"el color nunca es señal única, el texto siempre lleva el significado"*. Para un usuario de lector de pantalla, la confianza de cada herramienta de analytics se pierde por completo (el icono es `aria-hidden` y no hay texto). Para daltonismo, distinguir `medio` (ámbar) de `alto` (verde) por color solo es ambiguo — y el icono `AlertTriangle` es idéntico para `medio` y `bajo` (CONFIDENCE_ICON líneas 24-25), así que ni siquiera el icono desambigua.

**Fix:** Dar a los chips de Analytics una etiqueta accesible de confianza, por ejemplo un `title`/`aria-label` en el Badge o un texto visualmente-oculto, de modo que la confianza no dependa solo del color:

```tsx
<Badge
  key={`${tool.value}-${i}`}
  variant={CONFIDENCE_BADGE[tool.confidence]}
  icon={CONFIDENCE_ICON[tool.confidence]}
>
  {tool.value}
  <span className={styles.srOnly}> — {CONFIDENCE_LABEL[tool.confidence]}</span>
</Badge>
```

(o exponer `aria-label` en `Badge` y pasar `${tool.value}, ${CONFIDENCE_LABEL[tool.confidence]}`).

## Info

### IN-01: el fold de builder no protege contra `builder.value` vacío → `"WordPress ()"`

**File:** `packages/report-model/src/build.ts:145-147`
**Issue:** `if (rawStack.cms.value === "WordPress" && rawStack.builder.value != null)` combina la etiqueta. Un `builder.value === ""` (string vacío) pasa el guard `!= null` y produce `"WordPress ()"`. Hoy no ocurre porque `Signature.value` nunca es vacío en el registry, pero el guard es más laxo que el invariante que asume.
**Fix:** Endurecer el guard: `rawStack.builder.value` (truthy) en lugar de `!= null`, o `rawStack.builder.value?.trim()`.

### IN-02: el cast `responseHeaders as Record<string, string>` asume valores string; headers multi-valor romperían el tipo

**File:** `apps/worker/src/index.ts:618` (y `verify-stack.mts:86`)
**Issue:** `(p.responseHeaders ?? {}) as Record<string, string>` asume que todos los valores del `Json?` persistido son strings. Un header multi-valor persistido como array (`string[]`) satisface el `Json` de Prisma pero viola el tipo asertado; `aggregate()` en detectStack lo guardaría tal cual y una firma que haga `.toLowerCase()` sobre el valor fallaría. Depende de que la curación de headers de la Fase 25 garantice valores string (fuera de alcance de esta fase, pero el cast lo da por hecho sin validar).
**Fix:** Documentar/garantizar en el borde que `responseHeaders` es `Record<string,string>` (validación zod al persistir en Fase 25), o normalizar arrays a `join(", ")` en el mapeo del worker.

### IN-03: `verify-stack.mts` es un script manual dependiente de red, nunca ejecutado en CI — el supuesto A4 (base de WR-01) queda sin verificar al merge

**File:** `apps/worker/scripts/verify-stack.mts:1-133`
**Issue:** El script está bien construido (falla ruidoso con `P1001`, nunca fabrica un `DetectedStack`, replica el mapeo del worker verbatim). Pero por diseño no corre automáticamente y en este entorno no tuvo red, así que la validación que justifica el diseño de `isHome` (ver WR-01) no se ejecutó. Es deuda de verificación, no un bug del script en sí.
**Fix:** Correr `pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>` contra una auditoría real `done` y confirmar `isHome marcadas >= 1` y un `DetectedStack` con CMS resuelto, antes de cerrar la fase. Registrar el output en el SUMMARY.

---

## Resolution (2026-07-22)

Fixes aplicados inline tras la revisión (commit `c279784`, más `build.ts` para IN-01):

- **WR-01 — FIXED.** `isHome` se deriva ahora vía `normalizeUrl` (el mismo helper de `@auditor/crawler` que usa `buildLinkGraph` para ubicar su raíz BFS) en `apps/worker/src/index.ts` y en `apps/worker/scripts/verify-stack.mts`. Variantes de la home por trailing-slash / mayúsculas de host / `http`→`https` / puerto por defecto ya no caen al fallback silencioso de la primera página. `worker typecheck` verde. La verificación runtime contra un audit real (`verify-stack.mts`) sigue pendiente de Juan por falta de red a Neon (ver IN-03).
- **WR-02 — FIXED.** Cada chip de Analytics expone su confianza como texto para lector de pantalla (`<span class="srOnly"> (Confianza alta)</span>`), igual que las filas single-value; color+icono quedan como refuerzo redundante, no señal única. Se agregó la clase `.srOnly` (patrón visually-hidden idéntico a `.caption`) y un test de regresión (`StackTable.test.tsx`). 10/10 tests verdes.
- **IN-01 — FIXED.** El fold del builder ahora exige `rawStack.builder.value` truthy (no `!= null`), evitando `"WordPress ()"` ante un value vacío. `build.ts`; report-model 44/44 verde.
- **IN-02 — ACCEPTED.** El cast `responseHeaders as Record<string,string>` asume valores string; garantizado por la curación de headers en la Fase 25 (borde de datos, fuera de alcance de esta fase). Sin cambio; documentado como supuesto de borde.
- **IN-03 — DEFERRED.** `verify-stack.mts` es un script manual dependiente de red; en este sandbox no hay salida a Neon (`P1001`). Queda como acción manual de Juan: `pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>`, confirmar `isHome marcadas >= 1` y CMS resuelto. Es deuda de verificación runtime, no un bug de código.

_Reviewed: 2026-07-22T13:51:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Resolution: 2026-07-22 (execute-phase orchestrator, inline fixes)_
_Depth: deep_
