# Backlog — mejoras diferidas

Insumos capturados fuera del scope del milestone en curso. Léelo al abrir un milestone nuevo (`/gsd:new-milestone`).

## v1.4 (candidatas)

### URL-RESOLVE-01 — Resolución canónica de la URL de entrada
**Origen:** Feedback de Juan durante la validación visual de v1.3 (2026-07-09).

**Problema:** El usuario debería poder ingresar solo `aprendoclub.com` y que el sistema resuelva todo automáticamente. Hoy:
- El input SÍ acepta dominio pelado sin protocolo (`normalizeDomain` en `apps/web/app/api/audits/route.ts:29`). ✓
- Pero el worker hardcodea `startUrl = https://${audit.site.domain}` (`apps/worker/src/index.ts:272`). NO resuelve:
  - **http vs https**: asume https siempre; un sitio solo-http fallaría.
  - **redirect a www / canónico**: si `aprendoclub.com` redirige a `www.aprendoclub.com`, el crawler sigue el redirect por página (Crawlee captura `finalUrl`), pero `origin` y el sitemap discovery siguen usando `https://aprendoclub.com` — posible mismatch en el grafo de enlaces (Phase 16) y checks que comparan contra `origin`.

**Fix propuesto:** Antes de crawlear, una función de resolución canónica que:
1. Pruebe `https://<domain>`; si falla la conexión, pruebe `http://<domain>`.
2. Haga un GET/HEAD del home y siga los redirects hasta la URL final real (www o no, con/sin barra).
3. Use esa URL resuelta como `startUrl`/`origin` para todo el pipeline (crawl, sitemap discovery, grafo, checks).
4. Guarde la URL canónica resuelta (¿en `Audit` o `Site`?) para mostrarla en el reporte.

**Notas:** Es parte del core value ("cualquier persona ingresa una URL y recibe una auditoría"). Reduce fricción del lead magnet. Scope no trivial — merece su propia fase con discuss (dónde persistir la URL resuelta, cómo manejar dominios que no responden en ningún protocolo, timeout de resolución).

**Nota (2026-07-09):** El síntoma más grave del mismatch www (grafo de arquitectura vacío para sitios que redirigen a www) ya se mitigó puntualmente en `buildLinkGraph` (`resolveHomeKey` fallback a la página root del mismo registrable domain). Pero la resolución canónica completa (usar la URL real resuelta como `startUrl`/`origin` en TODO el pipeline) sigue pendiente — el worker aún arranca en `https://<domain>` sin resolver http/https ni www.

### SCHEMA-VIZ-01 — Visualizador de schema completo (estilo Classy Schema)
**Origen:** Feedback de Juan durante validación de v1.3 (2026-07-09), con HTML de referencia de Classy Schema.

Tres piezas. La **#1 (grafo expandido) ya se implementó** como quick fix (commit `f715448`, `buildEntityGraph` expande entidades anidadas). Faltan:

2. **Código JSON-LD formateado por schema** en el reporte: mostrar el bloque `<script type="application/ld+json">` de cada entidad, formateado/indentado, con las propiedades legibles (treelist: `@type`, `author`, `datePublished`, `headline`, etc.) — como el panel derecho de Classy Schema.
3. **Validación por propiedad/tipo con errores individuales**: validar cada entidad y propiedad contra el vocabulario de schema.org y mostrar por nodo: "BlogPosting is a valid schema.org type", "articleSection is a valid property", y advertencias como "Product is missing reviews" (columnas error/warning/success por fila, como el treelist de Classy Schema). Es la pieza más grande — requiere una fuente del vocabulario schema.org (tipos + propiedades válidas + a qué tipo pertenece cada propiedad).

**Referencia:** HTML de Classy Schema (treelist DevExtreme `dx-treelist` con columnas de error/warning/success + expanders con descripciones de schema.org) guardado en el hilo de conversación del 2026-07-09.
