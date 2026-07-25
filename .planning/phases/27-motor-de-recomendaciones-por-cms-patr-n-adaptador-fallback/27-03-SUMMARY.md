---
phase: 27
plan: 03
subsystem: report-model
tags: [motor, cms, recomendaciones, integracion, report-model, e2e]
requires:
  - "@auditor/cms-adapters (Plan 27-02: resolveCmsRecommendation + SUPPORTED_CHECK_IDS)"
  - "@auditor/report-model buildReportModel (punto único de integración)"
provides:
  - "Recomendación personalizada por CMS resuelta en read-time dentro de buildReportModel (CMSFIX-05)"
  - "apps/worker/scripts/verify-cms-fix.mts (verificación e2e contra audit real)"
affects:
  - "apps/web y packages/export: reciben la recomendación personalizada vía ReportModel sin cambios propios"
tech-stack:
  added: []
  patterns:
    - "Resolución en read-time dentro de buildReportModel (única fuente de verdad para UI + exports, patrón v1.2)"
    - "Guard de severidad `ok` antes del motor (nunca reescribir 'Sin acción necesaria.')"
    - "rawStack (DetectedStack crudo) al motor, no ReportStack fusionado (design_resolution 27-03)"
    - "Script e2e espejo de verify-stack.mts con degradación limpia P1001 offline"
key-files:
  created:
    - apps/worker/scripts/verify-cms-fix.mts
  modified:
    - packages/report-model/package.json
    - packages/report-model/src/build.ts
    - packages/report-model/src/build.test.ts
    - apps/worker/package.json
decisions:
  - "toReportIssue recibe (issue, stack: DetectedStack | null); el guard severity === 'ok' corta antes del motor y devuelve issue.recommendation verbatim"
  - "Los 3 call sites (priorityCandidates, issuesByCategory, issuesByTemplate) pasan rawStack (L182), no stack/ReportStack (L183)"
  - "Se agregó @auditor/report-model y @auditor/cms-adapters a apps/worker (Rule 3): sin ellas el script e2e no resuelve sus imports"
requirements: [CMSFIX-04, CMSFIX-05]
metrics:
  duration: ~14 min
  completed: 2026-07-25
status: complete
---

# Phase 27 Plan 03: Integración del motor de recomendaciones por CMS en report-model Summary

Cableado de `resolveCmsRecommendation` en el único punto de integración (`toReportIssue` de `packages/report-model/src/build.ts`), pasando el `rawStack` crudo y con guard de severidad `ok`. La recomendación personalizada por CMS se resuelve 100% en tiempo de lectura dentro de `buildReportModel` (nada nuevo se persiste), por lo que llega a la UI web y a los exports PDF/Markdown/PPTX sin tocar `packages/export` (CMSFIX-05). Los checks fuera de los 10 objetivo devuelven su genérico byte-idéntico (CMSFIX-04). Script e2e `verify-cms-fix.mts` listo para validar contra un audit real.

## Qué se construyó

- **`packages/report-model/package.json`** — dependencia `@auditor/cms-adapters: workspace:*` (junto a `@auditor/fingerprint`); `pnpm install` enlazó el workspace.
- **`packages/report-model/src/build.ts`** — `import { resolveCmsRecommendation } from "@auditor/cms-adapters"`. Firma de `toReportIssue` cambiada a `(issue: IssueRow, stack: DetectedStack | null)`. Guard: si `issue.severity === "ok"` se usa `issue.recommendation` verbatim (nunca pasa por el motor); en otro caso `resolveCmsRecommendation(stack, issue.checkId, issue.recommendation)`. Los 3 call sites (priorityCandidates ~L237, issuesByCategory ~L248, issuesByTemplate ~L255) pasan `rawStack` (el `DetectedStack` crudo de L182), no `stack`/`ReportStack`.
- **`packages/report-model/src/build.test.ts`** — 4 tests de integración nuevos: (1) guard `ok` ONPAGE-01 + WordPress alto → "Sin acción necesaria." intacto; (2) personalización ONPAGE-04 warning + WordPress → ≠ genérico y empieza por "En WordPress", y la misma resolución aparece en `issuesByCategory` (fuente única); (3) TECH-10 warning + WordPress → genérico byte-idéntico (CMSFIX-04); (4) stack null → genérico intacto.
- **`apps/worker/scripts/verify-cms-fix.mts`** — espejo de `verify-stack.mts`: reconstruye el `ReportModel` de un audit real con `buildReportModel` (sin re-detectar ni re-crawlear), imprime `model.stack` y `{ checkId, severity, recommendation }` de los issues cuyo `checkId` está en `SUPPORTED_CHECK_IDS`. Degradación limpia P1001/`PrismaClientInitializationError` offline con hint manual; nunca fabrica datos; `$disconnect` en éxito y error.
- **`apps/worker/package.json`** — se agregaron `@auditor/report-model` y `@auditor/cms-adapters` como deps workspace (necesarias para resolver los imports del script).

## Verificación (checks reales, no asumidos)

