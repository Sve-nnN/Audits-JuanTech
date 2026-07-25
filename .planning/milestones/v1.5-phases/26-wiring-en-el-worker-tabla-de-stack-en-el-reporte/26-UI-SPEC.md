---
phase: 26
slug: wiring-en-el-worker-tabla-de-stack-en-el-reporte
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-21
---

# Phase 26 — UI Design Contract

> Contrato visual y de interacción para "Wiring en el worker + tabla de stack en el reporte". Generado por gsd-ui-researcher, verificado por gsd-ui-checker.
>
> Alcance LEAN: esta fase **no** introduce lenguaje de diseño nuevo. Reutiliza primitivos ya validados (`Badge`, `.section`/`.sectionTitle` del reporte, patrón de superficie de `IssuesTable`). Lo único que se especifica es: (1) un **componente `StackTable` nuevo** (tabla clave/valor de 5 ejes) insertado en el reporte tras el `ScoreGauge`/hero y antes de las `CategoryCards`, y (2) **una variante nueva de `Badge`** (`warningSubtle`) para el nivel de confianza `bajo`. Todo lo demás reusa tokens y variantes existentes.
>
> Requisitos cubiertos por la UI: STACKUI-01 (tabla al inicio del reporte), STACKUI-02 (cada eje con su confianza), STACKUI-03 (consistente con el design system, tokens, ambos temas). FPRINT-09 es persistencia en el worker (sin UI).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (tokens propios en `apps/web/app/tokens.css`, dark-first + override `[data-theme="light"]`) |
| Preset | not applicable (no shadcn; no existe `components.json` — design system propio de CSS Modules desde v1.1) |
| Component library | none (primitivos propios del repo; `Badge` en `apps/web/app/components/ui/Badge.tsx`) |
| Icon library | lucide-react (`CheckCircle2` para `alto`, `AlertTriangle` para `medio`/`bajo`; `neutral` sin icono) |
| Font | Título de sección en Khand (`--font-khand`); cuerpo/celdas en Geist Sans (`--font-geist-sans`); `Badge` en Geist Sans |

Regla dura del proyecto: **solo tokens semánticos**, cero hex crudo, ambos temas (claro/oscuro), sin overflow horizontal. Copy en español neutro **sin voceo**.

---

## Spacing Scale

Escala existente de `tokens.css` (base 4px, todos múltiplos de 4). Esta fase reutiliza los mismos tokens que `IssuesTable` y `.section` del reporte, sin excepciones.

| Token | Value | Usage en esta fase |
|-------|-------|--------------------|
| `--space-1` | 4px | Gap del icono dentro del `Badge` de confianza; margen inferior de la etiqueta de eje en el layout mobile apilado |
| `--space-2` | 8px | Gap entre el valor detectado y su `Badge` de confianza; gap entre chips de la fila Analytics (wrap) |
| `--space-3` | 12px | Padding vertical de cada celda (`padding: var(--space-3) var(--space-4)`) — idéntico a `IssuesTable td` |
| `--space-4` | 16px | Padding horizontal de cada celda; padding del bloque de fila en layout mobile apilado |
| `--space-10` | 40px | `margin-bottom` de la sección completa (reusa `.section` del reporte) |

Exceptions: none.

---

## Typography

Roles existentes reutilizados. **Sin tamaños ni pesos nuevos.**

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Título de sección "Stack técnico detectado" | `--font-size-2xl` 24px, Khand (`--font-khand`) | `--weight-semibold` 600 | `--lh-heading` 1.2 |
| Etiqueta de eje (columna izquierda / `<th scope="row">`) | `--font-size-sm` 14px, Geist Sans | `--weight-semibold` 600 | 1.4 |
| Valor detectado (celda de detección) | `--font-size-sm` 14px, Geist Sans | `--weight-regular` 400 | 1.5 |
| Texto "No detectado con certeza" | `--font-size-sm` 14px, Geist Sans | `--weight-regular` 400 | 1.5 |
| `Badge` de confianza / chip de analytics | `--font-size-xs` 12px | 600 | 1.4 |

Notas:
- El título usa exactamente el estilo `.sectionTitle` ya definido en `report.module.css` (Khand, 24px, semibold, `--lh-heading`) y se renderiza como **`<h3>`**, mismo nivel jerárquico que "Scores por categoría" / "Issues prioritarios" (CONTEXT: "mismo nivel jerárquico que los títulos de categoría existentes").
- La etiqueta de eje va en Geist Sans semibold (no Khand): es contenido de tabla, no un heading; no debe competir con el título de sección.

