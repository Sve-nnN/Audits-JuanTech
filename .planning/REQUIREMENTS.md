# Requirements: Auditor Web — Milestone v1.1 (Overhaul de UI/UX y marca)

**Defined:** 2026-07-06
**Core Value:** Que cualquier persona ingrese una URL y reciba una auditoría completa, precisa y accionable, a cambio de su email verificado.
**Milestone goal:** Elevar toda la UI/UX a nivel profesional (design system + tipografía de marca alineada a juan-tech.com) y humanizar todos los textos. UI-only, sin tocar la lógica de v1.0.

> **v1.0 (shipped):** crawler, checks SEO/on-page/schema/AEO, PSI, scoring, reporte, email/cuota. Ver `v1.0-MILESTONE-SUMMARY.md`. No se re-especifica acá.

## Milestone v1.1 Requirements

### Fuentes de marca (FONT)

- [x] **FONT-01**: Array (display) integrada self-hosted (woff2 de Fontshare) vía `next/font/local`, expuesta como `--font-array`
- [x] **FONT-02**: Khand (títulos/UI) integrada vía `next/font/google`, expuesta como `--font-khand`
- [x] **FONT-03**: Geist Sans (body) y Geist Mono (código/valores) integradas, expuestas como `--font-geist-sans` / `--font-geist-mono`
- [x] **FONT-04**: Roles tipográficos aplicados consistentemente (display=Array, headings/UI=Khand, body=Geist Sans, código/métricas=Geist Mono), con fallbacks y `font-display: swap`

### Design System (DS)

- [x] **DS-01**: Tokens de diseño centralizados (color, tipografía, espaciado, radios, sombras, z-index) como CSS variables
- [x] **DS-02**: Paleta de marca alineada a juan-tech.com, con escala de severidad (crítico/advertencia/ok) y estados (good/needs_improvement/critical) coherente
- [x] **DS-03**: Modo claro y oscuro: respeta `prefers-color-scheme` + toggle persistente (localStorage), sin flash de tema incorrecto
- [x] **DS-04**: Layout base consistente (contenedor, grid, header/footer) reutilizado por todas las pantallas

### Componentes (COMP)

- [x] **COMP-01**: Score gauge/círculo del score general con color por estado y número legible
- [x] **COMP-02**: Cards por categoría (score + estado + etiqueta) consistentes
- [x] **COMP-03**: Badges de severidad y de diff (nuevo/persistente/resuelto) reutilizables
- [x] **COMP-04**: Tabla de issues responsive (colapsa/scrollea en móvil) con columna de URL clickeable
- [x] **COMP-05**: Acordeón de detalle por categoría (problemas vs correctos) pulido
- [x] **COMP-06**: Botones, inputs y formularios con estados (hover/focus/disabled/error) accesibles
- [x] **COMP-07**: Estados vacíos y de error con copy claro e ilustración/ícono
- [x] **COMP-08**: Skeletons/placeholders de carga para vistas que esperan datos

### Pantallas (SCREEN)

- [x] **SCREEN-01**: Home elevado: hero + flujo email→verificar→URL claro, jerárquico y profesional
- [x] **SCREEN-02**: Página de verificación de email pulida (éxito/error/expirado)
- [x] **SCREEN-03**: Progreso de auditoría con indicador de fase legible (rastreando / analizando / midiendo rendimiento) sin sensación de colgado
- [x] **SCREEN-04**: Reporte `/audits/[id]` rediseñado (hero score, categorías, issues prioritarios, detalle problemas/correctos, rendimiento, diff) espejo mejorado del reporte de referencia
- [ ] **SCREEN-05**: Páginas rastreadas + grafo de entidades con visual limpio y navegable
- [x] **SCREEN-06**: Historial por email presentado como lista de auditorías con score, fecha y acceso al reporte

### Copy humanizado (COPY)

- [x] **COPY-01**: Todos los textos de UI reescritos en español neutro sin voceo, humanizados (sin tells de IA, sin em/en dashes), pasados por la skill humanizer
- [x] **COPY-02**: Mensajes de error, cuota y verificación claros y accionables (qué pasó, qué hacer)
- [x] **COPY-03**: Copy de recomendaciones de issues revisado para tono consistente y humano

### Motion (MOTION)

- [x] **MOTION-01**: Animaciones sutiles y profesionales (score que cuenta hacia arriba, reveal suave de secciones, transiciones de estado, hover)
- [x] **MOTION-02**: Progreso de auditoría con feedback vivo (barra/indicador animado por fase)
- [x] **MOTION-03**: Todo el motion respeta `prefers-reduced-motion` (se desactiva/reduce)

### Accesibilidad y responsive (A11Y)

- [x] **A11Y-01**: Todas las pantallas responsive (móvil, tablet, desktop) sin overflow horizontal
- [x] **A11Y-02**: Contraste AA en ambos temas, foco visible, roles/labels ARIA donde corresponde
- [x] **A11Y-03**: Navegación por teclado funcional (acordeones, toggle de tema, formularios)

## Future Requirements

- Export del reporte a PDF / compartible con branding (v2, ya en ENRICH-02)
- Ilustraciones/gráficos custom por categoría (post-v1.1)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cambios en lógica de crawl/checks/scoring/email | v1.1 es UI-only; no se toca el pipeline de v1.0 |
| Nuevas métricas o checks | Fuera del alcance del overhaul visual |
| Rediseño del modelo de datos | La UI consume el schema existente |
| Voceo / español rioplatense en la UI | Regla dura: español neutro sin voceo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FONT-01 | Phase 8 | Complete |
| FONT-02 | Phase 8 | Complete |
| FONT-03 | Phase 8 | Complete |
| FONT-04 | Phase 8 (base: body Geist Sans, nav Khand, Mono en métricas del reporte), 9 (roles en componentes), 10 (headings de pantalla=Khand, display=Array) | Complete |
| DS-01 | Phase 8 (tokens + migración globals/home/report), 10 (tokenizar hex inline/SVG en SCREEN-03/05) | Complete |
| DS-02 | Phase 8 | Complete |
| DS-03 | Phase 8 | Complete |
| DS-04 | Phase 8 | Complete |
| COMP-01 | Phase 9 | Complete |
| COMP-02 | Phase 9 | Complete |
| COMP-03 | Phase 9 | Complete |
| COMP-04 | Phase 9 | Complete |
| COMP-05 | Phase 9 | Complete |
| COMP-06 | Phase 9 | Complete |
| COMP-07 | Phase 9 | Complete |
| COMP-08 | Phase 9 | Complete |
| SCREEN-01 | Phase 10 | Complete |
| SCREEN-02 | Phase 10 | Complete |
| SCREEN-03 | Phase 10 | Complete |
| SCREEN-04 | Phase 10 | Complete |
| SCREEN-05 | Phase 10 | Pending |
| SCREEN-06 | Phase 10 | Complete |
| COPY-01 | Phase 10 | Complete |
| COPY-02 | Phase 10 | Complete |
| COPY-03 | Phase 10 | Complete |
| MOTION-01 | Phase 10 | Complete |
| MOTION-02 | Phase 10 | Complete |
| MOTION-03 | Phase 10 | Complete |
| A11Y-01 | Phase 10 | Complete |
| A11Y-02 | Phase 10 | Complete |
| A11Y-03 | Phase 10 | Complete |

**Coverage:**

- v1.1 requirements: 31 total (el conteo de "30" en el encabezado original no cuadraba con el listado real; se corrigió durante la creación del roadmap)
- Mapped to phases: 31/31 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-06 (milestone v1.1)*
*Traceability completed: 2026-07-06 (roadmap phases 8-10)*
