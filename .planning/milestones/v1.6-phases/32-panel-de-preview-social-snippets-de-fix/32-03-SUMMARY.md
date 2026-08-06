---
phase: 32-panel-de-preview-social-snippets-de-fix
plan: 03
subsystem: meta-social + report-model + web report UI
tags: [social, snippet, fix, clipboard, ui, fix-01, fix-02]
status: complete
requires:
  - "SocialPreviewData con las banderas ogTitleDeclared/ogDescriptionDeclared/ogUrlDeclared/ogTypeDeclared/twitterCardDeclared (Plan 32-01)"
  - "TWITTER_CARD_VALUES (@auditor/meta-social)"
provides:
  - "buildFixSnippet(fields) + tipos FixSnippetField/FixSnippetTag en @auditor/meta-social"
  - "SocialPreviewData.fixSnippet real (deja de ser null)"
  - "FixSnippet.tsx listo para montarse dentro de SocialPreviewPanel"
affects:
  - "packages/report-model/src/socialPreview.ts (extractSocialPreview ahora computa fixSnippet)"
tech-stack:
  added: []
  patterns:
    - "El escape de valor de atributo HTML se aplica en el constructor puro, no en la UI: el snippet viaja escapado hasta el portapapeles del usuario"
    - "La detección de Clipboard API arranca optimista y se corrige en el efecto de montaje, para que el HTML del servidor y el primer render del cliente coincidan"
key-files:
  created:
    - packages/meta-social/src/fixSnippet.ts
    - packages/meta-social/src/fixSnippet.test.ts
    - apps/web/app/audits/[id]/social/FixSnippet.tsx
    - apps/web/app/audits/[id]/social/FixSnippet.module.css
    - apps/web/app/audits/[id]/social/FixSnippet.test.tsx
  modified:
    - packages/meta-social/src/index.ts
    - packages/report-model/src/socialPreview.ts
    - packages/report-model/src/socialPreview.test.ts
decisions:
  - "El snippet cubre exactamente 5 etiquetas y sólo cuando están ausentes; og:image queda fuera porque no hay valor real que prellenar"
  - "El criterio de inclusión vive en report-model (collectFixFields), no en meta-social: el constructor puro sólo arma HTML y nunca decide qué falta"
  - "La disponibilidad de Clipboard API se detecta en el efecto de montaje con estado inicial optimista, no como expresión de render: evita el desajuste de hidratación que produce la detección directa"
metrics:
  duration: 9min
  tasks: 2
  files: 8
  completed: 2026-08-05
---

# Phase 32 Plan 03: Snippets de fix Summary

`SocialPreviewData.fixSnippet` deja de ser un stub: cada página con etiquetas Open Graph ausentes obtiene un bloque `<meta>` prellenado con sus propios valores reales, escapado contra contenido hostil y copiable desde un botón accesible con fallback a descarga.

## Qué se construyó

**`buildFixSnippet` (constructor puro).** Vive en `packages/meta-social/src/fixSnippet.ts` y hace una sola cosa: convertir una lista de `{tag, value}` en líneas `<meta>`. Devuelve `null` con la lista vacía, que es la señal para que la UI no monte el bloque. Elige `property=` para cualquier `og:*` y `name=` para `twitter:card`. `escapeAttr` reemplaza `&`, `"`, `<` y `>` con el `&` primero, para no re-escapar las entidades que los reemplazos siguientes acaban de insertar (T-32-11). Un valor hostil del tipo `"><script>...` queda como texto escapado dentro del atributo `content`: el snippet resultante sigue teniendo un solo `<meta`, así que nada se inyecta en el `<head>` del usuario cuando lo pega.

Deliberadamente **no** decide qué etiquetas faltan. Esa es la única fuente de complejidad del feature y vive donde está la información.

**Criterio de inclusión (`collectFixFields` en `socialPreview.ts`).** Cierra la Open Question 1 de la investigación de la fase. Cinco etiquetas candidatas, y sólo cuando están AUSENTES:

| Etiqueta | Valor propuesto | Se omite cuando |
|----------|-----------------|-----------------|
| `og:title` | el `<title>` nativo de la página | no hay `<title>` (no hay valor real que ofrecer) |
| `og:description` | la meta description nativa | no hay meta description |
| `og:url` | la URL real rastreada | nunca (siempre disponible) |
| `og:type` | `website` (default técnico estándar) | nunca |
| `twitter:card` | `summary_large_image` si hay `og:image`, si no `summary` | nunca; también se repone si el valor declarado no está en `TWITTER_CARD_VALUES` |

Nunca por longitud fuera de rango: esos casos ya tienen su propia fila de issue, y reescribir un título real sería editorializar contenido del usuario. `og:image` queda fuera porque no existe URL de imagen real que prellenar, e inventarla violaría la regla dura de que el snippet nunca es un template con placeholders. `SOCIAL-06` (duplicados) y `SOCIAL-08` (charset) tampoco entran: la copy fija del panel describe agregar una etiqueta nueva, no resolver un conflicto entre dos existentes ni una declaración sensible a la posición.

