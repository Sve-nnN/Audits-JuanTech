# Phase 15 — UI Review

**Audited:** 2026-07-08
**Baseline:** `15-UI-SPEC.md` (design contract)
**Screenshots:** Homepage capturado (`:3000`). Los dos componentes NO se pudieron capturar renderizados: el reporte agrupado (`/audits/[id]`) y la lista de páginas (`/audits/[id]/pages`) requieren un `auditId` válido tras verificación de email; sin auditoría sembrada no hay ruta alcanzable. Auditoría de los componentes: por código.
**Alcance:** Advisory (no bloqueante). Dos adiciones presentacionales pequeñas (dropdown de grupo + badge de 4 estados).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Adherencia al contrato | 4/4 | Anatomía details/summary y mapeo 4 estados→variantes exactos al UI-SPEC |
| 2. Tokens/theming | 4/4 | Cero hex; solo tokens semánticos; 4 estados reusan variantes existentes de `Badge` |
| 3. Accesibilidad | 3/4 | `role="region"` aplicado incondicionalmente a cada grupo → ruido de landmarks |
| 4. Responsive/layout | 3/4 | `.summary` sin wrap y `.groupTitle` sin `min-width:0` → riesgo de overflow con títulos largos en ≤360px |
| 5. Estados | 4/4 | collapsed/expanded/hover/focus correctos; EmptyState preservado sin grupos vacíos |
| 6. Copy | 4/4 | Español neutro sin voceo; singular/plural de páginas correcto; copy JSON-LD literal al contrato |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Overflow del summary en pantallas angostas** — Un `issue.title` largo puede empujar el `SeverityBadge`/conteo/chevron fuera del canvas en ~320-360px porque `.summary` no envuelve y `.groupTitle` no tiene `min-width:0` — Añadir `min-width:0` + `overflow:hidden; text-overflow:ellipsis` a `.groupTitle` (o `flex-wrap:wrap` en `.summary` con `flex-shrink:0` en `.meta`), en `IssueTypeGroup.module.css`.
2. **Ruido de landmarks por `role="region"` incondicional** — Cada grupo emite un landmark "región" con `aria-label`, así que un reporte con decenas de tipos de issue satura el árbol de a11y con decenas de regiones — Aplicar `role="region"`/`tabIndex={0}` solo cuando el contenido realmente desborda (o mover el scroll a un contenedor interno), en `IssueTypeGroup.tsx`.
3. **Copy "1 entidad(es) JSON-LD" (advisory)** — El caso `ok` con `nodeCount === 1` lee raro frente al conteo de páginas que sí resuelve singular/plural — Aunque el contrato dicta la cadena `{n} entidad(es)`, se recomienda `1 entidad` / `{n} entidades` para igualar la calidad del `pageCount`. Requiere una nota/ajuste en el UI-SPEC antes de cambiar.

---

## Detailed Findings

### Pillar 1: Adherencia al contrato (4/4)
- `IssueTypeGroup.tsx:58-91` reproduce la anatomía del UI-SPEC (líneas 99-114) con fidelidad: `<details class=group>` → `<summary>` con `groupTitle` + `meta` (`SeverityBadge` de la severidad del grupo + `count` + `ChevronDown size=20 aria-hidden`) → `<div class=body>` con filas de página afectada. Padding `--space-3 --space-5` (`.module.css:28`) coincide con el "12px/20px" especificado.
- Orden como única fuente de verdad: `groupIssuesByType` (`packages/report-model/src/grouping.ts:41-73`) ordena severidad peor-primero (`SEVERITY_WEIGHT`) luego conteo descendente; la UI solo mapea (`IssueTypeGroup.tsx:53-57`), no reordena. Reusado idéntico en "Issues prioritarios" (`[id]/page.tsx:223`) y "Detalle por categoría" (`[id]/page.tsx:319-322`) dentro de los `AccordionSubgroup` existentes, como pide el contrato (línea 131).
- Fila de página afectada: URL con salvaguarda de esquema `^https?://` (`IssueTypeGroup.tsx:26`, igual que `IssuesTable`), `measuredValue ?? "—"` en Geist Mono `tnum` (`.module.css:133-137`), y `DiffBadge` solo si `issue.diffStatus` existe (`IssueTypeGroup.tsx:87`). Coincide con UI-SPEC líneas 117-124.
- JsonLdBadge (`JsonLdBadge.tsx:18-23`): mapeo `error→critical`, `warning→warning`, `ok→ok`, `absent→neutral` idéntico a la tabla del contrato (líneas 149-154). Precedencia error>advertencia>correcto>ausente delegada al helper puro `jsonLdStateForPage` (`jsonld.ts:20-27`). Badge estático no-focusable, como hoy.
- Nota menor sin defecto: el "·" que aparece en el formato ilustrativo del summary (UI-SPEC línea 127) no se renderiza como carácter; el DOM usa spans separados con el badge en medio. Es coherente con la anatomía autoritativa (líneas 99-114) y con el Copywriting Contract (línea 170 lista el conteo sin middot). No es divergencia.

