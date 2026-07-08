---
phase: 14
slug: bot-n-exportar-ui
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-08
---

# Phase 14 — UI Design Contract: ExportMenu

> Contrato visual e interacción de un único componente pequeño: un botón "Exportar" con menú desplegable accesible, arriba a la derecha del header del reporte. UI fina sobre la route de export ya existente (Phase 13). No introduce primitivas nuevas de diseño: reusa `Button` y los tokens semánticos de v1.1.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (librería propia v1.1, sin shadcn) |
| Preset | not applicable |
| Component library | ninguna (menú construido a mano; no existe Dropdown en la librería) |
| Icon library | lucide-react (`Download`, `FileText`, `FileCode`, `Presentation`, `AlertTriangle`) |
| Font | Geist Sans (UI), Khand (headings) — sin cambios en este componente |

**Reuso obligatorio:** `Button` (`apps/web/app/components/ui/Button.tsx`, variant `secondary`, con `loading` para bloquear doble envío). El menú NO reusa `EmptyState`; toma su patrón de error inline (icono + `role="alert"`, color `--critical`) como referencia, no el componente completo.

---

## Component Anatomy

Nuevo client component `ExportMenu` en `apps/web/app/components/ui/ExportMenu.tsx` (`"use client"`), con `ExportMenu.module.css` propio. Recibe `auditId: string` (y opcional `domain` para nombre de archivo de fallback). Se monta a la derecha del `.header` en `apps/web/app/audits/[id]/page.tsx` (~línea 88).

```
.wrapper (position: relative, inline-flex column)
├── Button (trigger)  — variant="secondary", size="md"
│     iconLeft = Download
│     label = "Exportar"
│     aria-haspopup="menu", aria-expanded, aria-controls=<menuId>
│     loading = true durante el fetch (spinner + disabled)
├── .menu (role="menu", aria-labelledby=<triggerId>)  — solo cuando open
│     ├── .item (role="menuitem", tabIndex=-1)  "PDF"                    iconLeft=FileText
│     ├── .item (role="menuitem", tabIndex=-1)  "Markdown (para IA)"     iconLeft=FileCode
│     └── .item (role="menuitem", tabIndex=-1)  "Presentación (PPTX)"    iconLeft=Presentation
└── .error (role="alert")  — solo cuando falló el último export
      AlertTriangle (aria-hidden) + texto breve neutro
```

Iconos de item a 16px, `aria-hidden="true"` (el texto porta el significado). Cada item mapea a `?format=pdf | md | pptx`.

---

## Spacing Scale

Solo tokens de `tokens.css` (múltiplos de 4). Valores usados en este componente:

| Token | Value | Uso en ExportMenu |
|-------|-------|-------------------|
| `--space-1` | 4px | Gap entre botón y mensaje de error inline |
| `--space-2` | 8px | Gap icono↔label dentro de cada item; padding vertical de item |
| `--space-2` | 8px | Offset del menú bajo el trigger (`margin-top`) |
| `--space-3` | 12px | Padding horizontal de cada item del menú |
| `--space-3` | 12px | Padding interno del contenedor `.menu` (vertical) |

Exceptions: ninguna. El trigger ya cumple min-height 44px vía `Button size="md"`; cada `.item` debe tener min-height 44px (target táctil).

---

## Typography

Hereda de la librería. El componente NO define nuevos roles tipográficos.

| Role | Size | Weight | Line Height | Aplicación |
|------|------|--------|-------------|------------|
| Trigger label | `--font-size-sm` (14px) | 600 (heredado de `.button`) | `--lh-body` (1.5) | "Exportar" (via Button) |
| Menu item | `--font-size-sm` (14px) | `--weight-regular` (400) | `--lh-body` (1.5) | "PDF", "Markdown (para IA)", "Presentación (PPTX)" |
| Error inline | `--font-size-sm` (14px) | `--weight-regular` (400) | `--lh-body` (1.5) | Texto de error breve |

Fuente: Geist Sans en todo el componente (no Khand — no hay headings aquí).

---

## Color

Solo tokens semánticos (dark-first + override light ya resueltos en `tokens.css`). Cero hex crudo. El componente hereda el 60/30/10 del reporte; no introduce color nuevo.

| Role | Token | Uso en ExportMenu |
|------|-------|-------------------|
| Dominante (60%) | `--bg` | Canvas del reporte detrás del menú |
| Secundario (30%) | `--surface-raised` | Fondo del panel `.menu` y fondo del trigger (Button secondary) |
| Secundario hover | `--surface-hover` | Hover / foco activo de un `.item` |
| Borde | `--border-strong` | Borde del trigger (Button) y borde del panel `.menu` |
| Texto | `--text` | Label de items |
| Accent (10%) | `--ring` (`--accent`) | SOLO anillo de foco (`focus-visible`) del trigger y de los items |
| Destructivo | `--critical` | SOLO texto + icono del error inline |
| Elevación | `--shadow-md` | Sombra del panel `.menu` (popover elevado) |

Accent reservado para: exclusivamente el anillo de foco (`outline: 2px solid var(--ring)` + `box-shadow: var(--shadow-focus)`). El menú NO usa fill lima: el trigger es `secondary` a propósito para no competir con CTAs primarios del reporte. Ningún item usa accent como fondo.

`--critical` reservado para: exclusivamente el mensaje de error inline. No hay acciones destructivas en este componente (exportar no destruye nada), por lo que no hay confirmación destructiva.

---

## States