---

## Color

Split existente del reporte (dark-first). Esta fase **no** cambia el 60/30/10 ni introduce colores.

| Role | Token | Usage en esta fase |
|------|-------|--------------------|
| Dominant (60%) | `--bg` / `--surface` | Canvas del reporte y superficie de la tarjeta que contiene la tabla |
| Secondary (30%) | `--surface-hover`, `--border` | Hover de fila, divisores entre filas y borde de la tarjeta contenedora |
| Accent (10%) | `--accent` / `--ring` (lime) | **No se usa en esta tabla** como fondo ni como señal de dato. El lime queda reservado globalmente para CTA, nav activo y anillo `focus-visible`; la tabla no tiene elementos focusables propios, así que no consume accent |
| Destructive | `--critical` (rojo) | **Prohibido en esta tabla.** La confianza de detección NUNCA se mapea a `critical`: no es severidad de error de auditoría (CONTEXT + FPRINT-08) |

Accent reserved for: CTA / nav activo / anillo `focus-visible` global (`--ring`). Ningún elemento de la `StackTable` usa lime como señal de confianza ni de estado.

### Mapeo de confianza → variante de `Badge` (las 4 variantes visuales)

| Confianza (`Confidence`) | Variante `Badge` | Token de color | Fondo | Icono lucide |
|--------------------------|------------------|----------------|-------|--------------|
| `alto` | `ok` (existente) | `--success` (verde) | `--sev-good-bg` (soft-fill 12%) | `CheckCircle2` |
| `medio` | `warning` (existente) | `--warning` (ámbar) | `--sev-warn-bg` (soft-fill 12%) | `AlertTriangle` |
| `bajo` | `warningSubtle` (**NUEVA**) | `--warning` (ámbar) | transparente + borde `color-mix(in srgb, var(--warning) 35%, transparent)` | `AlertTriangle` |
| `no-detectado` | `neutral` (existente) | `--text-secondary` (gris) | `--surface-hover` | ninguno |

- `bajo` es la única variante nueva: ámbar en outline tenue (fondo transparente + borde ámbar al 35%), visualmente **más liviana** que `medio` (soft-fill sólido), para "warning tenue/outline" del CONTEXT. Se añade como clase `.warningSubtle` en `Badge.module.css` y como valor `"warningSubtle"` en `BadgeVariant` de `Badge.tsx`, respetando el patrón `color-mix` sobre token (cero hex crudo, CSP-safe).
- `no-detectado` reutiliza la variante `neutral` ya existente — no requiere código nuevo en `Badge`.
- El color nunca es señal única: cada `Badge` lleva **texto** ("Confianza alta/media/baja", "No detectado con certeza") y, salvo `neutral`, un icono redundante. `critical` (rojo) queda excluido por contrato.

---

## Componente — `StackTable` (STACKUI-01 / STACKUI-02 / STACKUI-03)

Tabla clave/valor de **2 columnas** (Categoría | Detección) con **5 filas fijas**, insertada en `apps/web/app/audits/[id]/page.tsx` como una `<Reveal as="section">` **inmediatamente después del hero de "Score general" y antes de "Scores por categoría"** (CONTEXT: al inicio, tras el `ScoreGauge`/header, antes de las `CategoryCards`).

Archivos nuevos: `apps/web/app/components/ui/StackTable.tsx` + `StackTable.module.css`. Consume el modelo de `@auditor/report-model` (que a su vez lee `Audit.stack: DetectedStack`).

### Filas (siempre 5, en este orden, nunca se ocultan)

| # | Etiqueta de eje (Categoría) | Origen en `DetectedStack` | Contenido de la celda Detección |
|---|-----------------------------|---------------------------|---------------------------------|
| 1 | **CMS** | `cms` (+ `builder` combinado) | Nombre del CMS; si `cms.value === "WordPress"` y `builder.value` existe → `"WordPress (Elementor)"` en una sola celda. `Badge` de confianza = `cms.confidence` |
| 2 | **CDN / proxy** | `cdn` | `cdn.value` + `Badge` de `cdn.confidence` |
| 3 | **Hosting** | `hosting` | `hosting.value` + `Badge` de `hosting.confidence` |
| 4 | **Framework JS** | `jsFramework` | `jsFramework.value` + `Badge` de `jsFramework.confidence` |
| 5 | **Analytics** | `analytics` (array) | **Lista de chips** — un `Badge` por herramienta detectada (`GA4`, `GTM`, `Meta Pixel`), cada chip coloreado por la confianza de esa herramienta (mismo mapeo). Si el array está vacío → estado "no detectado" como las demás filas |

