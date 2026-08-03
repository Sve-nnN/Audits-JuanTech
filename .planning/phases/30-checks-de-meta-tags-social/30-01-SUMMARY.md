# Phase 30 Plan 01: og:title de punta a punta — Summary

**Estado:** en progreso. Este archivo se crea en la Tarea 1 como registro de una decisión irreversible, antes de escribir código. Las Tareas 2, 3 y 4 lo completan al cerrar el plan.

## Decisión de la Tarea 1

**Tarea 1 (checkpoint:decision):** formato del `checkId` y del `fingerprint` de los 8 checks de la categoría social.

- **Opción elegida:** `option-a` — checkId plano, subtipo sólo en el fingerprint.
- **Fecha de la respuesta:** 2026-08-03
- **Respuesta literal del usuario:** `option-a: checkId plano, subtipo sólo en fingerprint (recomendado)`

### Qué queda cerrado con esta respuesta

1. Los 8 checks nuevos usan `checkId` plano, de `SOCIAL-01` a `SOCIAL-08`, uno por archivo. Ningún `checkId` lleva dos puntos ni subtipo, igual que el 100 por ciento del catálogo de producción.
2. Los checks de hallazgo único por página (`SOCIAL-01` a `SOCIAL-05` y `SOCIAL-08`) comparten un único `pageFingerprint(CHECK_ID, url)` en todas sus ramas, sin `:missing` ni `:too-short`. Una página que pasa de og:title ausente a og:title corto se lee en el diff entre auditorías como "sigue presente" y nunca como "resuelto más nuevo".
3. Los checks multi hallazgo (`SOCIAL-06` y `SOCIAL-07`) componen el subtipo únicamente dentro del fingerprint, con el patrón de `tech/canonicalDeep.ts`.
4. La convención **C-5** del plan queda firme y normativa para 30-02 a 30-06. Las Tareas 2, 3 y 4 se ejecutan tal como están escritas.

### Qué se anula de 30-CONTEXT.md

La letra de 30-CONTEXT.md pedía "fingerprint compuesto por subtipo donde aplique (ej. `SOCIAL-01:missing`, `SOCIAL-01:too-short`)" y el formato `SOCIAL-01:og-title`. Esa regla queda anulada para los seis checks de hallazgo único y conservada para los dos multi hallazgo, en el campo `fingerprint` y no en `checkId`. La cadena `SOCIAL-01:og-title` del test de Phase 29 (`packages/report-model/src/build.test.ts`) queda como valor sintético de fixture, sin correlato en producción.

Motivo del apartamiento, en orden de peso: el `checkId` es la clave de lookup exact-match de `resolveCmsRecommendation` contra el catálogo de `packages/cms-adapters`, del que depende CMSFIX-08 en v1.7, y un `checkId` compuesto la rompe para siempre; el reporte agrupa por `checkId` más `title`, así que un compuesto fragmenta el agrupamiento; y `onpage/title.ts` ya es el precedente de producción de un check de hallazgo único con el mismo fingerprint en sus tres ramas.
