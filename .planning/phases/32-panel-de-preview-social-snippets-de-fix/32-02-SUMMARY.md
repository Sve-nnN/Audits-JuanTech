---
phase: 32-panel-de-preview-social-snippets-de-fix
plan: 02
subsystem: web report UI + API proxy
tags: [social, preview, ssrf, proxy, ui, preview-04]
status: complete
requires:
  - "assertPublicDestination / pinnedDispatcher / resolveRedirect / readUpTo (Phase 31)"
  - "SocialPreviewData.imageStatus (Plan 32-01)"
  - "OG_IMAGE_MAX_BYTES (@auditor/meta-social)"
provides:
  - "GET /api/audits/[id]/preview-image — proxy de imágenes con allowlist de origen"
  - "PreviewImage.tsx — imagen vía proxy con placeholder por estado"
  - "@auditor/checks/network — subpath seguro de la defensa de destino, importable desde apps/web"
affects:
  - "packages/checks/package.json (subpath export nuevo)"
  - "apps/web/package.json (dependencia directa de @auditor/meta-social)"
tech-stack:
  added: []
  patterns:
    - "apps/web importa infraestructura de packages/checks SOLO por subpath de hojas; el barrel arrastra Crawlee y rompe next build con Module not found: 'tls'"
    - "Toda rama de rechazo del proxy devuelve status genérico con cuerpo vacío: ni motivo SSRF, ni status real del origen, ni URL interna"
key-files:
  created:
    - packages/checks/src/network.ts
    - apps/web/app/api/audits/[id]/preview-image/route.ts
    - apps/web/tests/app/api/audits/[id]/preview-image/route.test.ts
    - apps/web/app/audits/[id]/social/PreviewImage.tsx
    - apps/web/app/audits/[id]/social/PreviewImage.module.css
    - apps/web/app/audits/[id]/social/PreviewImage.test.tsx
  modified:
    - packages/checks/package.json
    - apps/web/package.json
decisions:
  - "La superficie de red que consume apps/web se expone como subpath dedicado @auditor/checks/network (hojas ssrfGuard/redirects/imageProbe), no como re-export del barrel network/index.ts que el plan asumía disponible"
  - "El allowlist de Content-Type se evalúa sobre el tipo base (se descartan los parámetros del header) y lo que se sirve de vuelta es la cadena de nuestra propia tabla, nunca la del origen"
  - "Content-Type fuera del allowlist y status de error del origen colapsan en el mismo 404 genérico: el cliente no puede distinguir ambas ramas"
metrics:
  duration: 12min
  tasks: 2
  files: 8
  completed: 2026-08-05
---

# Phase 32 Plan 02: Proxy de imágenes sociales + PreviewImage Summary

Proxy server-side de las imágenes del preview social con allowlist de origen exacto y la defensa SSRF de Phase 31 reusada tal cual, más el componente que decide entre imagen real y placeholder a partir de `imageStatus`.

## Qué se construyó

**Proxy (`apps/web/app/api/audits/[id]/preview-image/route.ts`).** Node runtime, `force-dynamic`, `Request` plano igual que `pages/route.ts`. Dos capas de defensa independientes: primero el `origin` completo del `?url=` se compara contra el de `audit.resolvedUrl` (esquema, host y puerto, nunca sufijo de host) antes de cualquier E/S; recién después corre `assertPublicDestination`, y la conexión se abre por `pinnedDispatcher` contra las direcciones ya clasificadas. Las redirecciones se siguen a mano hasta `MAX_REDIRECT_HOPS`, revalidando cada salto con `resolveRedirect`; el seguimiento automático del transporte no aparece en el archivo. El cuerpo se lee con `readUpTo(res, OG_IMAGE_MAX_BYTES)` dentro del mismo bloque que posee el `AbortController`, así que el presupuesto de `IMAGE_PROBE_TIMEOUT_MS` cubre también la lectura y un servidor que gotea bytes queda acotado.

El `Content-Type` de la respuesta se re-deriva siempre contra un allowlist cerrado de cinco tipos y sale acompañado de `Content-Disposition: inline` y `X-Content-Type-Options: nosniff`. El header crudo del origen no se reenvía en ninguna rama.

**`PreviewImage.tsx`.** Con `imageStatus` en `"unavailable"` o `"none"` no hay elemento de imagen en el árbol, así que no sale ni un request hacia el proxy: reintentar contra un destino que IMG-01 ya declaró inalcanzable sería carga inútil contra el sitio auditado y un ícono de imagen rota garantizado. Con `"ok"` renderiza el `<img>` decorativo (`alt=""`, `role="presentation"`, `loading="lazy"`) dentro de un marco con `aspect-ratio` fijo que reserva el layout antes del primer byte. Si el proxy falla en ejecución pese al `ok`, el `onError` conmuta al mismo bloque de placeholder con la copy neutra, sin código HTTP crudo a la vista.

## Desviaciones del plan

### Auto-corregidas

**1. [Regla 3 — bloqueante] El contrato de importación que el plan daba por hecho no existía**

- **Encontrado en:** Task 1, antes de escribir el route handler.
- **Problema:** el plan (y el brief de la wave) indicaban importar `assertPublicDestination`/`pinnedDispatcher`/`resolveRedirect`/`readUpTo` desde `@auditor/checks`, con los re-exports que Plan 32-01 dejó en `packages/checks/src/checks/network/index.ts`. Ese archivo sí tiene los re-exports, pero es inalcanzable desde `apps/web`: el único camino hacia él es el barrel `@auditor/checks`, que arrastra `brokenResources.ts` → `@auditor/crawler` → Crawlee → `tls` y rompe `next build` (el mismo fallo que 32-01 documentó). El brief también daba por existente `packages/meta-social/src/network/index.ts`, que no está en el árbol.
- **Arreglo:** se agregó el subpath `@auditor/checks/network` (`packages/checks/src/network.ts`), que re-exporta únicamente las hojas `ssrfGuard.ts`, `redirects.ts` e `imageProbe.ts` — grafo cerrado en `node:dns`/`node:net`/`undici`, sin rastro de Crawlee. Es el mismo precedente que el subpath `./validate` que el paquete ya tenía. `next build` compila las 16 rutas y `pnpm assert:web-boundary` sigue en PASS.
- **Archivos:** `packages/checks/src/network.ts`, `packages/checks/package.json`
- **Commit:** ce725c1