### Anatomía

```
<section class=section>                      ← margin-bottom --space-10 (reusa .section del reporte)
  <h3 class=sectionTitle>                     ← Khand 24px semibold, --lh-heading (reusa .sectionTitle)
     Stack técnico detectado
  </h3>
  <table class=table>                          ← contenedor: --surface, borde 1px --border, radius --radius-md
    <caption class=caption>…</caption>         ← visually-hidden, describe la tabla para AT
    <tbody>
      <tr class=row>                           ← divisor inferior 1px --border; última fila sin borde; hover --surface-hover
        <th scope=row class=axis>CMS</th>      ← Geist Sans semibold 14px, --text-secondary
        <td class=detection>                   ← flex, align-center, gap --space-2, wrap
           <span class=value>WordPress (Elementor)</span>   ← Geist Sans 14px, --text
           <Badge variant=ok>Confianza alta</Badge>
        </td>
      </tr>
      …
      <tr class=row>                            ← fila Analytics (multi-chip)
        <th scope=row class=axis>Analytics</th>
        <td class=detection>                    ← flex wrap, gap --space-2
           <Badge variant=ok>GA4</Badge>
           <Badge variant=ok>GTM</Badge>
           <Badge variant=warning>Meta Pixel</Badge>
        </td>
      </tr>
    </tbody>
  </table>
</section>
```

### Reglas de contenido

- **CMS + builder combinados** en una sola celda: `"WordPress (Elementor)"` cuando hay builder detectado; solo `"WordPress"` cuando el builder es `no-detectado`; el `Badge` de la fila refleja `cms.confidence` (no la del builder). No hay fila separada de builder (5 filas, no 6).
- **Fila "no detectado con certeza"** (cualquier eje con `confidence === "no-detectado"` o, en Analytics, array vacío): la fila **se muestra igual, nunca se oculta**. La celda Detección muestra el texto literal **"No detectado con certeza"** en `--text-secondary` acompañado del `Badge` `neutral` con etiqueta **"No detectado"**. No se muestra nombre de tecnología inventado. Es informativo, no un error.
- **Analytics es el único eje multi-valor**: se renderiza como lista de chips separados (uno por herramienta), nunca como texto plano separado por comas. Cada chip lleva el nombre de la herramienta como texto y su confianza como color+icono.
- La `StackTable` **no se renderiza en absoluto** cuando `Audit.stack` es `null` (auditorías pre-v1.5 o corridas sin stack): nunca se muestra una tabla vacía con los 5 ejes en "no detectado" artificialmente. La decisión de render/no-render vive en `page.tsx` según el modelo; el componente asume que recibe un `DetectedStack` no nulo.

### Layout responsive

- **Desktop (≥ `--bp-sm` 640px):** tabla de 2 columnas. Columna de eje con ancho contenido (auto/min-content), columna de detección flexible. Padding de celda `var(--space-3) var(--space-4)`, divisores 1px `--border`, hover de fila `--surface-hover` — mismo lenguaje de superficie que `IssuesTable`.
- **Mobile (< `--bp-sm` 640px):** **colapsa a lista vertical apilada** (CONTEXT). Cada fila pasa a un bloque: la etiqueta de eje arriba (14px semibold, `--text-secondary`, `margin-bottom var(--space-1)`) y debajo la celda de detección (valor + `Badge`/chips). Padding de bloque `var(--space-4)`, divisor 1px `--border` entre bloques.
- **Sin overflow horizontal:** a diferencia de `IssuesTable` (que usa scroll horizontal con `min-width` por tener muchas columnas medidas), esta tabla es clave/valor de 2 columnas y colapsa limpiamente a vertical; **no** se usa scroll horizontal. Se conserva el mismo patrón de "colapso responsive" que pide el CONTEXT, adaptado a una tabla angosta.

### Estados de interacción