| Estado | Contrato visual |
|--------|-----------------|
| default | Trigger `secondary`: fondo `--surface-raised`, borde `--border-strong`, texto `--text`, icono `Download`. Menú cerrado, sin error. |
| hover (trigger) | `--surface-hover` (heredado de `.button.secondary:hover`). |
| focus-visible (trigger) | Anillo lima: `outline: 2px solid var(--ring)` + `outline-offset: 2px` + `box-shadow: var(--shadow-focus)` (heredado de Button). |
| open | `aria-expanded="true"`; panel `.menu` visible bajo el trigger, alineado a la derecha (`right: 0`), `z-index: var(--z-dropdown)`, `box-shadow: var(--shadow-md)`, borde `--border-strong`, radio `--radius-md`. |
| item hover / foco | Fondo `--surface-hover`; el item enfocado por teclado recibe además el anillo lima `focus-visible`. Solo un item "activo" (roving tabindex) a la vez. |
| loading | Al elegir formato: el trigger pasa a `loading` (spinner `Loader2`, `aria-busy`, `disabled`) vía prop `loading` de Button; el menú se cierra; se ignora cualquier segundo click/Enter mientras `loading` sea true (bloquea doble fetch de peticiones pesadas). El label "Exportar" se conserva (ancho estable). |
| error inline | Tras fallo (500 o fetch caído): bajo el trigger, `.error` con `role="alert"`, `AlertTriangle` (aria-hidden) + texto `--critical`, `--font-size-sm`. Se limpia al reintentar (nuevo click en cualquier item). |
| disabled | Solo derivado de `loading` (no hay disabled independiente). Opacidad 0.5 + `cursor: not-allowed` (heredado de `.button:disabled`). |

Descarga: `fetch('/api/audits/[id]/export?format=X')` → `blob()` → enlace temporal (`URL.createObjectURL` + `download`) → `revokeObjectURL`. Nombre de archivo: respetar `Content-Disposition` de la route (Phase 13); si el navegador no lo aplica vía blob, derivar el filename del header en el cliente.

---

## Interaction & Accessibility Contract

Debe igualar el baseline a11y v1.1 (focus-visible, roles/labels ARIA, reduced-motion), validado en las 6 pantallas de Fase 10.

**ARIA**
- Trigger: `aria-haspopup="menu"`, `aria-expanded={open}`, `aria-controls={menuId}`, `id={triggerId}`.
- Panel: `role="menu"`, `aria-labelledby={triggerId}`, `id={menuId}`.
- Items: `role="menuitem"`, `tabIndex={-1}` (roving; el item activo recibe foco programático).
- Error: contenedor `role="alert"` (se anuncia solo al aparecer).
- Estado `loading` ya expone `aria-busy` vía Button.

**Teclado**
- `Enter` / `Space` / `ArrowDown` sobre el trigger: abre el menú y mueve foco al primer item.
- `ArrowUp` sobre el trigger: abre y mueve foco al último item.
- `ArrowDown` / `ArrowUp` dentro del menú: navega entre items (wrap arriba↔abajo).
- `Home` / `End`: primer / último item (opcional pero recomendado).
- `Enter` / `Space` sobre un item: dispara el export de ese formato y cierra el menú.
- `Esc`: cierra el menú y devuelve el foco al trigger.
- `Tab` / click fuera: cierra el menú (sin disparar export) y deja pasar el foco.

**Foco**
- Al abrir: foco entra al menú (primer/último item según tecla).
- Al cerrar por Esc o selección: foco vuelve al trigger.
- Roving tabindex: solo un `menuitem` es tabbable a la vez.

**Motion**
- Cualquier transición de apertura/cierre debe respetar `prefers-reduced-motion`: la red de seguridad global de `globals.css` ya neutraliza animaciones, pero el componente no debe depender de animación para revelar contenido (el panel se muestra/oculta por presencia en el DOM, no por opacidad animada).

---

## Layout

- Se monta dentro del `.header` existente (`display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline`) en `apps/web/app/audits/[id]/page.tsx`. El bloque izquierdo (`.domain` h1 + `.meta`) queda a la izquierda; `ExportMenu` a la derecha.
- Wrapper `position: relative` para anclar el panel absoluto; el panel abre hacia abajo, alineado al borde derecho (`top: 100%; right: 0; margin-top: var(--space-2)`).
- El panel usa `min-width` suficiente para el item más largo ("Presentación (PPTX)") sin recorte; `white-space: nowrap` en items.
- Responsive: el `.header` ya hace `flex-wrap: wrap`; en pantallas angostas el control cae bajo el bloque de dominio de forma natural. En `< --bp-sm (640px)` el trigger puede ocupar el ancho disponible del bloque, pero el panel permanece alineado a la derecha del trigger. No se requiere fullscreen ni drawer.
- `z-index` del panel: `var(--z-dropdown)` (1000), por encima del contenido del reporte y por debajo de sticky/overlay.

---

## Copywriting Contract

Español neutro, sin voceo (regla dura de Juan). Sin em/en dashes.

| Element | Copy |
|---------|------|
| Label del trigger | Exportar |
| Item 1 | PDF |
| Item 2 | Markdown (para IA) |
| Item 3 | Presentación (PPTX) |
| `aria-label` del trigger (si icon-only en algún breakpoint) | Exportar reporte |
| Error inline | No se pudo generar el archivo. Intenta de nuevo. |
| Estado destructivo | no aplica (exportar no destruye datos; sin confirmación) |

Nota: el error inline es intencionalmente breve (no hay sistema de toast en el proyecto). Si se quiere distinguir fallo de red vs fallo del servidor, mantener un único texto neutro; no exponer detalles técnicos al usuario.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| ninguno | ninguno (componente propio, sin registries de terceros) | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
