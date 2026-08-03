---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-03T02:12:54.799Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 30 | deviation | .planning/phases/30-checks-de-meta-tags-social/30-01-SUMMARY.md |  | Gate de feedback del tracer no se detuvo en checkpoint interactivo: verify automatizado re-corrido en verde antes de continuar | open |  | 2026-08-03T01:51:47.220Z |  |
| 2 | 30 | deviation | packages/checks/src/checks/social/ogType.test.ts |  | Aserto de barrel de 30-02 relajado de longitud exacta a pertenencia para desbloquear el registro de checks nuevos | open |  | 2026-08-03T02:12:54.799Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "30",
    "file": ".planning/phases/30-checks-de-meta-tags-social/30-01-SUMMARY.md",
    "line": null,
    "description": "Gate de feedback del tracer no se detuvo en checkpoint interactivo: verify automatizado re-corrido en verde antes de continuar",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-03T01:51:47.220Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "30",
    "file": "packages/checks/src/checks/social/ogType.test.ts",
    "line": null,
    "description": "Aserto de barrel de 30-02 relajado de longitud exacta a pertenencia para desbloquear el registro de checks nuevos",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-03T02:12:54.799Z",
    "resolved_at": null
  }
]
````