| Estado | Regla visual |
|--------|--------------|
| Default | Tabla estática, no interactiva (sin enlaces ni botones dentro) |
| Hover de fila | Fondo `--surface-hover` (instantáneo, seguro para reduced-motion) |
| Reveal de entrada | La sección entra con el mismo `<Reveal>` que el resto del reporte; neutralizado por `prefers-reduced-motion` global |
| Ausencia total (`Audit.stack === null`) | La sección completa no se renderiza (ver Copywriting / UI Considerations) |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Título de sección | `Stack técnico detectado` |
| Etiqueta eje 1 | `CMS` |
| Etiqueta eje 2 | `CDN / proxy` |
| Etiqueta eje 3 | `Hosting` |
| Etiqueta eje 4 | `Framework JS` |
| Etiqueta eje 5 | `Analytics` |
| Confianza alta | `Confianza alta` |
| Confianza media | `Confianza media` |
| Confianza baja | `Confianza baja` |
| Valor no detectado (celda) | `No detectado con certeza` |
| Badge no detectado | `No detectado` |
| CMS combinado (ejemplo) | `WordPress (Elementor)` — patrón `{cms} ({builder})`; sin builder: `WordPress` |
| Chips de analytics (ejemplos) | `GA4`, `GTM`, `Meta Pixel` (nombres verbatim del motor de fingerprint) |
| Primary CTA | not applicable (esta fase es una tabla informativa de solo lectura; no hay CTA) |
| Empty state | La sección **no se renderiza** cuando `Audit.stack` es `null` — no existe copy de tabla vacía por diseño (nunca se fuerza "todo no detectado") |
| Error state | not applicable a nivel de componente: el reporte solo se ensambla cuando `audit.status === "done"`; un stack ausente se resuelve ocultando la sección, no con mensaje de error |
| Destructive confirmation | not applicable (esta fase no tiene acciones destructivas) |

Sin voceo en ninguna cadena. No usar "Ingresá/podés/tenés". Copy neutro humanizado.

---

## UI Considerations

> Cobertura de *estados* de UI enraizados en la forma de los datos (empty / zero-one-many / long-text / partial). El copy de empty/error vive en `## Copywriting Contract` y aquí solo se referencia (de-dup).

Applicable state considerations resolved: 5 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | `StackTable` (audit sin stack) | ✅ covered | Cuando `Audit.stack === null`, la sección completa no se renderiza; `page.tsx` guarda el render con el modelo, nunca se pinta tabla vacía (ver Copywriting → Empty state) |
| partial | filas por-eje `no-detectado` | ✅ covered | Cada eje sin señal muestra la fila igual con "No detectado con certeza" + `Badge` `neutral`; las 5 filas siempre presentes, nunca se ocultan ejes individuales |
| zero-one-many | fila Analytics (`analytics: AxisResult[]`) | ✅ covered | 0 herramientas → estado "no detectado"; 1 herramienta → un chip; N herramientas → lista de chips con `flex-wrap` y gap `--space-2`, cada uno con su color de confianza |
| long-text | valor de detección (p. ej. `"WordPress (Elementor)"`, framework largo) | ✅ covered | La celda de detección permite wrap (no `nowrap`); el `Badge` cae a la siguiente línea vía `flex-wrap`; en mobile el bloque apilado da ancho completo al valor |
| overflow | tabla en viewport angosto (< 640px) | ✅ covered | Colapsa a lista vertical apilada (sin scroll horizontal); ningún contenido excede el ancho del contenedor |

---

## Accesibilidad

- **Tabla semántica:** `<table>` real con `<caption>` visually-hidden que la describe ("Stack técnico detectado por eje y nivel de confianza") y `<th scope="row">` para la etiqueta de cada eje, de modo que el lector de pantalla anuncia la relación eje→detección.
- **Color nunca único:** cada `Badge` de confianza lleva etiqueta textual ("Confianza alta/media/baja", "No detectado") además del color; `alto`/`medio`/`bajo` refuerzan con icono lucide (`aria-hidden`). En los chips de Analytics el **texto** porta la herramienta (señal primaria) y color+icono aportan la confianza como refuerzo redundante, no como único canal.
- **`no-detectado` legible:** el texto explícito "No detectado con certeza" garantiza que la ausencia de señal se comunica sin depender del gris del `Badge`.
- **Sin trampas de foco:** la tabla no tiene elementos interactivos propios; no añade orden de tabulación nuevo. El anillo `focus-visible` global (`--ring`) sigue cubriendo cualquier control externo.
- **prefers-reduced-motion:** el `<Reveal>` de entrada y el hover quedan neutralizados por la red de seguridad global de `globals.css`; el contenido permanece visible.
- **Contraste AA en ambos temas:** todos los tokens usados (`--success`, `--warning`, `--text-secondary`, `--border`, `--surface`) ya cumplen AA en claro y oscuro por diseño de `tokens.css`; la variante `warningSubtle` usa `--warning` como foreground (el mismo que `medio`), que ya es AA sobre `--surface`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none (sin shadcn) | not applicable | not applicable |

No se usan registries de terceros. `Badge` es un primitivo propio del repo; la variante `warningSubtle` se añade en código del proyecto. Sin `npx shadcn`, sin bloques externos.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