- `pnpm --filter @auditor/report-model typecheck` → **PASA** (`tsc --noEmit`, exit 0).
- `pnpm --filter @auditor/report-model test` → **PASA** (4 test files, **48 tests**: 44 previos + 4 de integración CMS). Los 4 nuevos verificados por nombre: guard ok, personalización ONPAGE-04, TECH-10 fuera de los 10, stack null.
- `pnpm --filter @auditor/worker typecheck` → **PASA** (exit 0).
- `pnpm exec tsx --check scripts/verify-cms-fix.mts` → **PASA** (exit 0, parseo/typecheck del módulo).
- Script e2e ejecutado una vez en este entorno (sin red a Postgres): degradó **limpio a P1001** con el hint manual y salió con código 1, sin fabricar ReportModel. Salida exacta:
  ```
  [verify-cms-fix] P1001: no se pudo alcanzar la base de datos. Este entorno no tiene red saliente.
  Corré este script manualmente con red a Postgres:
    pnpm --filter @auditor/worker exec tsx scripts/verify-cms-fix.mts <auditId>
  ```
  La verificación contra un audit WordPress real (ej. aprendoclub) queda como human-check con red, per plan (no bloquea la fase).
- `grep -n "toReportIssue(" build.ts` confirma: definición con 2 args + 3 usos, todos pasando `rawStack`; ningún call site quedó con un solo argumento.

## Deviations from Plan

**1. [Rule 3 - Blocking] Dependencias workspace agregadas a apps/worker**
- **Encontrado en:** Task 2.
- **Issue:** El worker no dependía de `@auditor/report-model` ni `@auditor/cms-adapters`; sin ellas el script `verify-cms-fix.mts` no resuelve `buildReportModel` ni `SUPPORTED_CHECK_IDS` (imports rotos, no compila).
- **Fix:** Se agregaron ambas como `workspace:*` en `apps/worker/package.json` + `pnpm install`.
- **Archivos modificados:** `apps/worker/package.json` (no listado en `files_modified` del plan, pero requerido para que el artefacto del plan funcione).
- **Nota:** Son deps workspace internas (no un install de paquete externo del registry) — dentro del alcance de Rule 3, no aplica la exclusión de package-manager.

**2. Commit atómico único (instrucción del orquestador).** Task 1 es `tdd="true"` (implicaría commits RED/GREEN separados). Juan indicó "commit atómico al final con mensaje `feat(27-03)`". Se respetó el gate TDD en vivo (tests escritos + verificados) y se consolidó en un único commit. Sin impacto en el resultado verificado.

## Supuestos de diseño resueltos en autónomo

- **Formato real de `issue.checkId`:** el plan y los fixtures viejos de `build.test.ts` usan sufijos (`TECH-04:missing`, `SCHEMA-05:product`), pero se verificó en `packages/checks/src/checks/**` que los `CHECK_ID` reales persistidos son **bare** (`ONPAGE-04`, `TECH-04`, `ONPAGE-01`…), coincidiendo exacto con `SUPPORTED_CHECK_IDS`. Los sufijos de los fixtures previos son arbitrarios (solo para tests de agrupación por template/categoría). Por eso los fixtures de integración nuevos usan checkIds bare, que es lo que el catálogo del adaptador matchea con igualdad estricta.
- **Genéricos de los fixtures:** para ONPAGE-04 se usó el genérico verbatim que emite `altText.ts` ("Agrega texto alternativo descriptivo…"); para TECH-10 (fuera de los 10) un genérico estable de referencia. El contrato del motor para el camino de fallback es de identidad, así que el valor exacto de TECH-10 solo importa para la aserción byte-idéntica (que se cumple).
- **Stack del fixture personalizado:** se reusó `makeDetectedStack()` (WordPress alto + Elementor medio). Para ONPAGE-04 (granular por builder) esto activa la variante Elementor ("En WordPress con Elementor…"), que igualmente empieza por "En WordPress" y ≠ genérico — la aserción es robusta a base vs variante.

## Known Stubs

Ninguno. La integración es funcional y completa; la recomendación resuelta fluye a `priorityIssues`, `priorityCandidates`, `issuesByCategory` e `issuesByTemplate` desde el único `toReportIssue`.

## Threat Flags

Ninguna superficie nueva. El guard `severity === "ok"` mitiga T-27-03-01 (no reescribe checks correctos); los checks fuera de los 10 caen a `?? generic` byte-idéntico en el motor (cubierto por el test TECH-10). El script e2e reutiliza `DATABASE_URL` existente, solo lee, `console.dir` de desarrollo — mismo perfil que `verify-stack.mts` (T-27-03-03 accept).

## Self-Check: PASSED

- `apps/worker/scripts/verify-cms-fix.mts` — existe (FOUND).
- `packages/report-model/src/build.ts` toReportIssue con 2 args + guard — verificado por grep (FOUND).
- typecheck report-model + worker verdes; test report-model 48/48 verdes; tsx --check del script exit 0 — verificados en vivo.
