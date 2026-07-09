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
