---
phase: 26-wiring-en-el-worker-tabla-de-stack-en-el-reporte
plan: 05
subsystem: web-report-ui
tags: [ui, report, stack, fingerprint, design-system, accessibility]
requires:
  - "26-03: model.stack + tipos ReportStack/ReportStackAxis + re-export Confidence desde @auditor/report-model"
  - "26-04: variante Badge warningSubtle"
provides:
  - "StackTable (Server Component): tabla 'Stack técnico detectado' del reporte"
  - "AXIS_LABEL / CONFIDENCE_LABEL: copy es-neutral centralizado en labels.ts"
  - "CONFIDENCE_BADGE (export): mapeo confianza→variante para tests/reuso"
affects:
  - "apps/web/app/audits/[id]/page.tsx (render de la sección de stack)"
tech-stack:
  added: []
  patterns:
    - "RSC estático que compone Badge (client) sin 'use client'"
    - "Tabla semántica con th scope=row + caption visually-hidden + roles ARIA explícitos"
    - "Responsive por colapso vertical mobile-first (sin scroll horizontal)"
    - "Copy es-neutral centralizado en labels.ts (sin strings inline)"
key-files:
  created:
    - apps/web/app/components/ui/StackTable.tsx
    - apps/web/app/components/ui/StackTable.module.css
    - apps/web/app/components/ui/StackTable.test.tsx
  modified:
    - apps/web/app/components/ui/labels.ts
    - apps/web/app/audits/[id]/page.tsx
decisions:
  - "Título de sección: replicado local como .title en StackTable.module.css con tokens idénticos a .sectionTitle (Khand/2xl/semibold/lh-heading) en vez de cross-importar report.module.css — mantiene el componente self-contained; cero drift visual por usar los mismos tokens."
  - "Roles ARIA explícitos (role=table/rowgroup/row/rowheader/cell) en el TSX para preservar la semántica de tabla cuando el display cambia a block en el colapso mobile (WebKit strippea roles de tablas con display:block)."
  - "CONFIDENCE_BADGE exportado desde StackTable.tsx para asertar el mapeo y la exclusión de 'critical' en el test de forma determinista (los CSS Modules no exponen clases de forma fiable en jsdom)."
metrics:
  duration: ~20m
  completed: 2026-07-22
  tasks: 3
  files: 5
status: complete
---

# Phase 26 Plan 05: Tabla de Stack en el Reporte Summary

Tabla "Stack técnico detectado" (Server Component) renderizada al inicio del reporte tras el hero de "Score general" y antes de "Scores por categoría": 5 ejes fijos (CMS, CDN / proxy, Hosting, Framework JS, Analytics) con su nivel de confianza vía Badge, tokens-only, responsive por colapso vertical, guardada por `model.stack` en `page.tsx`.

## Qué se implementó por task

### Task 1 — Maps AXIS_LABEL y CONFIDENCE_LABEL en labels.ts
- Import de `Confidence` desde `@auditor/report-model` (re-exportado en 26-03, mismo patrón que `PageTemplate`; NO desde `@auditor/fingerprint`).
- `AXIS_LABEL` (`as const`): `cms → "CMS"`, `cdn → "CDN / proxy"`, `hosting → "Hosting"`, `jsFramework → "Framework JS"`, `analytics → "Analytics"`.
- `CONFIDENCE_LABEL: Record<Confidence, string>`: `alto → "Confianza alta"`, `medio → "Confianza media"`, `bajo → "Confianza baja"`, `"no-detectado" → "No detectado"`. Copy es-neutral sin voceo, verbatim del Copywriting Contract.

