# Phase 14: Botón Exportar (UI) - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Desde el reporte, el usuario dispara cualquiera de los tres exports (PDF / Markdown / PPTX) desde un control accesible arriba a la derecha, con feedback de carga y sin doble envío. UI fina sobre la route de export ya existente (Phase 13). No entra: los serializers/route (Phase 13, ya hechos), la agrupación de issues del reporte (Phase 15), formatos extra (v2).

</domain>

<decisions>
## Implementation Decisions

### Forma del control
- Un **botón "Exportar" con menú desplegable** de 3 opciones (PDF / Markdown / PPTX) — EXPORT-04 pide "botón con selector de tipo".
- Nuevo client component `ExportMenu` en `apps/web/app/components/ui/`, que reusa el `Button` existente (variant `secondary`, con ícono lucide `Download`/`FileDown`) y construye un menú accesible mínimo (no existe Dropdown en la librería; se construye a mano respetando el baseline a11y de v1.1).
- Ubicación: dentro del `.header` del reporte (`apps/web/app/audits/[id]/page.tsx`, ~línea 88), alineado a la derecha; el `<h1>` domain queda a la izquierda.

### Interacción + accesibilidad
- Teclado + ARIA (SC#2): el botón trigger expone `aria-haspopup="menu"` + `aria-expanded`; Enter/Space abre, flechas arriba/abajo navegan entre opciones, Esc cierra y devuelve el foco al trigger; roles `menu` / `menuitem`. Foco visible (anillo lima de marca ya en Button/tokens).
- Estado de carga (SC#3): al elegir un formato, el control completo pasa a `loading` (spinner + disabled vía el `loading` de Button), lo que evita el doble envío de peticiones pesadas. Se marca la opción elegida.
- Disparo de descarga: **fetch a `/api/audits/[id]/export?format=X` → `blob()` → descarga programática** (crear un enlace temporal con `URL.createObjectURL` + `download`, revocar después). Este patrón permite un estado de carga real durante la generación y bloquear reenvíos, a diferencia de un `<a download>` simple.
- Errores: si la route falla (500) o el fetch se cae, mostrar un **estado de error inline mínimo** bajo el botón (texto breve en español neutro); no hay sistema de toast en el proyecto. Al reintentar se limpia el error.

### Copy + visual
- Label del botón: "Exportar". Opciones del menú (neutro, sin voceo): "PDF", "Markdown (para IA)", "Presentación (PPTX)".
- Variante del botón: `secondary` (no compite con CTAs primarios del reporte).
- Nombre de archivo: respetar el `Content-Disposition` que ya manda la route (filename ya sanitizado en Phase 13); si el navegador no lo respeta vía blob, derivar el nombre del header en el cliente.
- Motion: la apertura/cierre del menú respeta `prefers-reduced-motion` (baseline a11y v1.1) — sin animación brusca cuando el usuario la desactiva.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/components/ui/Button.tsx` — `variant` (primary|secondary|ghost|destructive), `size`, `loading` (spinner + aria-busy + disabled), `iconLeft`/`iconRight` (lucide). Base del trigger del menú.
- `apps/web/app/audits/[id]/page.tsx` — server component del reporte; `.header` (~línea 88) con `.domain` (h1) + `.meta`. Aquí se monta `<ExportMenu auditId={...} />` a la derecha. El componente de menú es client ("use client").
- `apps/web/app/components/ui/EmptyState.tsx` (`ErrorState`) — patrón de estado de error de la librería, referencia para el error inline.
- Route ya existente: `apps/web/app/api/audits/[id]/export/route.ts` → `GET ?format=pdf|md|pptx`, devuelve el archivo con `Content-Disposition: attachment` (Phase 13).
- Tokens/tema de marca (v1.1): focus ring lima, `prefers-reduced-motion`, tipografía Khand/Geist ya en globals.

### Established Patterns
- Client components con "use client"; server component del reporte pasa props mínimas (auditId, domain).
- Accesibilidad baseline v1.1: skip-to-content, focus-visible, roles/labels ARIA, reduced-motion — el menú debe cumplir el mismo estándar (validado en las 6 pantallas en Fase 10).
- Copy en español neutro, sin voceo (memoria de Juan).

### Integration Points
- `apps/web/app/audits/[id]/page.tsx` — importa y monta `ExportMenu` en el header (única edición del server component; no cambia el resto del render).
- `apps/web/app/audits/[id]/report.module.css` (o css module del componente) — estilos del menú alineado a la derecha del header.

</code_context>

<specifics>
## Specific Ideas

- SC central: el control debe ser 100% operable por teclado y anunciar estado a lectores de pantalla (SC#2), y el estado de carga debe impedir el doble envío de peticiones pesadas (SC#3). Añadir test de interacción (RTL) que cubra: abrir con teclado, navegar con flechas, cerrar con Esc devolviendo foco, y que un segundo click durante `loading` no dispare un segundo fetch.

</specifics>

<deferred>
## Deferred Ideas

- Agrupación de issues del reporte en dropdowns (Phase 15).
- Formatos extra DOCX/CSV (v2).
- Sistema de toast global (fuera de alcance; error inline basta).

</deferred>
