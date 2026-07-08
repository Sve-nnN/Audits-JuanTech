---
phase: 15
slug: ux-del-reporte-agrupaci-n-e-indicadores
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-08
---

# Phase 15 — UI Design Contract

> Contrato visual y de interacción para "UX del reporte — agrupación e indicadores". Generado por gsd-ui-researcher, verificado por gsd-ui-checker.
>
> Alcance LEAN: esta fase NO introduce lenguaje de diseño nuevo. Reutiliza primitivos ya validados (`CategoryAccordion` details/summary, `Badge`/`SeverityBadge`, `IssuesTable`). Solo se especifica lo que cambia: (1) el **dropdown de grupo de issues** reusado en "Issues prioritarios" y "Detalle por categoría", y (2) el **badge de estado JSON-LD** de 4 estados en la lista de páginas.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (tokens propios en `apps/web/app/tokens.css`, dark-first + `[data-theme="light"]`) |
| Preset | not applicable |
| Component library | none (primitivos propios sobre `details`/`summary` nativos) |
| Icon library | lucide-react (`ChevronDown`, iconos de severidad ya mapeados en `Badge.tsx`) |
| Font | Headings Khand (`--font-khand`), cuerpo Geist Sans (`--font-geist-sans`), valores medidos Geist Mono + `tnum` |

Regla dura: **solo tokens semánticos**, cero hex crudo. Copy español neutro **sin voceo**.

---

## Spacing Scale

Escala existente de `tokens.css` (base 4px, todos múltiplos de 4). Esta fase reusa la del `CategoryAccordion` sin excepciones.

| Token | Value | Usage en esta fase |
|-------|-------|--------------------|
| `--space-1` | 4px | Gap de icono/badge dentro del summary |
| `--space-2` | 8px | Gap entre badge de severidad y conteo en el summary; gap de badge JSON-LD |
| `--space-3` | 12px | Gap del summary; separación entre filas de página afectada; margen inferior entre grupos (`margin-bottom` del `.group`) |
| `--space-5` | 20px | Padding horizontal del summary; padding del `.body` expandido |

Exceptions: none.

---

## Typography

Roles existentes reutilizados (sin nuevos tamaños ni pesos).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Título de grupo (summary) | `--font-size-sm` 14px | `--weight-semibold` 600 | `--lh-snug` 1.35 |
| Conteo de páginas afectadas (summary meta) | `--font-size-sm` 14px | `--weight-regular` 400 | 1.4 |
| Badge (severidad / JSON-LD) | `--font-size-xs` 12px | 600 | 1.4 |
| Fila de página afectada — etiqueta | 11px uppercase `.03em` | 400 | — |
| Fila de página afectada — valor medido | `--font-size-sm` 14px, Geist Mono `tnum` | 400 | 1.5 |

Nota: el summary del **grupo de tipo** usa `--font-size-sm` (no el `--font-size-xl` Khand del `CategoryAccordion` de categoría). El grupo de tipo es un nivel jerárquico inferior a la categoría; su título va en Geist Sans semibold, no en Khand, para no competir con el título de categoría.

---

## Color

Split existente del reporte (dark-first). Esta fase no cambia el 60/30/10.

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg` / `--surface` | Canvas del reporte y superficie de los grupos |
| Secondary (30%) | `--surface-hover`, `--border` | Hover del summary, divisores entre filas y bordes de grupo |
| Accent (10%) | `--accent` / `--ring` (lime) | **Solo** el anillo `focus-visible` del summary. El lime NO se usa como fondo ni como señal de estado de datos |
| Destructive | `--critical` (rojo) | Estado JSON-LD "error" y badge de severidad `critical` |

Accent reserved for: exclusivamente el `outline` de `focus-visible` (2px `--ring`, `outline-offset:-2px`) del `<summary>`. El acento lime nunca codifica severidad ni estado JSON-LD.

### Mapeo de color por estado (reusa variantes de `Badge`, sin colores nuevos)

| Señal | Variante Badge | Token de color | Fondo |
|-------|----------------|----------------|-------|
| Severidad crítica / JSON-LD error | `critical` | `--critical` | `--sev-critical-bg` |
| Severidad advertencia / JSON-LD advertencia | `warning` | `--warning` | `--sev-warn-bg` |
| Severidad correcta / JSON-LD correcto | `ok` | `--success` | `--sev-good-bg` |
| Sin JSON-LD (neutral) | `neutral` | `--text-secondary` | `--surface-hover` |

El color nunca es señal única: cada badge lleva **texto** con el significado.

---

## Componente 1 — Dropdown de grupo de issues (REPORT-01 / REPORT-02)

Grupo colapsable por **tipo de issue** (`checkId` + `title`), reusado idéntico en "Issues prioritarios" y dentro de cada categoría en "Detalle por categoría". Construido sobre `details`/`summary` nativos, mismo patrón que `CategoryAccordion` (sin JS de estado, teclado y AT gratis).

### Fuente de datos
- Helper puro `groupIssuesByType(issues: ReportIssue[])` en `@auditor/report-model`. Devuelve `{ checkId, title, severity, count, issues }[]` **ya ordenado**.
- Orden (única fuente de verdad, idéntico en ambas ubicaciones): **severidad peor-primero** (`critical` → `warning` → `ok`) **luego cantidad de páginas afectadas descendente**. La UI solo renderiza; no reordena.

### Anatomía

```
<details class=group>                     ← superficie: --surface, borde --border, radius --radius-md
  <summary class=summary>                 ← flex, space-between, padding 12px/20px, cursor pointer
    <span class=groupTitle>               ← Geist Sans semibold 14px, color --text
       Imágenes sin alt text             ← issue.title
    </span>
    <span class=meta>                      ← flex, align-center, gap --space-2
       <SeverityBadge severity=… />        ← badge de la severidad del grupo (peor del grupo)
       <span class=count>12 páginas</span> ← conteo de páginas afectadas, --text-secondary 14px
       <ChevronDown aria-hidden />         ← 20px, --text-secondary, rota 180° en [open]
    </span>
  </summary>
  <div class=body>                         ← border-top --border, padding --space-5
    (filas de páginas afectadas — ver abajo)
  </div>