**`FixSnippet.tsx`.** Encabezado "Etiquetas que faltan" en Khand, ayuda en Geist Sans, y el snippet dentro de `<pre><code>{snippet}</code></pre>` en Geist Mono con `white-space: pre`, `overflow-x: auto` y `max-height: 240px` con scroll vertical. El botón vive fuera del contenedor scrolleable, con un test que lo verifica (`pre.contains(button) === false`). Es un `<button type="button">` real con `min-height: 44px` y anillo de foco `--ring`/`--shadow-focus`, botón secundario (no fill accent: ese lugar ya lo ocupa "Exportar"). Copiar degrada a descarga en dos casos, sin dejar nunca al usuario sin feedback: cuando la Clipboard API no existe (etiqueta "Descargar snippet" desde el montaje, para no prometer algo que no va a pasar) y cuando `writeText` rechaza. La confirmación "Copiado al portapapeles" se anuncia en un contenedor `role="status"` / `aria-live="polite"` persistente y se limpia a los 4000 ms, mismo literal y misma ventana que `ExportMenu`.

## Desviaciones del plan

### Auto-corregidas

**1. [Regla 1 — bug] La detección de Clipboard API como expresión de render produce desajuste de hidratación**

- **Encontrado en:** Task 2, al diseñar el componente
- **Problema:** el plan indicaba evaluar `typeof navigator !== "undefined" && !!navigator.clipboard?.writeText` directamente en el render, argumentando que un componente `"use client"` sólo se hidrata en el browser. No es así en el App Router: un componente cliente igual se renderiza en el servidor para el HTML inicial. Node define `navigator` global pero no `navigator.clipboard`, así que el servidor pintaría "Descargar snippet" y el cliente hidrataría con "Copiar snippet" — desajuste de contenido de texto, error de hidratación de React en cada carga.
- **Arreglo:** el estado arranca optimista (`canCopy = true`, "Copiar snippet") y se corrige en el efecto de montaje. Servidor y primer render del cliente coinciden, y la detección sigue ocurriendo al montar y no tras un click fallido, que es lo que el `<behavior>` exige: el test hace `render()` y encuentra "Descargar snippet" sin haber hecho ningún click.
- **Archivos:** `apps/web/app/audits/[id]/social/FixSnippet.tsx`
- **Commit:** 6b1d93f

**2. [Regla 3 — bloqueante] `navigator.clipboard?.writeText` no compila con el lib DOM actual**

- **Encontrado en:** Task 2, al correr `pnpm typecheck`
- **Problema:** `error TS2774: This condition will always return true since this function is always defined`. El tipo `Navigator` declara `clipboard` como siempre presente, así que TS considera el optional chaining redundante y rechaza el uso del resultado como condición.
- **Arreglo:** se estrecha con `navigator.clipboard as Clipboard | undefined` y se prueba con `typeof clipboard?.writeText !== "function"`, que expresa la comprobación de runtime real (contexto inseguro) sin que TS la dé por trivial.
- **Archivos:** `apps/web/app/audits/[id]/social/FixSnippet.tsx`
- **Commit:** 6b1d93f

## Ciclo TDD

Las dos tasks venían marcadas `tdd="true"` y se ejecutaron con gates RED/GREEN separados:

| Gate | Commit | Contenido |
|------|--------|-----------|
| RED (Task 1) | d27ac8d | 7 tests de `buildFixSnippet` + 12 del cableado, fallando |
| GREEN (Task 1) | feeb269 | `fixSnippet.ts`, export en el barrel, `collectFixFields` |
| RED (Task 2) | 01c8da6 | 6 tests RTL de `FixSnippet`, fallando |
| GREEN (Task 2) | 6b1d93f | `FixSnippet.tsx` + `.module.css` |

## Verificación

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @auditor/meta-social test` | 33 tests en verde (4 archivos) |
| `pnpm --filter @auditor/report-model test` | 85 tests en verde (5 archivos) |
| `pnpm --filter web test` | 103 tests en verde (14 archivos) |
| `pnpm typecheck` (raíz) | 17/17 workspaces en verde |
| `pnpm test` (raíz) | 14/14 workspaces en verde |
| `pnpm --filter web build` | compila sin error |

Cobertura del registro de amenazas: `escapeAttr` con test de los cuatro caracteres, de la no-doble-escapada de una entidad ya presente y de un valor con un tag completo que queda inerte (T-32-11); ningún `dangerouslySetInnerHTML` en `FixSnippet.tsx`, con test de que el snippet llega a `<code>` como texto y no produce ningún `<meta>` real en el árbol (T-32-12). T-32-13 se aceptó sin mitigación por diseño: `SocialPreviewData` no contiene PII por construcción.

El backstop de desbordamiento tiene test: un snippet de 5 etiquetas con valores de 300 caracteres entra completo al DOM dentro del `<pre>` y el botón queda fuera de ese contenedor. jsdom no calcula layout, así que la confirmación geométrica (que no desborde la card ni tape el botón) requiere el ojo humano.

## Verificación manual pendiente

Abrir `/audits/[id]` de una auditoría con una página a la que le falten etiquetas Open Graph y confirmar visualmente el bloque de snippet, el scroll del bloque con valores largos y el botón de copiar. Queda diferido al gate de fin de fase (`human_verify_mode: end-of-phase`). `FixSnippet` todavía no se monta en ninguna pantalla: `SocialPreviewPanel` lo integra en el Plan 32-04, que es también quien aplica el gate de `fixSnippet === null`.

## Known Stubs

Ninguno. El stub de `SocialPreviewData.fixSnippet` que declaró el Plan 32-01 queda cerrado por este plan.

## Self-Check: PASSED

Los 8 archivos declarados existen en disco y los 4 commits existen en el historial.
