# Phase 14 — UI Review: ExportMenu

**Audited:** 2026-07-08
**Baseline:** `14-UI-SPEC.md` (design contract, single small button+menu component)
**Screenshots:** not captured (no dev server en :3000 / :5173 / :8080 — auditoría solo de código)
**Scope:** advisory / non-blocking

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Design contract adherence | 4/4 | Variant, icono, label, 3 items con copy exacta y montaje derecho: todo coincide con el contrato. |
| 2. Tokens/theming | 4/4 | Cero hex crudo; solo tokens semánticos (`--ring`, `--critical` reservado a error, `--surface-*`). |
| 3. Accessibility | 4/4 | ARIA de menú completo, teclado APG-compliant, roving tabindex, foco de retorno, reduced-motion por presencia en DOM. |
| 4. Responsive/layout | 3/4 | Estructura correcta por código, pero NO verificable visualmente (sin dev server) y hay un posible shift de alineación en el cluster de acciones. |
| 5. States | 4/4 | default/hover/focus/open/loading/error todos estilizados y distinguibles; guard real contra doble fetch. |
| 6. Copy | 4/4 | Español neutro sin voceo; labels y error exactos al contrato. |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Verificar responsive en dispositivo real** — no hubo dev server, así que el comportamiento en `< 640px` (wrap del cluster de acciones y no-overflow del panel `min-width: max-content`) está inferido del código, no visto. Impacto: riesgo residual en la única dimensión no observable. Fix: levantar `pnpm dev`, abrir un reporte `done` y capturar 375/768/1440 confirmando que el panel derecho no recorta y que `.headerActions` cae bajo el dominio sin solaparse.
2. **Fijar el orden de wrap en `.headerActions`** — el `ExportMenu` comparte fila flex con el enlace largo "Ver páginas y grafo de entidades"; en anchos intermedios ese texto puede envolver junto al trigger antes de que todo el bloque baje. Impacto: presentación algo impredecible en tablet estrecha. Fix: considerar `flex-wrap` con orden explícito o mover el `linkOut` a su propia línea en `< --bp-sm`.
3. **Amortiguar el shift al mostrar error inline** — `.wrapper` es `inline-flex column` y `.error` entra en flujo normal, creciendo verticalmente el bloque dentro de `.headerActions` (align-items center), lo que puede desalinear el `linkOut` cuando aparece un error. Impacto: micro-salto visual en fallo. Fix: reservar el alto del error o posicionarlo absolute bajo el wrapper.

---

## Detailed Findings

### Pillar 1: Design contract adherence (4/4)
Coincidencia exacta con el contrato:
- Trigger `variant="secondary"` `size="md"` `iconLeft={Download}`, label "Exportar" — `ExportMenu.tsx:220-233`.
- 3 items con copy e iconos exactos: "PDF"/`FileText`, "Markdown (para IA)"/`FileCode`, "Presentación (PPTX)"/`Presentation` — `ExportMenu.tsx:25-29`, iconos a 16px `aria-hidden` (`:257`).
- Mapeo a `?format=pdf|md|pptx` — `:129`.
- Montaje a la derecha del header dentro de `.headerActions` — `page.tsx:162-167`; panel alineado a la derecha (`right: 0`) — `ExportMenu.module.css:17`.
- Error inline con copy exacto "No se pudo generar el archivo. Intenta de nuevo." + `AlertTriangle aria-hidden` + `role="alert"` — `:31`, `:265-269`.
- Descarga fetch→blob→enlace temporal con `revokeObjectURL` y filename derivado de `Content-Disposition` — `:120-152`.

Nota informativa: el `aria-label="Exportar reporte"` del Copywriting Contract no se aplica; es condicional al caso icon-only, que aquí nunca ocurre (el label "Exportar" siempre está presente), así que es correcto omitirlo. Si un futuro breakpoint ocultara el texto, habría que añadirlo.

### Pillar 2: Tokens/theming (4/4)
- Cero hex crudo en `ExportMenu.module.css`; todo vía `var(--…)`. Tokens confirmados en `tokens.css`.
- `--ring` usado exclusivamente en `focus-visible` de items (`:53-58`); el trigger hereda su anillo de `Button`.
- `--critical` reservado al texto/icono del error inline (`:65`), sin usarse como fondo ni en acciones (correcto: exportar no destruye datos).
- Superficie del panel `--surface-raised`, hover de item `--surface-hover`, borde `--border-strong`, elevación `--shadow-md`, radio `--radius-md`, `z-index: var(--z-dropdown)` — consistente con el 30% secundario del reporte y con v1.1. El trigger `secondary` no compite con CTAs primarios (sin fill lima), como pide el contrato.