**2. [Regla 3] `apps/web` no declaraba `@auditor/meta-social`**

- **Encontrado en:** Task 1, al importar `OG_IMAGE_MAX_BYTES`.
- **Problema:** el brief de la wave afirmaba que Plan 32-01 había agregado esa dependencia a `apps/web`; el `package.json` no la tenía (32-01 la agregó a `packages/report-model`, no a la app).
- **Arreglo:** se agregó `"@auditor/meta-social": "workspace:*"` a las dependencias de `apps/web` y se corrió `pnpm install`. Es una dependencia de workspace sin runtime pesado (Cheerio es su única dependencia y el umbral importado es una constante), y `assert:web-boundary` confirma que no introduce ningún carrier de navegador.
- **Archivos:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Commit:** ce725c1

**3. [Regla 1] El allowlist compara el tipo base, no el header completo**

- **Encontrado en:** Task 1, escribiendo el test del caso feliz.
- **Problema:** el plan pedía comparar `res.headers.get("content-type")?.toLowerCase().trim()` contra el allowlist. Un origen perfectamente normal responde `image/jpeg; charset=binary` o con `boundary`, y esa cadena no está en la tabla: toda imagen con parámetros en el header caería en el 404 genérico.
- **Arreglo:** se descarta lo que sigue al `;` y se compara el tipo base. Lo que se sirve de vuelta sigue siendo la cadena de nuestra propia tabla, así que el contrato de "nunca reenviar el header crudo" queda intacto (hay test con `image/jpeg; charset=binary` que asserta `Content-Type: image/jpeg` exacto en la respuesta).
- **Archivos:** `apps/web/app/api/audits/[id]/preview-image/route.ts`
- **Commit:** ce725c1

**4. [Regla 3] Ciclo RED/GREEN sin commit RED separado**

Ambas tasks venían marcadas `tdd="true"`. Se corrió el ciclo real (tests escritos primero, corridos en rojo por módulo ausente, después implementación), pero se entregó un commit atómico por task en vez de un commit RED y otro GREEN: un commit RED acá es un árbol que no compila, no una prueba fallando por una razón. El plan es `type: execute`, no `type: tdd`, así que el guardarraíl de gates a nivel de plan no aplica. Mismo criterio que Plan 32-01.

## Cobertura del threat model

| Amenaza | Mitigación entregada | Test |
|---------|----------------------|------|
| T-32-05 (SSRF vía `?url=`) | Allowlist de origin exacto antes de toda E/S + `assertPublicDestination` | 3 tests: origen ajeno, esquema distinto, subdominio; y destino rechazado por la guardia — todos asertan que `fetch` no se llamó |
| T-32-06 (DNS rebinding) | `pinnedDispatcher(verdict.addresses)` en cada salto, nunca una segunda resolución | Cubierto por el test de redirección (las direcciones del salto vienen de `resolveRedirect`) |
| T-32-07 (sniffing de tipo) | Allowlist cerrado de 5 tipos + `nosniff` | `text/html` con `<script>` en el cuerpo → 404 y `Content-Type` nulo en la respuesta |
| T-32-08 (goteo de bytes) | `readUpTo(res, OG_IMAGE_MAX_BYTES)` dentro del bloque del `AbortController` | Revisión de código; el cap y el aborto son los de Phase 31, ya testeados ahí |
| T-32-09 (filtración de detalle) | Todas las ramas devuelven status genérico con cuerpo vacío | Cada test de rechazo asserta `await res.text() === ""`; ninguno depende de un mensaje |
| T-32-10 (inyección de query string) | `encodeURIComponent(ogImage)` | Test con `?v=1&x=2` en la URL declarada, asserta que `&x=2` no aparece crudo en el `src` |

## Verificación

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter web test -- preview-image` | 10 tests nuevos en verde |
| `pnpm --filter web test -- PreviewImage` | 5 tests nuevos en verde |
| `pnpm --filter web test` | 97 tests en verde (13 archivos) |
| `pnpm typecheck` (raíz) | 17/17 workspaces en verde |
| `pnpm test` (raíz) | 14/14 workspaces en verde |
| `pnpm --filter web build` | compila; `/api/audits/[id]/preview-image` aparece como ruta dinámica |
| `pnpm assert:web-boundary` | PASS |
| `grep -c 'redirect: "follow"' route.ts` | 0 |
| `grep '@auditor/checks"' route.ts` | sin coincidencias (importa por subpath) |

## Verificación manual pendiente

Contra una auditoría real con al menos una `og:image` válida y una marcada `critical` por IMG-01: confirmar en la pestaña Network que la primera carga vía `/api/audits/[id]/preview-image` y que la segunda no emite ningún request. Diferido al gate de fin de fase (`human_verify_mode: end-of-phase`).

`PreviewImage` todavía no está montado en ninguna vista: lo consumen `SocialCardPreview`/`XPreview` en Plan 32-04. Eso es el alcance declarado de este plan, no un stub.

## Known Stubs

Ninguno.

## Self-Check: PASSED

Los 6 archivos creados existen en disco y los dos commits (`ce725c1`, `fb366b2`) están en el historial.
