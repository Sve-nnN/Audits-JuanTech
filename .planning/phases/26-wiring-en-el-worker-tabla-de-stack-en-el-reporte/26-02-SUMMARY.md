---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
plan: 02
subsystem: worker (fingerprint wiring)
tags: [worker, fingerprint, detectStack, FPRINT-09, prisma, tsx-verify]
requires:
  - "Audit.stack Json? column (26-01, pusheada a Neon, cliente Prisma regenerado)"
  - "@auditor/fingerprint declarado como dep en apps/worker (26-01)"
provides:
  - "El worker calcula y persiste Audit.stack una vez por corrida completa, en el update atómico que ya escribe scores"
  - "apps/worker/scripts/verify-stack.mts para re-correr detectStack sobre un audit real ya crawleado"
affects:
  - apps/worker/src/index.ts
  - apps/worker/scripts/verify-stack.mts
tech-stack:
  added: []
  patterns:
    - "escritura atómica única del audit (stack en el mismo prisma.audit.update de cierre, no un segundo write)"
    - "mapeo Page[] → PageFingerprintInput[] en el borde del worker (fingerprint sigue puro, sin dep de Prisma)"
    - "isHome derivado de startUrl (url/finalUrl === startUrl) para elegir el HTML home (Pitfall 6)"
key-files:
  created:
    - apps/worker/scripts/verify-stack.mts
  modified:
    - apps/worker/src/index.ts
decisions:
  - "stack persistido en el update de cierre existente (status:done) — una sola escritura, sin update separado"
  - "detectStack invocado una sola vez dentro de crawlAndCheck() donde `pages` ya está cargado — nunca en tiempo de lectura del reporte"
  - "verify-stack.mts falla ruidosamente (P1001) cuando no hay red a Neon; nunca fabrica un DetectedStack"
metrics:
  duration: ~15m
  completed: 2026-07-22
status: complete
---

# Phase 26 Plan 02: Cableado del fingerprint en el worker — Summary

El worker (`apps/worker/src/index.ts`) ahora mapea las páginas crawleadas a `PageFingerprintInput[]`, invoca `detectStack` una sola vez dentro de `crawlAndCheck()` (donde `pages` ya vive tras el crawl), y persiste el `DetectedStack` resultante en `Audit.stack` dentro del MISMO `prisma.audit.update` de cierre que ya escribe `scores` — una sola escritura atómica, sin requests HTTP adicionales y sin segundo update. Se agregó `apps/worker/scripts/verify-stack.mts` para re-correr `detectStack` sobre un audit real ya crawleado y validar la derivación de `isHome` (Assumption A4).

Task 1 quedó completa y verificada (typecheck verde). Task 2 quedó IMPLEMENTADA pero su verificación runtime está DIFERIDA: este entorno no tiene red saliente a Neon, así que el script falla con `P1001` por diseño (previsto en el plan). Debe correrlo Juan desde una máquina con red.

## Task Status

| Task | Nombre | Estado | Commit |
| ---- | ------ | ------ | ------ |
| 1 | Invocar detectStack y persistir Audit.stack en el update único del worker | DONE (typecheck verde) | f12f9a2 |
| 2 | Script tsx de verificación de detectStack contra un audit real | IMPLEMENTADO — verificación runtime PENDIENTE (red a Neon) | 0d9c03c |

## Task 1 — detalle

En `apps/worker/src/index.ts`:

- **Import**: `import { detectStack, type PageFingerprintInput, type DetectedStack } from "@auditor/fingerprint";`
- **Mapeo + llamada** (dentro de `crawlAndCheck()`, después del `findMany` de `pages`): se filtran las páginas con `html` no nulo ni vacío y se mapean a `{ url, isHome, html, responseHeaders, cookieNames }`, con `isHome = p.url === startUrl || p.finalUrl === startUrl` (Pitfall 6 — sin esto detectStack cae al fallback de la primera página y baja la precisión del CMS). `responseHeaders` cae a `{}` (casteado a `Record<string,string>`) y `cookieNames` a `[]` cuando son null. No se re-implementa merge/lowercase/dedup: `detectStack` ya agrega internamente.
- **detectStack**: `const stack = detectStack({ pages: fpInput });` — pura, sin I/O, invocada exactamente una vez.
- **Firma de retorno**: se agregó `stack: DetectedStack` al tipo inline de `crawlAndCheck()` y `stack` al objeto `return`.
- **Destructuring**: `stack` agregado al destructuring de `withTimeout(crawlAndCheck(), ...)`.
- **Persistencia**: se agregó la línea `stack: stack as unknown as Prisma.InputJsonValue` al `data` del `prisma.audit.update` final (junto a `scores`). No se creó un segundo update.

**Verificación (automated)**: `pnpm --filter @auditor/worker typecheck` → **PASS** (EXIT=0). El cliente Prisma regenerado en 26-01 expone `Audit.stack`, así que el cast tipa correcto.