</details>
```

### Contenido expandido — fila de página afectada
Reusa el estilo de fila de `IssuesTable` / `IssueDetail`. Cada fila = una página afectada por ese tipo de issue:

- **URL de la página** — enlace (`shortUrl`, `title` con URL completa, abre en pestaña nueva solo si empieza por `http`/`https`; misma salvaguarda de esquema que `IssuesTable`).
- **Valor medido** — `issue.measuredValue ?? "—"`, Geist Mono + `tnum`.
- **Estado / diff** — `DiffBadge` cuando `issue.diffStatus` existe (`new` / `persistent` / `resolved`); si no, se omite.

Cuando la lista de páginas de un grupo es larga, la región de filas se desplaza igual que `IssuesTable` (overflow-x auto, región enfocable por teclado con `role="region"` + `aria-label`). No colapsa a cards.

### Copy del summary
Formato: `{title} · {count} página(s)`. Ejemplos:
- `Imágenes sin alt text · 12 páginas`
- `Meta description ausente · 1 página` (singular cuando `count === 1`)

En "Detalle por categoría" los grupos siguen anidados dentro de `AccordionSubgroup` (`Problemas` / `Correcto`) existentes; la agrupación por tipo reemplaza el listado plano de issues dentro de cada subgrupo, conservando el resto del acordeón de categoría intacto.

### Estados de interacción

| Estado | Regla visual |
|--------|--------------|
| Collapsed | `details` sin `open`. Chevron a 0°. Solo summary visible |
| Expanded | atributo `open` nativo. Chevron rotado 180° (transición `transform .2s ease`) |
| Hover (summary) | fondo `--surface-hover` |
| Focus-visible (summary) | `outline: 2px solid var(--ring)`, `outline-offset: -2px` (anillo lime inset) |
| Empty | si una sección/categoría no tiene issues se conserva el `EmptyState` actual **sin cambios**; no se renderiza ningún grupo vacío |

---

## Componente 2 — Badge de estado JSON-LD (REPORT-04)

En `apps/web/app/audits/[id]/pages/page.tsx` el badge actual de 2 estados pasa a **4 estados**, derivados por un helper puro que cruza los issues de categoría `schema` de la página (por `pageId`) con la presencia de `schemaGraph`. Mapea al **peor** estado.

| Estado | Condición | Variante Badge | Copy (español neutro) |
|--------|-----------|----------------|-----------------------|
| error | existe algún issue schema `critical` en la página | `critical` (rojo) | `JSON-LD con errores` |
| advertencia | existe algún issue schema `warning` y ninguno `critical` | `warning` (amarillo) | `JSON-LD con advertencias` |
| correcto | hay `schemaGraph` con nodos y ningún problema | `ok` (verde) | `{n} entidad(es) JSON-LD` |
| sin JSON-LD | no hay `schemaGraph` | `neutral` | `Sin JSON-LD` |

Reglas:
- Reusa `Badge` / `SeverityBadge` existentes. **Cero colores nuevos** (mapeo directo a variantes ya definidas en `Badge.module.css`).
- Precedencia: error > advertencia > correcto > sin JSON-LD.
- El texto porta el significado; el color es refuerzo, no señal única.
- El badge es estático (no focusable), igual que hoy.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Título de grupo | `{issue.title}` (verbatim del modelo, ya en español neutro) |
| Conteo de grupo | `{count} página` (singular) / `{count} páginas` (plural) |
| Fila — etiqueta URL | `Página / URL` |
| Fila — etiqueta valor | `Valor medido` |
| Empty state (sin issues en sección) | Se conserva el actual: `Sin issues críticos ni de advertencia. Buen trabajo.` (Issues prioritarios) / `Sin problemas en esta categoría.` (subgrupo) — sin cambios |
| JSON-LD error | `JSON-LD con errores` |
| JSON-LD advertencia | `JSON-LD con advertencias` |
| JSON-LD correcto | `{n} entidad(es) JSON-LD` |
| JSON-LD ausente | `Sin JSON-LD` |
| Destructive confirmation | not applicable (esta fase no tiene acciones destructivas) |

Sin voceo en ninguna cadena. No usar "Ingresá/podés/tenés".

---

## Accesibilidad

- **Teclado nativo:** el dropdown de grupo es `<summary>` real — expande/colapsa con Enter/Space, expone el estado `expanded` en el árbol de a11y automáticamente. No se añade JS de estado ni `aria-expanded` manual.
- **Focus-visible:** anillo lime inset (`2px --ring`, `offset -2px`) en el summary; el skip-link global y el `--shadow-focus` ya cubren el resto.
- **prefers-reduced-motion:** la rotación del chevron y toda transición quedan neutralizadas por la red de seguridad global de `globals.css`; el contenido de `[data-reveal]` siempre queda visible.
- **Orden anunciado consistente:** el orden severidad→cantidad proviene del helper único, así lo que anuncia el lector de pantalla coincide en "Issues prioritarios" y "Detalle por categoría".
- **Color nunca único:** cada badge (severidad y JSON-LD) lleva etiqueta textual; los iconos lucide son `aria-hidden`.
- **Chevron decorativo:** `aria-hidden="true"`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none (sin shadcn) | not applicable | not applicable |

No se usan registries de terceros. Todos los primitivos son propios del repo.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
