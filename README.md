# Auditor

Herramienta de auditoría web (SEO técnico, on-page, datos estructurados,
rendimiento/Core Web Vitals y visibilidad en IA) usada como **lead magnet**
para juan-tech.com. Una persona verifica su email, ingresa una URL, y un
crawler rastrea hasta 500 páginas del sitio para producir un reporte con
score general, scores por categoría e issues priorizados por severidad.

## Qué hace

- **Verificación de email (double opt-in):** solo un email verificado puede
  lanzar auditorías. Sin abuso, sin bots.
- **Cuota:** 1 auditoría gratuita por semana por email verificado.
- **Crawl acotado:** descubre URLs vía `sitemap.xml` (con fallback a
  link-crawl), respeta `robots.txt`, y rastrea hasta **500 URLs** por
  auditoría con Crawlee (CheerioCrawler).
- **Batería de 29 checks** sobre cada página rastreada, en 5 categorías.
- **Core Web Vitals** vía PageSpeed Insights sobre una muestra representativa
  (nunca las 500 páginas).
- **Reporte** con score general (0-100), scores por categoría, issues por
  severidad, grafo de entidades (JSON-LD) y diff contra la corrida anterior.
- **Historial** de auditorías por sitio.

### Categorías de auditoría

| Categoría | Prefijo | Checks | Cubre |
|-----------|---------|--------|-------|
| SEO Técnico | `TECH-*` | 13 | robots.txt, indexabilidad, canonicals, status codes, redirecciones, sitemap |
| On-Page | `ONPAGE-*` | 7 | title, meta description, headings, contenido duplicado (simhash) |
| Datos Estructurados | `SD-*` | 5 | JSON-LD, schema.org, grafo de entidades |
| AEO (Visibilidad en IA) | `AEO-*` | 4 | directivas de crawlers IA (GPTBot, Google-Extended, etc.), citabilidad |
| Rendimiento / CWV | `perf` | — | LCP, CLS, INP, TTFB, Performance score (vía PSI, muestra) |

Cada issue lleva severidad: **crítico**, **advertencia** u **correcto**.

## Arquitectura

Monorepo pnpm + Turborepo. Frontera estricta: **`apps/web` nunca importa el
crawler; `apps/worker` nunca importa Next.js.**

```
apps/
  web        Next.js 15 (App Router) → Vercel. Encola jobs, lee resultados de Postgres. Sin crawl.
  worker     Proceso Node long-running → contenedor (Railway/Fly). Corre el crawl + checks + PSI + scoring.
packages/
  db         Prisma schema + cliente compartido (@auditor/db)
  queue      Factory de Queue/Worker BullMQ + tipos de job (@auditor/queue)
  crawler    Descubrimiento de sitemap, robots, normalización de URL, crawl (@auditor/crawler)
  checks     Batería de 29 checks (tech/onpage/schema/aeo/network) + registry (@auditor/checks)
  psi        Cliente PageSpeed Insights, muestreo, caché, mapeo de issues CWV (@auditor/psi)
  scoring    Score por categoría, score general, diff entre auditorías (@auditor/scoring)
  quota      Gate de cuota (1/semana/email), límite de 500 URLs (@auditor/quota)
  email      Double opt-in: normalización, tokens, provider Resend (@auditor/email)
```

### Flujo end-to-end

1. Usuario ingresa email → `POST /api/request-verification` crea token y
   envía link de verificación (Resend). En dev sin `RESEND_API_KEY`, el link
   se devuelve en la respuesta.
2. Usuario abre el link → página `/verify` → `POST /api/verify` marca el
   email como verificado (con consentimiento).
3. Usuario ingresa la URL a auditar → `POST /api/audits`. Gate: email
   verificado (AUTH-04) + cuota disponible. Crea el `Audit` y encola el job
   en BullMQ.
4. `apps/worker` consume el job: descubre URLs → crawl → corre los 29 checks
   → muestrea PSI (móvil + desktop, cache-first) → calcula scores → persiste
   Issues/PerfMetric y actualiza `Audit.stats` para reportar progreso.
5. Frontend hace polling a `GET /api/audits/[id]` y muestra el reporte en
   `/audits/[id]`, el desglose por página en `/audits/[id]/pages`, y el
   historial en `/history`.

## Cómo correr localmente

Requisitos: **Node ≥ 20**, **pnpm 10**, un Postgres y un Redis
(Upstash, TLS).

```bash
pnpm install
cp .env.example .env      # completar DATABASE_URL, REDIS_URL (ver abajo)
pnpm db:push              # sincroniza el schema Prisma contra Postgres
pnpm dev                  # levanta apps/web (:3000) y apps/worker en paralelo (Turborepo)
```

Sin `RESEND_API_KEY`, el flujo de verificación funciona en **modo dev**: el
link de verificación se devuelve en la respuesta de la API en vez de mandarse
por email, así podés probar el flujo completo sin bandeja de entrada real.

Sin `PSI_API_KEY`, PSI se llama sin clave (quota baja, ~1 req/s) — suficiente
para la muestra chica que corre cada auditoría.

## Variables de entorno

| Variable | Requerida | Dónde | Propósito |
|----------|-----------|-------|-----------|
| `DATABASE_URL` | sí | web + worker | Connection string de Postgres. Agregá `?sslmode=require` si el proveedor lo exige (ej. Neon); no todos lo requieren. |
| `REDIS_URL` | sí | web + worker | Redis (Upstash). Esquema `rediss://` (TLS). |
| `PSI_API_KEY` | no | worker | Clave PageSpeed Insights. Sube la quota; sin ella corre keyless. |
| `RESEND_API_KEY` | no (prod: sí) | web | Envío de emails de verificación. Ausente = modo dev. |
| `EMAIL_FROM` | prod | web | Remitente de los emails de verificación. |
| `APP_URL` | prod | web | Base URL para armar los links de verificación. |

## Scripts

Desde la raíz (Turborepo orquesta todos los packages):

```bash
pnpm dev          # web + worker en watch
pnpm build        # build de todo el monorepo
pnpm typecheck    # tsc --noEmit en todos los packages
pnpm test         # corre los tests (vitest)
pnpm lint         # lint
pnpm db:push      # prisma db push (sincroniza schema, sin migración)
pnpm db:generate  # prisma generate (regenera el cliente)
```

Por package (`packages/db`): `db:migrate` (migración dev), `db:studio`
(Prisma Studio).

El worker por separado: `pnpm --filter @auditor/worker dev` (tsx watch) /
`build` (tsc) / `start` (`node dist/index.js`, para el contenedor).

## Tests

Vitest, ~29 archivos de test distribuidos en los packages (crawler, checks,
scoring, psi, email, quota). Correr todo con `pnpm test`, o uno solo con
`pnpm --filter @auditor/scoring test`.

## Modelo de datos (Prisma)

`Email` · `EmailVerification` · `Site` · `Audit` · `Page` · `Issue` ·
`PerfMetric` · `QuotaUsage`. Estados de auditoría: `queued` → `running` →
`done` / `failed`. Severidades: `critical` / `warning` / `ok`.

## Despliegue

- **web** → Vercel. Solo encola jobs y lee Postgres; nunca corre el crawl.
- **worker** → contenedor propio (Railway/Fly). Único lugar donde corren
  Crawlee/PSI. (Dockerfile/config de deploy pendientes de agregar al repo.)