### Task 2 — StackTable (RSC) + CSS tokens-only + tests (TDD)
- **StackTable.tsx** (Server Component, sin `"use client"`): firma `StackTable({ stack }: { stack: ReportStack })` (asume stack no nulo; el guard vive en page.tsx). Estructura `<h3 class=title>` + `<div container>` + `<table role=table>` con `<caption>` visually-hidden y `<tbody>`; 5 filas fijas, cada una con `<th scope="row">` y `<td>` con el value + `<Badge>`.
- Mapas puros: `CONFIDENCE_BADGE` (`alto:"ok"`, `medio:"warning"`, `bajo:"warningSubtle"`, `"no-detectado":"neutral"`; **exportado** para el test) y `CONFIDENCE_ICON` (`alto:CheckCircle2`, `medio/bajo:AlertTriangle`, `"no-detectado":undefined`).
- Estados cubiertos: `no-detectado` (texto "No detectado con certeza" en `--text-secondary` + Badge neutral "No detectado", fila siempre presente); Analytics zero-one-many (0 → no detectado, 1 → un chip, N → chips con `flex-wrap`, texto = nombre de herramienta); long-text (celda con wrap, Badge cae de línea).
- **StackTable.module.css** tokens-only, cero hex crudo: contenedor `--surface` + `1px --border` + `--radius-md`; celda `padding var(--space-3) var(--space-4)`; divisor `1px --border` (última fila sin borde); hover `--surface-hover`; chips gap `--space-2` con `flex-wrap`. Responsive mobile-first: base apilada vertical (etiqueta arriba con `margin-bottom var(--space-1)`, detección debajo, padding de bloque `var(--space-4)`), `@media (min-width: 640px)` restaura tabla de 2 columnas. Sin scroll horizontal (NO se copió el `min-width`/`overflow-x` de IssuesTable).
- **StackTable.test.tsx** (9 tests, jsdom): mapeo confianza→variante y exclusión de `critical`; 5 filas en orden con `th scope=row`; CMS combinado "WordPress (Elementor)"; etiquetas de confianza; fila no-detectado presente; Analytics 0/1/N; XSS (value con `<img onerror>` se escapa como texto, `querySelector("img")` null).

### Task 3 — Inserción en page.tsx con guard por model.stack
- Import `StackTable` con el estilo relativo del archivo (`../../components/ui/StackTable`).
- Bloque `{model.stack && (<Reveal as="section" className={styles.section} delay={30}><StackTable stack={model.stack} /></Reveal>)}` insertado entre el hero "Score general" y "Scores por categoría". Sin query paralela a `audit.stack`: todo por `model.stack` de `buildReportModel`. Audits pre-v1.5 (stack null → `model.stack` undefined) omiten la sección entera.

## Resultado de las verificaciones automatizadas

| Verificación | Comando | Resultado |
|---|---|---|
| Task 1 typecheck | `pnpm --filter web typecheck` | PASS |
| Task 1 grep maps | `grep AXIS_LABEL && grep CONFIDENCE_LABEL` | PASS |
| Task 2 tests | `pnpm --filter web test -t StackTable` | PASS (9 passed / 50 skipped) |
| Task 2 hex guard | `! grep -nE "#[0-9a-fA-F]{3,6}" StackTable.module.css` | PASS (sin hex crudo) |
| Task 3 typecheck | `pnpm --filter web typecheck` | PASS |
| Task 3 build | `pnpm --filter web build` | PASS (ruta `/audits/[id]` 7.92 kB) |

Todas verdes.

## Requisitos de calidad confirmados

- **StackTable.tsx NO usa `"use client"`**: confirmado — la primera línea es un `import`; el único match de "use client" está en un comentario JSDoc que documenta la prohibición. Es un Server Component que compone `Badge` (client) sin fricción.
- **Sin `dangerouslySetInnerHTML`**: confirmado — el único match está en un comentario JSDoc; todos los `value` se pintan como texto plano en JSX (React escapa; test XSS lo verifica).
- **Ninguna variante de Badge emitida es "critical"**: confirmado — `CONFIDENCE_BADGE` solo mapea a `ok/warning/warningSubtle/neutral`; test asegura `Object.values(CONFIDENCE_BADGE)` no contiene `"critical"`.
- **Las 5 filas siempre presentes**: confirmado — filas fijas en orden; los estados no-detectado muestran la fila igual (nunca se ocultan ejes); test valida `getAllByRole("rowheader")` === 5 incluso con un eje no-detectado.
- **Sin hex crudo en el CSS**: confirmado — grep guard sin coincidencias; solo tokens semánticos y `color-mix` heredado del primitivo Badge.
- **Tokens-only**: confirmado — superficie, bordes, spacing, tipografía y color 100% por tokens de `tokens.css`.

