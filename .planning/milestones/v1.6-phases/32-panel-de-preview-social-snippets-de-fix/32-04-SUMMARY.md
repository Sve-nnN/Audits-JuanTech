---
phase: 32-panel-de-preview-social-snippets-de-fix
plan: 04
subsystem: web report UI
tags: [social, preview, tabs, a11y, ui, preview-02, preview-03]
status: complete
requires:
  - "PreviewImage (Plan 32-02)"
  - "FixSnippet (Plan 32-03)"
  - "GooglePreview + SocialPreviewPanel single-view (Plan 32-01)"
provides:
  - "SocialCardPreview — tarjeta 1.91:1 de Facebook/LinkedIn"
  - "SocialCardLayout / SocialCardText — layout y bloque textual compartidos"
  - "XPreview — variantes summary y summary_large_image"
  - "SocialPreviewPanel con tablist WAI-ARIA de 3 sub-vistas + FixSnippet condicional"
affects:
  - "apps/web/app/components/ui/IssueTypeGroup.test.tsx (el título ahora aparece en 2 de los 3 paneles)"
tech-stack:
  added: []
  patterns:
    - "El clamp de truncado vive en un único módulo CSS (SocialCardPreview.module.css) consumido por las tres tarjetas: duplicarlo es la forma más rápida de que se desincronicen"
    - "Los paneles inactivos del tablist usan el atributo HTML hidden, nunca display:none por clase ni desmontaje"
key-files:
  created:
    - apps/web/app/audits/[id]/social/SocialCardPreview.tsx
    - apps/web/app/audits/[id]/social/SocialCardPreview.module.css
    - apps/web/app/audits/[id]/social/SocialCardPreview.test.tsx
    - apps/web/app/audits/[id]/social/XPreview.tsx
    - apps/web/app/audits/[id]/social/XPreview.module.css
    - apps/web/app/audits/[id]/social/XPreview.test.tsx
    - apps/web/app/audits/[id]/social/SocialPreviewPanel.test.tsx
  modified:
    - apps/web/app/audits/[id]/social/SocialPreviewPanel.tsx
    - apps/web/app/audits/[id]/social/SocialPreviewPanel.module.css
    - apps/web/app/components/ui/IssueTypeGroup.test.tsx
decisions:
  - "La tarjeta ancha se extrae a SocialCardLayout/SocialCardText en SocialCardPreview.tsx y XPreview la reusa: Facebook, LinkedIn y X summary_large_image renderizan el mismo layout, y una sola definición del clamp evita que dos módulos CSS se desincronicen"
  - "XPreview se alimenta exclusivamente de los campos twitter* : el respaldo OG→Twitter ya se resolvió en socialPreview.ts y volver a mirarlo en la UI lo duplicaría con otro criterio"
  - "El manejo de teclado del tablist se ata a cada role=tab, nunca a document (T-32-15)"
metrics:
  duration: 11min
  tasks: 2
  files: 10
  completed: 2026-08-05
---

# Phase 32 Plan 04: Panel de preview social completo Summary

Los tres layouts sociales (Google, Facebook/LinkedIn, X) montados como sub-vistas de un `tablist` WAI-ARIA con roving tabindex real, más el snippet de fix montado dentro del mismo panel cuando hay algo que ofrecer.

## Qué se construyó

**`SocialCardPreview.tsx` (PREVIEW-02).** Facebook y LinkedIn renderizan la misma tarjeta 1.91:1 a partir de las mismas etiquetas Open Graph, así que comparten un único componente. El archivo exporta tres piezas: `SocialCardText` (dominio + título con clamp de 1 línea + descripción con clamp de 2, más una ranura opcional entre dominio y título), `SocialCardLayout` (imagen 1.91:1 arriba, ese bloque textual abajo) y el `SocialCardPreview` que los alimenta con los campos `og*`. La extracción no es decoración: el clamp es una regla de CSS y tenerla en dos módulos hermanos es la manera más fácil de que uno se actualice y el otro no. La técnica de truncado es exactamente la de `GooglePreview.module.css` (`-webkit-line-clamp` + `line-clamp` + `overflow-wrap: anywhere`), no una segunda invención.

**`XPreview.tsx` (PREVIEW-03).** La variante la dicta `twitterCardVariant`, que `socialPreview.ts` (Plan 32-01) sólo marca `summary_large_image` cuando la página lo declara explícitamente; acá no hay ninguna rama que fuerce la tarjeta ancha. La variante ancha reusa `SocialCardLayout` alimentado con `twitterTitle`/`twitterDescription`/`twitterImage`, nunca con los `og*` planos: el respaldo OG→Twitter ya está resuelto aguas arriba y mirarlo de nuevo en la UI sería un segundo criterio compitiendo con el primero. Hay test explícito con fixtures donde `ogImage` y `twitterImage` difieren, que asserta el `src` del proxy contra el segundo.

La variante `summary` es un `flex` con una columna fija de 80px (`flex: 0 0 80px`, así la miniatura no se estira ni se encoge cuando el texto de al lado es largo) que contiene la imagen 1:1, y la columna de texto a la derecha. Cuando `twitterCardDeclared === null`, el literal `Sin twitter:card` va en la ranura entre dominio y título, en Geist Mono cursiva `--text-muted` — el nombre de la etiqueta se escribe verbatim como aparece en el HTML, per Copywriting Contract.

