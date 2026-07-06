# Project Milestones: Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

Entries in reverse chronological order — newest first.

---

## v1.1 Overhaul de UI/UX y marca (Shipped: 2026-07-06)

**Delivered:** Overhaul completo de UI/UX sobre el pipeline de v1.0 — design system con tipografía de marca, librería de componentes reutilizables y las 6 pantallas rediseñadas con copy humanizado, motion sutil y accesibilidad AA. UI-only, sin tocar la lógica de auditoría.

**Phases completed:** 8-10 (19 plans total)

**Key accomplishments:**

- Fundamentos de marca: Array (display, self-hosted), Khand (títulos/UI), Geist Sans (body) y Geist Mono (métricas) vía `next/font`, con fallbacks y `font-display: swap`.
- Design system tokenizado (color, tipografía, espaciado, radios, sombras, z-index) como CSS variables, con tema claro/oscuro dark-first vía next-themes, persistente y sin FOUC.
- Librería de componentes tokens-only (cero hex crudo): ScoreGauge, CategoryCard, Badge severidad/diff, IssuesTable responsive, CategoryAccordion, Button/Input/Field accesibles, EmptyState/ErrorState y Skeleton con shimmer.
- 6 pantallas rediseñadas (home, verificación, progreso, reporte, páginas + grafo, historial) con hero score count-up, barra de progreso animada de 3 fases y reveals suaves.
- Copy 100% humanizado en español neutro sin voceo; motion que respeta `prefers-reduced-motion`; barrido A11Y (skip-to-content, foco visible, contraste AA en ambos temas, navegación por teclado).
- Flujo e2e de v1.0 preservado verbatim (home → verify → progreso → reporte → páginas/grafo → historial).

**Stats:**

- 61 archivos de app modificados (excluyendo `.planning/`); ~5.8k inserciones
- 3 fases, 19 plans
- Requisitos: 31/31 completos (FONT-01..04, DS-01..04, COMP-01..08, SCREEN-01..06, COPY-01..03, MOTION-01..03, A11Y-01..03)
- ~1 día desde el arranque de v1.1 (2026-07-05) hasta el cierre (2026-07-06)

**Git range:** `feat(08-02)` → `feat(10)` (`v1.0.0` → `v1.1.0`)

**Milestone audit:** PASSED — ver `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

**What's next:** Deploy a producción (web → Vercel; worker → Railway/VPS; Resend con dominio verificado; revisión GDPR ligera) y luego v2 (monetización: planes de pago, auditorías/URLs ilimitadas, Stripe; enriquecimiento ENRICH).

---

## v1.0 MVP (Shipped: 2026-07-06)

**Delivered:** Auditor web tipo Screaming-Frog automatizado como lead magnet — crawler, 5 categorías de checks (SEO técnico, on-page, datos estructurados, AEO, rendimiento/CWV), scoring, reporte con diff entre corridas y flujo de email con double opt-in y cuota semanal. Verificado con datos reales sobre juan-tech.com.

**Phases completed:** 1-7 (7 plans total)

**Key accomplishments:**

- Monorepo pnpm+Turborepo: `apps/web` (Next.js, Vercel) encola; `apps/worker` (Crawlee, contenedor propio) ejecuta crawl+checks+PSI. Postgres (Neon) + Redis/BullMQ (Upstash).
- Crawler Crawlee: sitemap + sitemap index + fallback link-crawl, respeta robots.txt, rate-limit, cap 500 URLs, progreso consultable.
- 20 checks SEO técnico + on-page; datos estructurados JSON-LD estilo Classy Schema + grafo de entidades; AEO (crawlers IA, llms.txt); rendimiento/CWV vía PageSpeed Insights muestreado y cacheado.
- Scoring health-ratio size-independent (overall 91 vs 86 de referencia), reporte `/audits/[id]` con issues priorizados y diff nuevos/persistentes/resueltos.
- Email double opt-in + normalización + registro de consentimiento + cuota 1/semana/email + historial persistido.

**Stats:**

- 7 fases, 7 plans; paquetes db, queue, crawler, checks, psi, scoring, email, quota (+ web, worker)
- 140 tests verdes; typecheck + build limpios
- Requisitos: 63/63 v1 completos
- 6 bugs reales encontrados y arreglados durante la verificación

**Git range:** milestone v1.0 cerrado en `2b3bf6f` (tag `v1.0.0`)

**What's next:** Overhaul de UI/UX y marca (v1.1).

---