## Task 2 — detalle

`apps/worker/scripts/verify-stack.mts` (nuevo): script tsx que (1) recibe `auditId` por argv o, si falta, selecciona el audit `status === "done"` más reciente vía Prisma; (2) exige `resolvedUrl` persistido como `startUrl` (mismo valor que usó el worker) y se detiene si falta, para no degradar `isHome` silenciosamente offline; (3) carga `prisma.page.findMany({ where: { auditId }, orderBy: { createdAt: "asc" } })`; (4) replica VERBATIM el filtro `html` no nulo/vacío e `isHome` del worker; (5) corre `detectStack({ pages: fpInput })` e imprime el `DetectedStack` con `console.dir(..., { depth: null })`. Reporta el conteo de páginas `isHome` marcadas y advierte si es 0 (fallback de detección). Si no hay red a Neon, falla ruidosamente clasificando la condición `P1001` (por `code`, `name` PrismaClientInitializationError o mensaje "can't reach database server") e imprime el comando manual exacto; nunca inventa un stack.

**Verificación runtime — DIFERIDA (P1001, sin red a Neon)**. Se corrió una vez para dejar constancia:

```
Can't reach database server at `ep-patient-smoke-atcb3b0c-pooler.c-9.us-east-1.aws.neon.tech:5432`.
[verify-stack] P1001: no se pudo alcanzar la base de datos (Neon). Este entorno no tiene red saliente.
Corré este script manualmente con red a Neon:
  pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>
```

**Comando exacto para Juan (con red a Neon)**:

```
pnpm --filter @auditor/worker exec tsx scripts/verify-stack.mts <auditId>
```

Criterio de aceptación al correrlo: para un sitio WordPress conocido (ej. aprendoclub) el eje `cms` NO debe quedar en `no-detectado` (confirma que `isHome` matchea contra las URLs normalizadas del crawler — Assumption A4).

## Revisión de código (solicitada)

Verificado por grep sobre `apps/worker/src/index.ts`:

- **`detectStack` se llama UNA sola vez**: sí, única ocurrencia en L621 (`const stack = detectStack({ pages: fpInput });`).
- **Un solo `prisma.audit.update` de cierre**: sí. Los `audit.update` del archivo son: L271 (status running), L300 (resolvedUrl temprano), L314/L327 (progreso/fase), L632 (cierre con `status: "done"` + `stack`) y L700 (handler de fallo). El stack se escribe en el update de cierre existente (L632) — no se agregó ninguno nuevo.
- **`stack` en el return de `crawlAndCheck()` y en el destructuring del withTimeout**: sí. Tipo de retorno L350 (`stack: DetectedStack`), objeto `return` L623 (`..., graph, stack }`), destructuring L626 (`const { ..., graph, stack } = await withTimeout(...)`), y data del update L648 (`stack: stack as unknown as Prisma.InputJsonValue`).

## Deviations from Plan

**1. [Rule 1 - Bug] Detección de P1001 por nombre/mensaje además del `code`**
- **Found during:** Task 2 (primera corrida de constancia)
- **Issue:** La condición real de "sin red a Neon" en client-init es un `PrismaClientInitializationError` con `errorCode: undefined` (no el literal `code === "P1001"`), así que el script caía en la rama genérica "error inesperado" y volcaba el stack crudo en vez del mensaje limpio de ejecución manual.
- **Fix:** El `catch` ahora clasifica la condición de inalcanzable por `code === "P1001"` OR `name === "PrismaClientInitializationError"` OR match del mensaje `/can't reach database server/i`, disparando la rama limpia con el comando manual.
- **Files modified:** apps/worker/scripts/verify-stack.mts
- **Commit:** 0d9c03c (incluido en el commit del script)

## Known Stubs

Ninguno. El stack se computa y persiste con datos reales del crawl; no hay valores hardcodeados ni placeholders.

## Threat Flags

Ninguna superficie de seguridad nueva fuera del `<threat_model>` del plan. `detectStack` ya mitiga prototype pollution (`Object.create(null)`) y trunca HTML a 256KB (Phase 25); el worker pasa `responseHeaders`/`cookieNames` crudos sin indexarlos por claves hostiles. `DetectedStack` persistido no lleva PII (cookieNames son solo nombres por construcción del tipo).

## Estado general del plan

**Implementación completa.** Verificación runtime de Task 2 diferida a Juan (requiere red a Neon) — NO es un falso-verde: Task 1 está verificada (typecheck), Task 2 está implementada y su script deja constancia explícita del P1001 pidiendo ejecución manual.

## Self-Check: PASSED

- FOUND: apps/worker/src/index.ts (modificado, typecheck PASS)
- FOUND: apps/worker/scripts/verify-stack.mts (creado)
- FOUND commit: f12f9a2 (Task 1)
- FOUND commit: 0d9c03c (Task 2)