**`SocialPreviewPanel.tsx` (extendido, no reescrito).** Conserva el encabezado y el subtítulo del contrato de copy y agrega debajo el `role="tablist"` con los tres `role="tab"` (`Google`, `Facebook / LinkedIn`, `X`), cada uno con `min-height: 44px`, `aria-selected`, `aria-controls` e `id` cruzados con su `role="tabpanel"`, y `tabIndex` que sólo vale `0` en el activo. `ArrowLeft`/`ArrowRight` envuelven en ambos extremos, `Home`/`End` van a los extremos, `Enter`/`Espacio` activan; cada rama mueve el foco al tab destino y llama `preventDefault()` sólo cuando la tecla pertenece al patrón, para no comerse `Tab` ni el scroll del resto del reporte. El listener vive en cada `role="tab"`, jamás en `document` (T-32-15).

Los tres paneles se renderizan siempre y los inactivos llevan el atributo HTML `hidden`. El indicador del tab activo es un `border-bottom` de 2px en `--accent` y los inactivos declaran esa misma banda en `transparent`, así que cambiar de tab no desplaza la fila un pixel. Ninguna transición propia. `FixSnippet` se monta después de los paneles, separado por `--space-4`, únicamente cuando `data.fixSnippet !== null`.

## Desviaciones del plan

### Auto-corregidas

**1. [Regla 1 — bug] Un test de `IssueTypeGroup` daba por único un texto que ahora aparece dos veces**

- **Encontrado en:** Task 2, al correr la suite completa de `apps/web`
- **Problema:** `IssueTypeGroup.test.tsx` asertaba `getByText("Título social")` sobre el panel montado. Con los tres paneles siempre en el DOM, ese título aparece en el de Google y en el de Facebook/LinkedIn, y `getByText` falla por múltiples coincidencias. No es un fallo de la aserción sino de su premisa: el panel dejó de ser single-view.
- **Arreglo:** la aserción pasa a `getAllByText(...)` con longitud 2 y un comentario que explica por qué son dos. Ninguna otra aserción de ese archivo se tocó.
- **Archivos:** `apps/web/app/components/ui/IssueTypeGroup.test.tsx`
- **Commit:** 6a2465b

**2. [Regla 3 — bloqueante] `noUncheckedIndexedAccess` rechaza el acceso indexado a los arrays de `getAllByRole`**

- **Encontrado en:** Task 2, al correr `pnpm typecheck`
- **Problema:** los helpers del test devolvían `HTMLElement[]` y cada `tabs()[0]` se tipa como `HTMLElement | undefined`, que `fireEvent.keyDown` no acepta. 12 errores TS2345.
- **Arreglo:** dos accesores `tab(i)`/`panel(i)` que estrechan con un `throw` explícito si la posición no existe. Un fallo de índice queda como error del test con mensaje claro, en vez de un `undefined` propagándose.
- **Archivos:** `apps/web/app/audits/[id]/social/SocialPreviewPanel.test.tsx`
- **Commit:** 6a2465b

## Ciclo TDD

Las dos tasks venían marcadas `tdd="true"` y se ejecutaron con gates RED/GREEN separados:

| Gate | Commit | Contenido |
|------|--------|-----------|
| RED (Task 1) | 77baff8 | 5 tests de `SocialCardPreview` + 8 de `XPreview`, fallando |
| GREEN (Task 1) | ccb5ccb | `SocialCardPreview.tsx`/`XPreview.tsx` + sus módulos CSS |
| RED (Task 2) | 2c5aec2 | 9 tests RTL del tablist, fallando |
| GREEN (Task 2) | 6a2465b | `SocialPreviewPanel` con tabs + `FixSnippet` condicional |

## Verificación

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter web test -- SocialCardPreview XPreview` | en verde |
| `pnpm --filter web test -- SocialPreviewPanel` | en verde |
| `pnpm --filter web test` | 125 tests en verde (17 archivos) |
| `pnpm typecheck` (raíz) | 17/17 workspaces en verde |
| `pnpm test` (raíz) | 14/14 workspaces en verde |
| `pnpm --filter web build` | compila sin error |
| `pnpm assert:web-boundary` | PASS |

Cobertura del registro de amenazas: ningún `dangerouslySetInnerHTML` en los componentes nuevos, con test en `SocialCardPreview` y `XPreview` de que un `<img onerror>` en el título se escapa y no produce ningún `<img>` real en el árbol (T-32-14); el `onKeyDown` del tablist se ata a cada `role="tab"` y no hay ningún `addEventListener` sobre `document` en el archivo (T-32-15).

El backstop de long-text tiene test en los dos componentes (título de 300 caracteres que entra completo al DOM en un único nodo con la clase de clamp aplicada). jsdom no calcula layout, así que la confirmación geométrica sigue requiriendo el ojo humano.

## Verificación manual pendiente

Contra una auditoría real con issues de categoría social: navegar los tres tabs con teclado (flechas, Home, End) y con mouse, confirmar que el indicador `--accent` del tab activo es legible en tema oscuro y claro, que el título de 300 caracteres no desborda ninguna de las dos tarjetas, y que el snippet de fix queda alcanzable sin que el scroll horizontal del bloque atrape el foco. Diferido al gate de fin de fase (`human_verify_mode: end-of-phase`).

## Known Stubs

Ninguno.

## Self-Check: PASSED

Los 7 archivos creados existen en disco y los 4 commits están en el historial.
