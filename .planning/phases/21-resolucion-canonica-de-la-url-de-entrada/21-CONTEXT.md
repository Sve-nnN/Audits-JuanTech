# Phase 21: Resolución canónica de la URL de entrada - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

El auditor resuelve la URL canónica real del dominio ingresado (prueba https→http, sigue redirects del home hasta la URL final con/sin www y barra) ANTES de crawlear, y la usa como `origin`/`startUrl` único en todo el pipeline. Reemplaza la mitigación puntual `resolveHomeKey` de v1.3.

</domain>

<decisions>
## Implementation Decisions

### Dónde ocurre la resolución
- En el **worker** (`apps/worker/src/index.ts`), antes de `runCrawl` — NO en `route.ts` (Vercel serverless: evita latencia/timeout en el submit del usuario y fetch con redirects en serverless).
- Nueva función `resolveCanonicalUrl(domain: string)` en `packages/crawler`: prueba `https://<domain>` primero, cae a `http://<domain>` si https no conecta; hace un GET al home con `redirect: "follow"` + timeout acotado; devuelve la `finalUrl` real (con www/sin www, con/sin barra, según responda el servidor).

### Persistencia
- Nuevo campo `Audit.resolvedUrl String?` (snapshot por auditoría — NO en `Site`, que es compartido entre auditorías del mismo dominio y su canónica podría cambiar).
- Migración schema-first (`db:push`, sin carpeta migrations — convención del repo). Campo nullable, aditivo.
- Se muestra la URL resuelta en el reporte (para que el usuario vea qué se auditó realmente).

### Uso en el pipeline
- El worker usa `resolvedUrl` como `startUrl`/`origin` en TODO el pipeline: `runCrawl`, `discoverSitemapUrls`, `buildLinkGraph`, `runAllChecks`. Un solo origin correcto aguas arriba.
- Reemplaza `const startUrl = \`https://${audit.site.domain}\`` (worker línea ~272).

### Manejo de fallo
- Dominio que no responde en NINGÚN protocolo (ni https ni http, o timeout) → `Audit.status = "failed"` con `error` claro en español neutro (ej. "No pudimos conectar con <dominio>. Verificá que el sitio esté en línea e intentá de nuevo."). NUNCA un crawl vacío silencioso.

### Limpieza de la mitigación v1.3
- Eliminar `resolveHomeKey` de `packages/graph/src/buildLinkGraph.ts` — ya innecesario porque el `origin` llega correcto (resuelto) aguas arriba. El home lookup vuelve a ser el match exacto `normalizeUrl(origin)`.
- Ajustar el test de `buildLinkGraph` que hoy pasa un origin sin-www con páginas www (Test 9, "www regression"): tras la resolución, ese escenario ya no ocurre porque el worker pasa el origin resuelto (www). Reemplazar ese test por uno que verifique el match exacto con el origin ya resuelto, o eliminarlo documentando que la responsabilidad se movió a `resolveCanonicalUrl`.

### Claude's Discretion
- Timeout exacto de la resolución (sugerido: alineado con `ROBOTS_FETCH_TIMEOUT_MS`/similar del worker).
- Método HTTP para la resolución (GET vs HEAD; GET es más confiable para seguir redirects y detectar el home real).
- Redacción exacta del mensaje de error al usuario.
- Si `resolveCanonicalUrl` valida también que la respuesta sea 2xx (home vivo) o acepta cualquier respuesta que no sea error de red.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/network/linkChecker.ts` — patrón de `fetch` con `AbortController` + timeout + `redirect: "follow"` a reusar para la resolución.
- `packages/crawler/src/normalizeUrl.ts` — `normalizeUrl`, `sameRegistrableDomain` (ya se usan en el pipeline).
- `apps/worker/src/index.ts` línea ~272 — punto exacto donde se arma `startUrl` hoy (`https://${audit.site.domain}`).
- El worker ya carga `audit.site.domain` (relación `site` en el `prisma.audit.update` inicial).

### Established Patterns
- Best-effort con degradación en el worker (try/catch por etapa) — pero acá el fallo de resolución SÍ debe fallar la auditoría (no hay crawl posible sin URL válida), a diferencia de PSI/render que degradan.
- Campos opcionales aditivos en el schema (`Page.title` de v1.3 es el precedente) + `db:push` schema-first.
- Funciones de red puras/testeables en `packages/crawler` (crawl, sitemap, normalizeUrl).

### Integration Points
- `packages/crawler`: nueva `resolveCanonicalUrl` + export en `index.ts`.
- `packages/db/prisma/schema.prisma`: `Audit.resolvedUrl String?`.
- `apps/worker/src/index.ts`: llamar `resolveCanonicalUrl` antes de `runCrawl`, usar el resultado como startUrl/origin, persistir en `Audit.resolvedUrl`, fallar limpio si no resuelve.
- `packages/graph/src/buildLinkGraph.ts`: quitar `resolveHomeKey`.
- `apps/web/app/audits/[id]/page.tsx` (u otra superficie del reporte): mostrar `resolvedUrl`.

</code_context>

<specifics>
## Specific Ideas

Origen: feedback de Juan durante validación de v1.3 ("yo debería poder poner solamente aprendoclub.com y resuelve todo, si tiene redirección a www, etc."). El síntoma más grave (grafo de arquitectura vacío para sitios www) ya se mitigó puntualmente en v1.3; esta fase lo resuelve de raíz aguas arriba.

</specifics>

<deferred>
## Deferred Ideas

- Recrawl automático o comparación de variantes de dominio (una sola URL canónica por auditoría) — explícitamente fuera de alcance (Out of Scope del milestone).
- Resolución en el submit (route.ts) con preview de la URL resuelta antes de encolar — descartada por latencia/serverless.

</deferred>