## Deviations from Plan

### Ajustes menores (Rule 3 - decisiones de implementación)

**1. Título de sección replicado local en vez de cross-importar report.module.css**
- **Encontrado durante:** Task 2.
- **Contexto:** El PLAN/PATTERNS sugería "reusar la clase `.sectionTitle` de report.module.css". Cross-importar un CSS Module de una ruta (`../../audits/[id]/report.module.css`, con `[id]` literal) dentro de un componente ui compartido es frágil ante el bundler y acopla el componente a una página.
- **Decisión:** Se replicó como `.title` en `StackTable.module.css` con **tokens idénticos** (`--font-khand`, `--font-size-2xl`, `--weight-semibold`, `--lh-heading`, `--text`). Reusa el mismo lenguaje de diseño sin drift visual y mantiene el componente self-contained.

**2. Roles ARIA explícitos en la tabla**
- **Encontrado durante:** Task 2 (diseño responsive).
- **Contexto:** El colapso mobile cambia `display` de los elementos de tabla a `block`; WebKit/Chrome pueden strippear los roles implícitos de tabla del árbol de accesibilidad cuando el display no es `table`.
- **Decisión:** Se agregaron `role="table"/"rowgroup"/"row"/"rowheader"/"cell"` (redundantes en desktop, defensivos en el colapso mobile) para preservar la relación eje→detección para lectores de pantalla. Refuerza la sección de Accesibilidad del UI-SPEC.

**3. Estructura como fragmento (no `<section>` propio)**
- **Contexto:** El PLAN mencionaba `<section className={styles.section}>` dentro de StackTable, pero Task 3 envuelve el componente en `<Reveal as="section" className={styles.section}>`.
- **Decisión:** StackTable devuelve un fragmento `<h3> + <table>` (patrón idéntico a "Scores por categoría"), evitando `<section>` anidada y doble `margin-bottom`. El `<section>` y su spacing lo aporta el `<Reveal>` de page.tsx.

## CHECK MANUAL PENDIENTE (human-check visual — NO ejecutado)

El `<human-check>` visual del `<verification>` requiere abrir el reporte de un audit real con stack en el browser (tema claro/oscuro, viewport angosto). No es ejecutable en este entorno. **Pendiente para Juan** — verificar los 7 puntos:

1. La tabla "Stack técnico detectado" aparece tras "Score general" y antes de "Scores por categoría".
2. Las 5 filas están presentes en orden; CMS muestra "WordPress (Elementor)" combinado cuando aplica.
3. La fila de un eje sin señal muestra "No detectado con certeza" + Badge gris "No detectado".
4. La fila Analytics muestra un chip por herramienta (GA4, GTM, Meta Pixel) cuando coexisten.
5. La confianza usa los 4 estados visuales distinguibles (verde / ámbar sólido / ámbar tenue / gris); nunca rojo.
6. En viewport angosto (< 640px) la tabla colapsa a lista vertical sin scroll horizontal.
7. Un audit sin stack (pre-v1.5) NO muestra la sección.

## Known Stubs

Ninguno. El componente se alimenta 100% de `model.stack` (buildReportModel); no hay datos mock ni placeholders.

## Commits

- `6297094` feat(26-05): add AXIS_LABEL y CONFIDENCE_LABEL maps en labels.ts
- `f79a42c` feat(26-05): add StackTable component (RSC) + CSS tokens-only + tests
- `cec523f` feat(26-05): render StackTable en el reporte con guard por model.stack

## Self-Check: PASSED

- `apps/web/app/components/ui/StackTable.tsx` — FOUND
- `apps/web/app/components/ui/StackTable.module.css` — FOUND
- `apps/web/app/components/ui/StackTable.test.tsx` — FOUND
- `apps/web/app/components/ui/labels.ts` (AXIS_LABEL/CONFIDENCE_LABEL) — FOUND
- `apps/web/app/audits/[id]/page.tsx` (render guardado) — FOUND
- Commit `6297094` — FOUND
- Commit `f79a42c` — FOUND
- Commit `cec523f` — FOUND
