---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
plan: 01
subsystem: db + workspace foundation
tags: [prisma, schema, workspace-deps, fingerprint, FPRINT-09]
requires: []
provides:
  - "Audit.stack Json? column (schema + pusheada a Neon, cliente Prisma regenerado con el campo)"
  - "@auditor/fingerprint declarado como dep en apps/worker y packages/report-model"
affects:
  - packages/db/prisma/schema.prisma
  - apps/worker/package.json
  - packages/report-model/package.json
  - pnpm-lock.yaml
tech-stack:
  added: []
  patterns: ["columna Json? aditiva/nullable (mismo patrón que Audit.stats/Audit.scores)"]
key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - apps/worker/package.json
    - packages/report-model/package.json
    - pnpm-lock.yaml
decisions:
  - "stack Json? nullable sin backfill: audits pre-v1.5 quedan null por diseño"
metrics:
  duration: ~5m
  completed: 2026-07-22
status: complete
---

# Phase 26 Plan 01: Fundación de datos y workspace para el wiring del fingerprint — Summary

Columna aditiva `Audit.stack Json?` agregada al schema Prisma y dep `@auditor/fingerprint` declarada en `apps/worker` y `packages/report-model` con workspace relinkeado. El push a Neon (Task 2) se corrió fuera de este entorno (Juan, desde su máquina con red a Neon) con éxito: la columna está aplicada en Neon y el cliente Prisma quedó regenerado con `Audit.stack` tipado, desbloqueando la Wave 2.

## Task Status

| Task | Nombre | Estado | Commit |
| ---- | ------ | ------ | ------ |
| 1 | Audit.stack + dep @auditor/fingerprint + pnpm install | DONE | 810568d |
| 2 | [BLOCKING] db:push a Neon — regenerar cliente Prisma | DONE (Juan, fuera de sandbox) | — |

## Task 1 — DONE

- `packages/db/prisma/schema.prisma`: agregada la columna `stack Json?` en el modelo `Audit`, junto a `stats`/`scores`, con comentario `DetectedStack (Phase 26, FPRINT-09)`. Nullable, sin default, sin backfill. `stats` y `scores` intactos.
- `apps/worker/package.json`: agregada `"@auditor/fingerprint": "workspace:*"` a `dependencies` (orden alfabético, tras `@auditor/db`).
- `packages/report-model/package.json`: agregada `"@auditor/fingerprint": "workspace:*"` a `dependencies` (entre `@auditor/db` y `@auditor/scoring`).
- `pnpm install --frozen-lockfile=false`: exit 0, "Already up to date", 16 workspace projects. Lockfile actualizado con los links `link:../../packages/fingerprint` (worker) y `link:../fingerprint` (report-model).
- Symlinks verificados: `apps/worker/node_modules/@auditor/fingerprint -> ../../../../packages/fingerprint` y equivalente en report-model.

## Task 2 — DONE (push corrido por Juan fuera del sandbox)

En este entorno de ejecución NO hay red saliente a Neon: el push se intentó una vez y falló con `P1001: Can't reach database server at ep-patient-smoke-atcb3b0c-pooler.c-9.us-east-1.aws.neon.tech:5432`. Conforme al plan (schema-gate), NO se regeneró el cliente desde stub como falso-pass: se detuvo y se escaló a Juan.

Juan corrió el gate desde su máquina con red a Neon:

```bash
pnpm --filter @auditor/db db:push && pnpm --filter @auditor/db db:generate
```

Resultado: exitoso, DB en sync, columna `Audit.stack` aplicada en Neon. En el sandbox se corrió a continuación `pnpm --filter @auditor/db db:generate` (solo `prisma generate`, lee el schema local, no toca red) para alinear el cliente Prisma local — ahora expone `stack: JsonValue | null` en el modelo `Audit` (verificado en `.prisma/client/index.d.ts`), desbloqueando los typecheck de la Wave 2 (`prisma.audit.update({ data: { stack } })` y lecturas de `audit.stack`).

## Deviations from Plan

None — el plan se ejecutó exactamente como está escrito. Task 2 falló por la condición de red anticipada explícitamente en el propio plan (schema-gate), no por una desviación.

## Self-Check: PASSED

- Archivos modificados existen: schema.prisma (L86 `stack Json?`), apps/worker/package.json (L16), packages/report-model/package.json (L17) — verificados por grep.
- Commit 810568d existe en `git log`.
- Task 2 completada vía gate manual de Juan (push a Neon) + `db:generate` local; cliente regenerado con `Audit.stack` verificado en `.prisma/client/index.d.ts`.
