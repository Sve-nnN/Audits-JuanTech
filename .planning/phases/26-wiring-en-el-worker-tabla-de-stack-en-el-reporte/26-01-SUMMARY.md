---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
plan: 01
subsystem: db + workspace foundation
tags: [prisma, schema, workspace-deps, fingerprint, FPRINT-09]
requires: []
provides:
  - "Audit.stack Json? column (schema, pendiente push a Neon)"
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
  completed: 2026-07-21
status: blocked
---

# Phase 26 Plan 01: Fundación de datos y workspace para el wiring del fingerprint — Summary

Columna aditiva `Audit.stack Json?` agregada al schema Prisma y dep `@auditor/fingerprint` declarada en `apps/worker` y `packages/report-model` con workspace relinkeado; el push a Neon (Task 2) quedó BLOQUEADO por falta de red saliente (P1001) y requiere ejecución manual de Juan.

## Task Status

| Task | Nombre | Estado | Commit |
| ---- | ------ | ------ | ------ |
| 1 | Audit.stack + dep @auditor/fingerprint + pnpm install | DONE | 810568d |
| 2 | [BLOCKING] db:push a Neon — regenerar cliente Prisma | BLOCKED (P1001) | — |

## Task 1 — DONE

- `packages/db/prisma/schema.prisma`: agregada la columna `stack Json?` en el modelo `Audit`, junto a `stats`/`scores`, con comentario `DetectedStack (Phase 26, FPRINT-09)`. Nullable, sin default, sin backfill. `stats` y `scores` intactos.
- `apps/worker/package.json`: agregada `"@auditor/fingerprint": "workspace:*"` a `dependencies` (orden alfabético, tras `@auditor/db`).
- `packages/report-model/package.json`: agregada `"@auditor/fingerprint": "workspace:*"` a `dependencies` (entre `@auditor/db` y `@auditor/scoring`).
- `pnpm install --frozen-lockfile=false`: exit 0, "Already up to date", 16 workspace projects. Lockfile actualizado con los links `link:../../packages/fingerprint` (worker) y `link:../fingerprint` (report-model).
- Symlinks verificados: `apps/worker/node_modules/@auditor/fingerprint -> ../../../../packages/fingerprint` y equivalente en report-model.

## Task 2 — BLOCKED (P1001, sin red a Neon)

El push se corrió UNA sola vez para dejar constancia. Salida real:

```
Error: P1001: Can't reach database server at `ep-patient-smoke-atcb3b0c-pooler.c-9.us-east-1.aws.neon.tech:5432`
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @auditor/db@0.1.0 db:push: `prisma db push`
Exit status 1
```

Este entorno de ejecución NO tiene red saliente a Neon. Conforme al plan (Task 2, schema-gate), NO se regeneró el cliente desde stub ni se corrió `prisma generate` como sustituto: eso produciría un cliente con el campo pero una base sin la columna, y la verificación pasaría en falso. La task se detiene ruidosamente y requiere ejecución manual.

### Acción requerida de Juan (desde su máquina, con red a Neon)

```bash
pnpm --filter @auditor/db db:push && pnpm --filter @auditor/db db:generate
```

Esto aplica la columna `Audit.stack` en Neon y regenera el cliente Prisma con el campo tipado. Hasta que esto corra, la wave 2 (planes 26-02/26-03) queda bloqueada: sus typechecks de `prisma.audit.update({ data: { stack } })` y lecturas de `audit.stack` fallarían sin el cliente regenerado.

## Deviations from Plan

None — el plan se ejecutó exactamente como está escrito. Task 2 falló por la condición de red anticipada explícitamente en el propio plan (schema-gate), no por una desviación.

## Self-Check: PASSED

- Archivos modificados existen: schema.prisma (L86 `stack Json?`), apps/worker/package.json (L16), packages/report-model/package.json (L17) — verificados por grep.
- Commit 810568d existe en `git log`.
- Task 2 correctamente marcada BLOCKED sin fabricar resultado.