### Pillar 2: Tokens/theming (4/4)
- Cero hex/`rgb()` en los tres archivos nuevos (grep sin resultados).
- Todo semántico: `--surface`, `--border`, `--radius-md`, `--surface-hover`, `--text`, `--text-secondary`, `--ring`, `--space-*`, fuentes por variable. Confirmado en `IssueTypeGroup.module.css` completo.
- Sin colores nuevos para los 4 estados: `JsonLdBadge.tsx` mapea a variantes ya definidas en `Badge.module.css`; el estado `absent` reusa `.neutral` (`--text-secondary` sobre `--surface-hover`, `Badge.module.css:63-66`). El lime (`--ring`) aparece solo en `focus-visible`, nunca como fondo ni señal de estado (`.module.css:41-44, 93-96`), respetando la reserva de acento del contrato (línea 74).

### Pillar 3: Accesibilidad (3/4)
- Positivos: disclosure nativo (`<summary>` real, teclado Enter/Space y estado `expanded` gratis, sin `aria-expanded` manual); anillo lime inset `2px --ring / offset -2px` en summary y en la región de scroll (`.module.css:41-44, 93-96`); chevron `aria-hidden` con `transition:none` bajo `prefers-reduced-motion` (`.module.css:66-81`) más la red global de `globals.css:103`. El `SeverityBadge` dentro del summary aporta su texto ("Crítico", etc.) al nombre accesible del disclosure — refuerzo útil, no ruido.
- **WARNING — landmarks:** `IssueTypeGroup.tsx:69-73` pone `role="region"` + `aria-label` + `tabIndex={0}` en el `.body` de **todos** los grupos, no solo cuando la lista desborda (que es la justificación del contrato, líneas 124/186). Con decenas de tipos de issue, el lector de pantalla anuncia decenas de regiones, contaminando el árbol de landmarks. Condicionar a overflow real o encapsular el scroll en un contenedor interno.

### Pillar 4: Responsive/layout (3/4)
- Filas del cuerpo del grupo: `flex-wrap:wrap` + `overflow-x:auto` en `.body` (`.module.css:83-90`); las celdas apilan etiqueta/valor con `min-width:0` (`.module.css:111-116`). Correcto en angosto.
- Lista de páginas (`pages.module.css`): `.row` colapsa a `flex-direction:column` con `align-items:flex-start` en breakpoint (líneas 105-107) y `rowLink` usa `word-break:break-all` — el `JsonLdBadge` no desborda. Correcto.
- **WARNING — summary del grupo:** `.summary` (`.module.css:22-30`) es `flex` con `justify-content:space-between` **sin** `flex-wrap`, y `.groupTitle` (`.module.css:46-52`) no tiene `min-width:0` ni truncación; `.meta` no fija `flex-shrink:0`. Con un `issue.title` largo en ~320-360px, el título (min-width auto) no encoge y puede empujar badge/conteo/chevron, produciendo overflow horizontal del summary. No verificado visualmente (ruta no alcanzable), inferido del CSS.

### Pillar 5: Estados (4/4)
- Collapsed/Expanded: `details[open] .chevron { transform:rotate(180deg) }` (`.module.css:72-74`), body con `border-top` al expandir (`.module.css:84`). Hover `--surface-hover` (`.module.css:37-39`). Focus-visible cubierto.
- Empty preservado: `[id]/page.tsx:215-221` conserva el `EmptyState` de "Issues prioritarios" y no renderiza grupos vacíos (`groupIssuesByType([]) → []`, no imprime nada); en "Detalle por categoría" las categorías sin issues hacen `return null` (`:306`). Coincide con el contrato (línea 141).

### Pillar 6: Copy (4/4)
- Español neutro, sin voceo en todas las cadenas nuevas.
- Singular/plural de páginas resuelto de verdad: `pageCount` → `1 página` / `N páginas` (`IssueTypeGroup.tsx:16-18`).
- Copy JSON-LD literal al contrato (líneas 149-154): "JSON-LD con errores", "JSON-LD con advertencias", "{n} entidad(es) JSON-LD", "Sin JSON-LD" (`JsonLdBadge.tsx:26-37`). Etiquetas de fila "Página / URL" y "Valor medido" exactas (`IssueTypeGroup.tsx:78, 82`).
- Advisory: "1 entidad(es) JSON-LD" hereda la forma con paréntesis del contrato; queda inconsistente con la calidad del `pageCount`. Cambio requiere tocar primero el UI-SPEC (línea 175).

---

## Registry Safety
No aplica: `shadcn_initialized: false` en el UI-SPEC y sin `components.json`. Sin registries de terceros. Auditoría de registry omitida.

---

## Files Audited
- `apps/web/app/components/ui/IssueTypeGroup.tsx`
- `apps/web/app/components/ui/IssueTypeGroup.module.css`
- `apps/web/app/components/ui/JsonLdBadge.tsx`
- `apps/web/app/audits/[id]/page.tsx`
- `apps/web/app/audits/[id]/pages/page.tsx`
- `apps/web/app/audits/[id]/pages/pages.module.css`
- Referencia: `apps/web/app/components/ui/Badge.tsx`, `Badge.module.css`, `apps/web/app/globals.css`
- Helpers: `packages/report-model/src/grouping.ts`, `packages/report-model/src/jsonld.ts`