### Pillar 3: Accessibility (4/4)
- Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `id` — `:221-229`. `aria-busy` lo aporta `Button` en loading (`Button.tsx:70`).
- Panel `role="menu"` + `aria-labelledby={triggerId}` — `:236-241`; items `role="menuitem"` con roving tabindex (`tabIndex 0` solo el activo) — `:245-250`.
- Teclado completo APG: Enter/Space/ArrowDown abren al primero, ArrowUp abre al último (`:155-171`); flechas navegan con wrap, Home/End extremos, Enter/Space exporta, Esc cierra y devuelve foco al trigger, Tab cierra sin exportar (`:180-216`). `preventDefault` en el trigger evita doble activación del click nativo.
- Foco de retorno vía `getElementById(triggerId).focus()` (patrón del codebase por falta de ref en `Button`) — `:81-91`.
- Cierre por click fuera con `mousedown` sin disparar export — `:109-118`.
- Reduced-motion: el panel se revela por presencia en el DOM (no por opacidad animada); la red global de `globals.css` neutraliza transiciones. Correcto.
- `focus-visible` en items solo se dispara con teclado (foco programático tras click de ratón no muestra el anillo), lo que coincide con "el item enfocado por teclado recibe el anillo lima".

Recomendación menor (no baja el score): `role="menu"` podría declarar `aria-orientation="vertical"` de forma explícita; es opcional (los menús son verticales por defecto) y sin impacto funcional.

### Pillar 4: Responsive/layout (3/4)
Score 3 por una razón concreta, no por un defecto probado: **la única dimensión puramente visual no se pudo verificar** (sin dev server) y existen dos concerns plausibles a nivel de código:
- `.header` y `.headerActions` hacen `flex-wrap: wrap` con `gap: var(--space-3)` (`report.module.css:66-95`), así que el bloque de acciones cae bajo el dominio en pantallas angostas — correcto estructuralmente.
- Concern 1 (orden de wrap): `ExportMenu` comparte la fila con el `linkOut` largo; el orden de envoltura en anchos intermedios no está fijado y puede verse desprolijo antes de que el bloque completo baje.
- Concern 2 (panel): `min-width: max-content` + `white-space: nowrap` garantizan que "Presentación (PPTX)" no se recorte, y `right: 0` mantiene el panel dentro del borde derecho; en 320px el ancho del panel (~200px) debería caber, pero no está confirmado visualmente.
- No hay drawer/fullscreen y el contrato no lo exige. Subir a 4 requiere captura real en 375/768/1440.

### Pillar 5: States (4/4)
- default/hover/focus del trigger heredados de `Button.secondary`; hover de item `--surface-hover` (`:49-51`), focus-visible de item con anillo lima (`:53-58`).
- open: `aria-expanded=true`, panel con sombra, borde y z-index correctos.
- loading: `runExport` cierra el menú (`setOpen(false)`), marca `setLoading(true)` y el guard `if (loading) return` bloquea doble/multi envío (`:120-152`); `Button` conserva el label "Exportar" para ancho estable y aplica `disabled`+`aria-busy`.
- error: se limpia al reintentar (`setErrorMsg(null)` al inicio de `runExport`); texto neutro fijo sin exponer status/stack.
- disabled derivado solo de loading — coincide con el contrato.
- items con `min-height: 44px` (target táctil) — `:35`.

### Pillar 6: Copy (4/4)
- Labels y error exactos al Copywriting Contract; español neutro.
- "Intenta de nuevo" usa imperativo neutro (no voceo). Sin em/en dashes en el copy del componente.
- Sin etiquetas genéricas tipo "Submit/OK/Cancel". El error no filtra detalles técnicos al usuario.

---

## Registry Safety
No aplica: `components.json` no presente (sin shadcn) y el contrato declara "ninguno / componente propio, sin registries de terceros". No se ejecutó auditoría de registries.

---

## Files Audited
- `apps/web/app/components/ui/ExportMenu.tsx`
- `apps/web/app/components/ui/ExportMenu.module.css`
- `apps/web/app/audits/[id]/page.tsx` (montaje en `.header` / `.headerActions`)
- `apps/web/app/audits/[id]/report.module.css` (`.header`, `.headerActions`, `.linkOut`)
- `apps/web/app/components/ui/Button.tsx` (referencia: variant/loading/focus)
- `apps/web/app/tokens.css` + `apps/web/app/globals.css` (tokens de marca, reduced-motion global)
