# Phase 31: Validación de og:image - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

El auditor verifica que la imagen social (og:image) de cada página sea alcanzable, tenga dimensiones adecuadas y no pese demasiado, sin sobrecargar el sitio auditado con requests repetidos. Cubre IMG-01..04. Consume las URLs de og:image ya extraídas por el motor `packages/meta-social` de Phase 30. Sin UI (Phase 32 construye el panel).

</domain>

<decisions>
## Implementation Decisions

### Fetcher dedupeado (IMG-01)

- Nuevo `NetworkCheck` (`imgSocialCheck` o similar) en `packages/checks/src/checks/network/`, mismo patrón async/`SiteCheckCtx` que `brokenResourcesCheck`/`brokenExternalLinks`.
- Dedupe por URL de imagen (no por página): una misma og:image repetida en decenas de páginas se verifica una sola vez — mismo patrón de `Map<string, string>` (url normalizada → página de origen) que ya usa `brokenResourcesCheck`.
- Reusa `checkOne`/`checkLinks` de `packages/checks/src/checks/network/linkChecker.ts` para la alcanzabilidad (HEAD→GET fallback, timeout, concurrencia) — no reinventar el fetcher.
- Comparte el cap `MAX_URLS_PER_NETWORK_CHECK` (150) ya existente, con el mismo issue "ok" informativo de "verificación limitada" cuando se excede el cap (patrón ya usado en `brokenResourcesCheck`).

### Dimensiones y peso

- `image-size@2.0.2` como dependencia NUEVA y DIRECTA de `packages/checks` (o de un paquete nuevo, a decidir en planning) — no reusar la versión `1.2.1` ya presente como transitiva en el lockfile (viene de Next.js internamente, no es una dependencia nuestra y no debe tratarse como tal).
- Las dimensiones se miden con un GET con `Range` request parcial (no descargar el archivo completo) — `image-size` soporta detectar dimensiones desde un buffer parcial para los formatos comunes (JPEG/PNG/WebP/GIF).
- El peso (bytes) se obtiene del header `Content-Length` de la misma respuesta HEAD/GET ya hecha para alcanzabilidad — sin request adicional dedicado sólo a medir peso. Si el servidor no expone `Content-Length` (chunked/sin header), omitir la evaluación de peso para esa imagen en vez de forzar una descarga completa sólo para medirlo.

### checkId, categoría y casos borde

- checkId nuevo: `IMG-01` (plano, sin subtipo en el campo — igual patrón que Phase 30) para el check completo de validación de imagen (alcanzabilidad + dimensiones + peso, con severidad variable por tipo de problema vía fingerprint con subtipo, ej. `IMG-01:unreachable`, `IMG-01:too-small`, `IMG-01:too-large`). No hay colisión: `IMG-01..04` en REQUIREMENTS.md son IDs de requirement, no checkIds ya usados en el catálogo — confirmado por grep.
- Categoría: `"social"` (no `"tech"`, aunque el patrón técnico del fetcher es idéntico a `TECH-13`) — la validación de og:image es parte de la experiencia de compartir, coherente con el resto de checks de Phase 30.
- Severidad:
  - Error: dimensiones <200×200px, o peso >5MB, o imagen no alcanzable (4xx/5xx o content-type no es imagen).
  - Warning: dimensiones entre 200×200 y 600×315px o ratio lejos de 1.91:1, o peso entre 1MB y 5MB.
- Página sin og:image (SOCIAL-03 de Phase 30 ya marca esa ausencia): este check se omite completamente para esa página — no duplica la señal de "falta og:image", sólo valida la imagen cuando SÍ existe una URL.

### Claude's Discretion

- Nombre exacto del archivo/función del check y de cualquier módulo intermedio de "image fetch" si el planner decide separar la lógica de fetch+parse de dimensiones del `NetworkCheck` en sí (ej. utilidad reusable para Phase 32).
- Redacción exacta de `title`/`criterion`/`recommendation` de las distintas ramas de severidad.
- Estructura exacta del subtipo de fingerprint (ej. `IMG-01:unreachable` vs. `IMG-01:not-image` para content-type inválido) — el requirement no distingue explícitamente esos casos, así que el desglose fino queda a criterio del planner mientras cubra las 4 dimensiones (alcanzable/dimensiones/peso/tipo).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/network/brokenResources.ts` — patrón completo de referencia: `NetworkCheck` async, dedupe por `Map<string,string>`, cap con issue "ok" informativo, iteración sobre `results` de `checkLinks`.
- `packages/checks/src/checks/network/linkChecker.ts` — `checkOne`/`checkLinks` ya implementan HEAD→GET fallback con timeout (5s) y concurrencia acotada (12) — reusar tal cual, no reimplementar.
- `packages/checks/src/checks/network/index.ts` — patrón de registro: agregar el check nuevo al array `networkChecks` exportado.
- `packages/meta-social` (Phase 30) — expone la extracción de `og:image` por página; este check consume esas URLs ya extraídas (posible necesidad de exponer un helper adicional en `meta-social` o de que el `NetworkCheck` re-extraiga vía `page.html`, a decidir en planning).

### Established Patterns
- `image-size@1.2.1` YA está en el lockfile pero como dependencia TRANSITIVA (probablemente de Next.js) — no confundir con una dependencia declarada; la 2.0.2 se agrega como dependencia directa nueva del paquete que la necesite.
- Ningún checkId `IMG-*` existe hoy en el catálogo (confirmado por grep sobre `packages/` y `apps/`).
- El patrón de "cap con aviso informativo" (severity `ok`, no `warning`) para límites de verificación de red ya está establecido y debe replicarse igual acá.

### Integration Points
- `packages/checks/src/checks/network/index.ts` — agregar el check nuevo al array `networkChecks`.
- `packages/checks/package.json` — nueva dependencia `image-size@2.0.2`.
- Depende de que `packages/meta-social` (Phase 30) ya exponga confiablemente la URL de `og:image` por página — confirmar en research si hace falta un export adicional del paquete o si alcanza con lo que ya expone `extractMetaSocial`.

</code_context>

<specifics>
## Specific Ideas

Ninguna referencia específica adicional — las 3 áreas grises fueron aceptadas con la respuesta recomendada en las 3 rondas.

</specifics>

<deferred>
## Deferred Ideas

- IMG-05 (favicon alcanzable) — explícitamente diferido a v1.6.x/v1.7 en REQUIREMENTS.md, no se toca en esta fase.

</deferred>
