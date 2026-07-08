---
phase: 14
plan: 01
subsystem: web-ui
tags: [export, a11y, dropdown, rtl, blob-download]
requires:
  - "@auditor/export route GET /api/audits/[id]/export?format=pdf|md|pptx (Phase 13)"
  - "Button primitive (COMP-06)"
provides:
  - "ExportMenu client component (EXPORT-04)"
  - "RTL test infra for apps/web (jsdom per-file + @vitejs/plugin-react)"
affects:
  - "apps/web/app/audits/[id]/page.tsx report header (done branch)"
tech-stack:
  added:
    - "@testing-library/react ^16.3.2 (devDep)"
    - "@testing-library/user-event ^14.6.1 (devDep)"
    - "@testing-library/jest-dom ^6.9.1 (devDep)"
    - "jsdom ^29.1.1 (devDep)"
    - "@vitejs/plugin-react ^6.0.3 (devDep)"
  patterns:
    - "Per-file DOM tests via // @vitest-environment jsdom docblock; default env stays node"
    - "Hand-rolled accessible menu (roving tabindex) since library has no Dropdown"
    - "Focus management via document.getElementById (Button exposes no ref)"
key-files:
  created:
    - "apps/web/app/components/ui/ExportMenu.tsx"
    - "apps/web/app/components/ui/ExportMenu.module.css"
    - "apps/web/app/components/ui/ExportMenu.test.tsx"
  modified:
    - "apps/web/vitest.config.ts"
    - "apps/web/package.json"
    - "apps/web/app/audits/[id]/page.tsx"
    - "apps/web/app/audits/[id]/report.module.css"
decisions:
  - "@vitejs/plugin-react added to enable JSX transform under rolldown-vite (node env unchanged as default)"
  - "Focus via getElementById instead of ref-on-Button to keep typecheck clean and match established codebase pattern (10-02)"
metrics:
  duration: ~7 min
  completed: 2026-07-08
---

# Phase 14 Plan 01: ExportMenu (UI botón Exportar) Summary

ExportMenu accesible: trigger Button `secondary` + menú de 3 formatos (PDF / Markdown / PPTX) con teclado y ARIA completos, descarga fetch→blob→enlace temporal con loading que bloquea el doble envío y error inline neutro; montado a la derecha del header del reporte. Cierra EXPORT-04 y la Phase 14 (1/1).

## What Was Built

