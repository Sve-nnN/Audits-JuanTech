---
phase: 09-librer-a-de-componentes
plan: 06
subsystem: ui-components
tags: [components, table, accessibility, design-system, sticky-column, empty-state, xss-mitigation]
requires:
  - "09-01: url.ts (shortUrl para display de URL) + tokens semánticos (--surface, --border, --radius-md, --accent-text, --surface-hover, --success, --font-size-xs/sm, --space-2/3/4, --font-geist-mono)"
  - "09-05: EmptyState (COMP-07) para el estado sin issues"
provides:
  - "IssuesTable (COMP-04): tabla de issues responsive por scroll horizontal con columna de URL sticky/clickeable y estado vacío"
  - "IssuesTableColumn/IssuesTableProps: contrato tipado (columns + rows ReactNode[][] + caption/note/emptyLabel)"
affects:
  - "Fase 10 (ensamblado del reporte /audits/[id]) consume IssuesTable como tabla central de issues prioritarios"
  - "Cierra COMP-04 y la librería de componentes de la Fase 9 (waves 1-4 completas)"
tech-stack:
  added: []
  patterns:
    - "'use client' + named export + CSS Module hermano (idioma Button/Badge/Accordion)"
    - "región de scroll horizontal enfocable por teclado (tabindex=0 + role=region + aria-label) en vez de colapso a cards"
    - "columna sticky vía position:sticky+left:0+box-shadow seam; bg sincronizado con hover de fila"
    - "URL clickeable segura: solo esquema http/https se vuelve <a href> (rel=noreferrer + title completo); resto texto plano (React escapa)"
    - "remap local de --text-muted a --success en el wrapper del estado vacío para teñir el chip de EmptyState sin tocar el componente compartido"
key-files:
  created:
    - apps/web/app/components/ui/IssuesTable.tsx
    - apps/web/app/components/ui/IssuesTable.module.css
  modified: []
decisions:
  - "rows tipado como ReactNode[][] (no IssueRow[]): el consumidor arma las celdas ya renderizadas; el componente solo aplica el patrón de enlace a celdas string que empiezan con http"
  - "estado vacío tiñe el ícono de éxito remapeando --text-muted→--success en el wrapper (.empty) porque el chip de EmptyState fija color:var(--text-muted); evita modificar el componente compartido y no introduce hex"
  - "header sticky (position:sticky top:0) y columna sticky (left:0) coexisten con z-index escalonado (th normal=2, stickyCol td=1, th.stickyCol=3) para que el cruce de ejes no muestre contenido subyacente"
  - "th upgradeado de --text-muted (report L213) a --text-secondary por fix de contraste AA (UI-SPEC)"
metrics:
  duration: ~4min
  completed: 2026-07-06
  tasks: 2
  files: 2
---

# Phase 9 Plan 06: IssuesTable Summary

IssuesTable (COMP-04) — tabla de issues prioritarios responsive por scroll horizontal con columna de URL sticky y clickeable (decisión bloqueada: NO colapsa a cards), header sticky, estado vacío vía EmptyState y enlaces seguros solo para esquemas http/https. Cierra la librería de la Fase 9.

## What Was Built

**Task 1 — estructura + scroll accesible (commit 26e21d4):**
- `<table>` real con `<caption>` (sr-only), `<thead>` y `<th scope="col">`.
- Wrapper de scroll `overflow-x:auto` enfocable por teclado (`tabindex=0` + `role="region"` + `aria-label`), con foco visible (`:focus-visible` ring).
- `min-width:640px` en la tabla fuerza scroll horizontal en móvil en vez de aplastar columnas.
- `<th>` en `--text-secondary` (fix AA vs. el `--text-muted` original de report.module.css), uppercase, sticky top. Columnas `mono` en Geist Mono + tnum. Note line en `--text-secondary`.

**Task 2 — columna URL sticky/clickeable + estado vacío (commit c243179):**
- Columna sticky (`position:sticky; left:0; z-index:1; background:var(--surface)` + `box-shadow:1px 0 0 var(--border)` seam), con bg sincronizado al hover de fila.
- Celda URL: `<a href target=_blank rel=noreferrer title={url}>{shortUrl(url)}</a>` en `--accent-text` solo cuando el valor empieza con `http`; scopes no-URL en texto plano `--text-secondary`.
- Estado vacío: `rows` vacío → `EmptyState` con `CheckCircle2` teñido en `--success` (remap local de `--text-muted`).

## Deviations from Plan

None - plan executed exactly as written. Se aplicó la ruta contemplada por el propio plan para el color de éxito del ícono ("si EmptyState no expone color de ícono, envolver en un contenedor"): el wrapper `.empty` remapea `--text-muted`→`--success`, respetando tokens-only y sin tocar el componente compartido.

## Threat Model Compliance

- **T-09-06-01 (XSS en href):** mitigado — solo se renderiza `<a href>` para valores que empiezan con `http`/`https`; cualquier otro esquema es texto plano. Sin `dangerouslySetInnerHTML`.
- **T-09-06-02 (referrer/window.opener):** mitigado — `rel="noreferrer"` en todos los enlaces externos.

## Verification

- Task 1 gate: greps (export/role=region/tabIndex/scope=col/min-width 640/text-secondary) + no-hex + typecheck → OK.
- Task 2 gate: greps (from ./url, from ./EmptyState, CheckCircle2, rel=noreferrer, startsWith("http"), position:sticky, left:0) + no-hex + typecheck → OK.
- `pnpm --filter @auditor/web typecheck` pasa en ambas tasks.
- Lint (`next lint`) no está configurado en el proyecto (prompt interactivo de setup) — condición preexistente, fuera de scope.

## Notes for Next Phase

- Fase 10 arma las `rows` (ReactNode[][]) mapeando issues → celdas, pasando la columna Página con `sticky:true` y el valor URL como string para que IssuesTable aplique el patrón de enlace. Las columnas de referencia: Categoría · Issue · Página (sticky) · Severidad (SeverityBadge) · Valor medido (mono) · Estado.
- La página `audits/[id]/page.tsx` aún contiene la tabla inline original; su reemplazo por IssuesTable es trabajo de ensamblado de Fase 10 (este plan solo construye el componente de librería, no toca screens ni pipeline).

## Self-Check: PASSED

- FOUND: apps/web/app/components/ui/IssuesTable.tsx
- FOUND: apps/web/app/components/ui/IssuesTable.module.css
- FOUND: .planning/phases/09-librer-a-de-componentes/09-06-SUMMARY.md
- FOUND commit: 26e21d4 (Task 1)
- FOUND commit: c243179 (Task 2)
