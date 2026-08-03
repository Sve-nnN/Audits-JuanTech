---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-03T01:51:47.220Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 30 | deviation | .planning/phases/30-checks-de-meta-tags-social/30-01-SUMMARY.md |  | Gate de feedback del tracer no se detuvo en checkpoint interactivo: verify automatizado re-corrido en verde antes de continuar | open |  | 2026-08-03T01:51:47.220Z |  |

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
  }
]
````