- **`ExportMenu.tsx`** (client component `"use client"`): prop `auditId` + `domain?` para fallback de nombre. Trigger reusa `Button` (`variant="secondary"`, `iconLeft=Download`, `loading`), expone `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`. Menú `role="menu"` con 3 items `role="menuitem"` (FileText/FileCode/Presentation, iconos 16px `aria-hidden`).
  - **Teclado:** Enter/Space/ArrowDown abren (foco al primer item), ArrowUp abre (al último), flechas navegan con wrap, Home/End a extremos, Esc cierra y devuelve foco al trigger, Tab/click-fuera cierran sin exportar. Roving tabindex (un solo item tabbable).
  - **Descarga:** `fetch('/api/audits/${auditId}/export?format=X')` → `blob()` → enlace temporal (`createObjectURL` + `download` + click + remove) → `revokeObjectURL` en `finally`. Filename derivado de `Content-Disposition` con fallback `auditoria-<domain|id>.<ext>`.
  - **Loading (SC#3):** guard `if (loading) return;` en `runExport` + `Button disabled` durante la generación → un segundo disparo no lanza segundo fetch.
  - **Error:** `role="alert"` con `AlertTriangle` + texto neutro fijo "No se pudo generar el archivo. Intenta de nuevo."; se limpia al reintentar (`setErrorMsg(null)` al inicio de cada export).
- **`ExportMenu.module.css`:** wrapper/menu/item/error solo con tokens semánticos (cero hex crudo). Panel `--surface-raised` + `--border-strong` + `--shadow-md` + `--z-dropdown`; items 44px min-height; foco `--ring` + `--shadow-focus`; error `--critical`.
- **`ExportMenu.test.tsx`:** suite RTL (11 casos) bajo `// @vitest-environment jsdom` — ARIA cerrado, apertura por teclado y foco, navegación con wrap, Esc devuelve foco, 3 formatos con query correcta, no-doble-fetch en loading, error inline en reject y en `!ok` con limpieza al reintentar.
- **Montaje:** `page.tsx` rama `done` → `<ExportMenu>` agrupado con el `linkOut` en un `.headerActions` (flex/gap/wrap) a la derecha del header. Rama de progreso intacta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSX transform faltante en vitest**
- **Found during:** Task 2 (GREEN)
- **Issue:** Con el componente presente, rolldown-vite no transformaba el JSX del `.test.tsx` ("Unexpected JSX expression"); el entorno de test no tenía plugin de React (las route tests de Phase 13 eran TS puro sin JSX).
- **Fix:** Añadido `@vitejs/plugin-react` como devDep y `plugins: [react()]` en `vitest.config.ts`; el `environment` por defecto se mantiene `node` (las route tests siguen en node; el DOM se activa por archivo con el docblock).
- **Files modified:** apps/web/vitest.config.ts, apps/web/package.json, pnpm-lock.yaml
- **Commit:** 87b2c16

**2. [Rule 1 - Bug] Renders acumulados entre tests (sin auto-cleanup)**
- **Found during:** Task 2 (GREEN)
- **Issue:** Con `globals: false`, RTL no registra auto-cleanup → múltiples "Exportar" en el DOM entre tests (`getMultipleElementsFoundError`).
- **Fix:** `cleanup()` explícito en `afterEach`.
- **Files modified:** apps/web/app/components/ui/ExportMenu.test.tsx
- **Commit:** 87b2c16

**3. [Rule 1 - Bug] Foco del trigger sin ref**
- **Found during:** Task 2
- **Issue:** El primitivo `Button` no reenvía `ref` ni lo declara en su tipo; pasar `ref` rompería el typecheck.
- **Fix:** Manejo de foco del trigger vía `document.getElementById(triggerId)` (patrón ya establecido en el codebase, 10-02).
- **Files modified:** apps/web/app/components/ui/ExportMenu.tsx
- **Commit:** 87b2c16

**4. [Rule 3 - Blocking] Typecheck bajo `noUncheckedIndexedAccess`**
- **Found during:** Task 2
- **Issue:** Accesos indexados (`match[1]`, `OPTIONS[index]`, `mock.calls[0][0]`) devuelven `T | undefined`.
- **Fix:** Guards / optional chaining en componente y test; cast del stub de `HTMLAnchorElement.prototype.click`.
- **Files modified:** apps/web/app/components/ui/ExportMenu.tsx, apps/web/app/components/ui/ExportMenu.test.tsx
- **Commit:** 87b2c16

## Verification

- `pnpm --filter @auditor/web test`: **18 passed** (11 ExportMenu + 7 route de Phase 13; sin regresión de entorno node).
- `pnpm --filter @auditor/web typecheck`: limpio.
- `pnpm --filter @auditor/web build`: verde.
- Hex crudo en `ExportMenu.module.css`: **0** (solo tokens). `.headerActions` sin hex nuevo.
- Contract grep en `ExportMenu.tsx`: `"use client"`, `aria-haspopup="menu"`, `role="menu"`, `role="menuitem"`, `URL.createObjectURL`, `URL.revokeObjectURL`, `?format=`, guard `if (loading)` presentes.
- ExportMenu montado solo en la rama `done` (línea 166, tras `buildReportModel`); rama de progreso sin cambios.

## Threat Model Coverage

- **T-14-01** (filename de Content-Disposition): valor usado solo como `anchor.download`, nunca sink de DOM; fallback local si el header falta/no matchea. Mitigado.
- **T-14-02** (DoS doble envío): guard `if (loading) return;` + Button disabled. Mitigado (SC#3).
- **T-14-03** (info disclosure en error): texto neutro fijo, sin status/stack. Aceptado por diseño.
- **T-14-04** (leak de Object URL): `revokeObjectURL` en `finally`. Mitigado.
- **T-14-SC** (devDeps de test): solo devDependencies de registro conocido (@testing-library/*, jsdom, @vitejs/plugin-react); no tocan runtime de producción ni el bundle de Vercel. Mitigado.

## Success Criteria

1. Botón "Exportar" arriba a la derecha con selector de 3 tipos (PDF / Markdown / PPTX). ✅ [SC#1]
2. Operable por teclado + roles/labels ARIA (menu/menuitem, haspopup, expanded, roving tabindex, Esc devuelve foco). ✅ [SC#2]
3. Loading/disabled durante la generación; segundo disparo no lanza segundo fetch. ✅ [SC#3]
4. Descarga del archivo por fetch→blob→enlace temporal. ✅ [SC#4]

## Self-Check: PASSED

- FOUND: apps/web/app/components/ui/ExportMenu.tsx
- FOUND: apps/web/app/components/ui/ExportMenu.module.css
- FOUND: apps/web/app/components/ui/ExportMenu.test.tsx
- FOUND commits: 1efb2ab, 87b2c16, 4d94e45
