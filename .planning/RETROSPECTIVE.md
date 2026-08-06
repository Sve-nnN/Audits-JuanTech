# Retrospective: Auditor Web (SEO/Técnico)

Living retrospective. Newest milestone first; cross-milestone trends at the end.

## Milestone: v1.1 — Overhaul de UI/UX y marca

**Shipped:** 2026-07-06
**Phases:** 3 (8-10) | **Plans:** 19

### What Was Built

Design system tokenizado con 4 fuentes de marca (Array/Khand/Geist Sans/Geist Mono) y tema claro/oscuro dark-first sin FOUC; librería de componentes tokens-only (ScoreGauge, CategoryCard, Badge, IssuesTable, CategoryAccordion, Button/Input/Field, EmptyState/ErrorState, Skeleton); las 6 pantallas rediseñadas con copy humanizado en español neutro, motion sutil (count-up, reveals, progreso animado) que respeta prefers-reduced-motion, y barrido de accesibilidad AA. Todo UI-only sobre el pipeline de v1.0.

### What Worked

- Secuencia de fundamentos hacia afuera (tokens → componentes → pantallas): evitó rework porque cada capa consumía la anterior ya estabilizada.
- Regla tokens-only (cero hex crudo) hizo el theming claro/oscuro casi gratis y coherente.
- UI-FEEDBACK.md de Juan tras la Fase 8 dirigió las Fases 9/10 con decisiones de marca lockeadas (Khand para títulos, no Array) y gaps concretos (dead-space del home, voceo).
- Gate de UI-only respetado: el flujo e2e de v1.0 quedó verbatim; audit confirmó pipeline intacto.

### What Was Inefficient

- Agentes concurrentes en la Fase 10 dejaron un typecheck error transitorio (`Input` sin `forwardRef` en HomeClient) que hubo que reconciliar entre planes hermanos.
- Skeleton (COMP-08) se construyó en Fase 9 sin consumidor y quedó como código muerto hasta cablearse en `loading.tsx` durante el audit.
- Validación visual de componentes diferida a Fase 10 (sin `/styleguide`): correcto para no sobre-construir, pero concentró el descubrimiento de ajustes en las pantallas reales.

### Patterns Established

- Componentes de UI consumen exclusivamente CSS variables de `tokens.css`.
- Acordeones/disclosure sobre `details/summary` nativos para teclado accesible por defecto.
- Cada pantalla con su propio `*.module.css` desacoplado (verify/progress/history), sin colgarse de `home.module.css`.
- Hooks de motion (`useCountUp`, `useReveal`) centralizados y reduced-motion-aware.

### Key Lessons

- Recoger feedback humano dirigido después de la fase de fundamentos (no al final) ahorra rework de pantallas.
- Un componente sin consumidor es deuda: cablear al crearlo o marcarlo explícitamente pendiente.
- En ejecución paralela, fijar el contrato de props compartidos (p. ej. `forwardRef` en Input) antes de repartir planes hermanos.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- Fases entregadas en ~1 día calendario (2026-07-05 → 2026-07-06).
- Notable: la disciplina de tokens redujo el costo de iteración visual entre temas.

## Milestone: v1.4 — Visualización avanzada + resolución de URL

**Shipped:** 2026-07-10
**Phases:** 4 (21-24) | **Plans:** 10

### What Was Built

`resolveCanonicalUrl` (https→http fallback, sigue redirects del home, timeout acotado) reemplazó la mitigación puntual `resolveHomeKey` de v1.3, con `Audit.resolvedUrl` como origin único de todo el pipeline y error claro en dominios muertos. El árbol de arquitectura pasó de filas planas por profundidad a un dendrograma real (jerarquía reconstruida desde `graph.edges`) con conectores SVG, cap "+N más" por rama, banda de huérfanas y un mapa navegable (`ArchitectureMap`, zoom/pan/reset) en ruta propia. El grafo de entidades JSON-LD (`EntityGraphSvg`) ganó layout radial por componente conexo. El detalle de página ganó un panel Classy Schema: código JSON-LD formateado por entidad + validación por propiedad/tipo contra un subconjunto de schema.org, persistido vía `Page.schemaJson` y consumido por `SchemaEntities.tsx`, con un check de scoring (SD-07) que nunca falla dura.

### What Worked

- Secuencia de riesgo ascendente (backend puro → rework de SVG conocido → rework acotado → pieza más pesada) permitió aislar el único cambio de infra real (resolución de URL) antes de tocar UI.
- Reusar patrones ya establecidos (SVG puro tokens-only, sin dependencias nuevas, CSP estricta) hizo que 3 fases de UI no introdujeran ni una librería nueva.
- Checkpoints de verificación humana (`checkpoint:human-verify`) capturaron correctamente que el código estaba completo pero el look/comportamiento necesitaba ojos humanos antes de cerrar el requirement.

### What Was Inefficient

- Los checkpoints humanos de las Fases 21 y 22 quedaron con el código comiteado y el `SUMMARY.md` diciendo "pendiente de aprobación", pero nunca se escribió un `VERIFICATION.md`/`HUMAN-UAT.md` cuando Juan efectivamente los validó en una sesión en vivo. El resultado: el milestone-audit los marcó como `gaps_found` y hubo que reconstruir la aprobación retroactivamente (vía `/gsd-autonomous`) para poder cerrar v1.4 — trabajo evitable si el checkpoint se cierra con un artefacto en el momento en que ocurre, no después.
- El `pre_close_artifact_audit` del cierre de milestone encontró una sesión de debug abierta y no relacionada (`pdf-export-crash-reading-s`, crash de export PDF) que quedó sin resolver desde antes de v1.4 — no bloqueó el cierre (se documentó como diferido) pero es una señal de que las sesiones de debug abiertas deberían revisarse con más frecuencia, no solo al cerrar milestone.

### Patterns Established

- Layout de árbol/dendrograma determinista en dos pasadas (asignar X a hojas por contador, X de nodo interno = promedio de hijos) sin motor de layout en cliente — reutilizable para cualquier visualización jerárquica futura bajo la misma CSP estricta.
- Viewport de zoom/pan como `transform: translate() scale()` movido por estado de React, sin dependencias — patrón para cualquier visualización grande que necesite navegación futura.
- Cerrar un checkpoint humano requiere un artefacto escrito en el momento (VERIFICATION.md o SUMMARY.md con nota explícita de aprobación), no solo la palabra de que "ya se validó" — de lo contrario el milestone-audit lo marca como gap y hay que reconstruir la aprobación después.

### Key Lessons

- Un checkpoint `human-verify` que Juan aprueba verbalmente en una sesión debe registrarse por escrito en ese mismo momento (VERIFICATION.md o nota en el SUMMARY.md), no confiar en que quede "implícito" en el historial de sesión — el costo de reconstruir la aprobación retroactivamente es pequeño pero real, y es evitable.
- Las sesiones de debug abiertas (`.planning/debug/`) deberían revisarse periódicamente, no solo aparecer como sorpresa en el audit de cierre de milestone.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- 4 fases entregadas en ~1 día calendario (2026-07-09 → 2026-07-10), más una sesión adicional el 2026-07-10 para cerrar los gaps de proceso y archivar el milestone.
- Notable: el gap de proceso (checkpoints sin cerrar por escrito) costó una sesión extra completa de reconciliación documental — el fix es barato (cerrar en el momento) comparado con el costo de reconstrucción después.

## Milestone: v1.5 — Fingerprinting técnico + fixes personalizados por CMS

**Shipped:** 2026-07-25
**Phases:** 3 (25-27) | **Plans:** 12

### What Was Built

Motor de fingerprint propio (`@auditor/fingerprint`, única dep runtime `cheerio`) que detecta CMS+builder, CDN/proxy, hosting, framework JS y analytics a partir de headers/cookies/HTML ya capturados durante el crawl, sin requests adicionales, con confianza tipada por eje (nunca winner-take-all). El worker invoca la detección una sola vez por auditoría y la persiste en `Audit.stack`; el reporte muestra una tabla "Stack técnico detectado" tokens-only al inicio. Sobre ese fingerprint, `@auditor/cms-adapters` implementa un patrón adaptador (WordPress con resolución por builder, Shopify, Webflow, Wix/Squarespace combinado) con fallback genérico garantizado, que `buildReportModel` resuelve en lectura (nunca persistido) para personalizar la recomendación de fix de los 10 checks de mayor volumen — llegando gratis a la UI y a los 3 exports sin tocar `packages/export`.

### What Worked

- Secuencia de riesgo ascendente (contrato de datos completo → wiring end-to-end mínimo → motor de recomendaciones) evitó retrabajo en cascada: el tipo `DetectedStack` se fijó antes de escribir ningún adaptador o UI consumidora.
- Verificar el copy de UI de terceros (`[REVISAR]`) contra documentación oficial vigente vía `WebSearch` en vez de asumir el research original — 5 de 7 rutas de menú habían cambiado de nombre/ubicación desde que se escribió el catálogo inicial.
- Cerrar el checkpoint de validación humana (redacción de copy, rutas de menú) en el mismo momento con Juan, en vez de diferirlo, evitó repetir el gap de proceso de v1.4 (checkpoints sin artefacto escrito).
- El chain completo code-review → fix → verify → nyquist → security corrió sin intervención manual salvo las 2 decisiones genuinamente humanas (aprobar redacción, decidir revisar las rutas de menú).

### What Was Inefficient

- La sesión anterior se cortó justo después de ejecutar los 3 plans de Phase 27 (commits + SUMMARY.md ya en `main`) pero antes de correr code-review/verify — el reinicio de `/gsd-autonomous` tuvo que reconciliar el estado en disco contra `STATE.md`/tasks desactualizados antes de poder continuar. Costo bajo (unos minutos de lectura de estado), pero evitable si la sesión hubiera dejado un `.continue-here.md` explícito antes de cortar.
- `27-SECURITY.md` es el primer `SECURITY.md` del proyecto — no hubo un baseline previo contra el cual comparar, así que la primera pasada de security-auditor tuvo que decidir criterio de aceptación (`accept` vs `mitigate`) sin precedente. Quedó documentado como baseline para milestones futuros.

### Patterns Established

- Paquetes de dominio puro (`@auditor/fingerprint`, `@auditor/cms-adapters`) desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime, con el `checkId` string como único punto de contacto — mismo patrón que `packages/graph`/`packages/scoring` de milestones anteriores, ahora consolidado como convención explícita del proyecto (ver `STATE.md` → Notas de ejecución).
- Recomendaciones/derivados costosos de recalibrar se resuelven en lectura dentro de `buildReportModel`, nunca persistidos pre-calculados — mismo principio para fingerprint (v1.5 Phase 25/26) y CMS-fix (v1.5 Phase 27).
- Verificar copy de UI de terceros contra la documentación oficial vigente (no solo contra el research original) antes de cerrar un checkpoint humano de "rutas de menú".

### Key Lessons

- Cuando una sesión autónoma se corta a mitad de fase, el primer paso del reinicio debe ser reconciliar disco vs. `STATE.md`/task list antes de re-planificar o re-ejecutar nada — el estado en disco (commits, SUMMARY.md) es la fuente de verdad, no la última entrada de `STATE.md`.
- Un `SECURITY.md` nuevo sin precedente en el proyecto necesita declarar explícitamente que es el baseline, para que futuras corridas sepan que no hay regresión que comparar todavía.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- 3 fases entregadas en 5 días calendario (2026-07-21 → 2026-07-25), con una interrupción/reconciliación de sesión en Phase 27.
- Notable: 2 pausas explícitas para decisión humana (validar copy, decidir revisar rutas de menú) — ambas resueltas en la misma sesión, sin diferir a una corrida separada.

## Milestone: v1.6 — Meta Tags / Social

**Shipped:** 2026-08-06
**Phases:** 5 (28-32) | **Plans:** 22

### What Was Built

Sexta categoría de score "Meta Tags / Social" (peso .10, rebalanceando on-page y datos estructurados) con 8 checks nuevos de Open Graph/Twitter Card/charset (`@auditor/meta-social`, motor puro desacoplado, mismo patrón que fingerprint/cms-adapters), validación de `og:image` con fetcher dedupeado y defensa SSRF propia (reusa/endurece la de Phase 31), instrumentación de response time/HTML size por página en el crawl, y un panel visual de preview social en el reporte (Google/Facebook/LinkedIn/X) con proxy server-side de imágenes (allowlist de origin exacto) y snippets HTML de fix prellenados con valores reales, accesibles/copiables.

### What Worked

- Secuenciar Scoring (Phase 29) *antes* de los checks nuevos (Phase 30) evitó escribir 8 checks contra un modelo que todavía podía cambiar.
- El chain code-review → auto-fix → re-review (3 iteraciones, capado) atrapó un bug real de atribución de imagen (`imageStatus` de `og:image` reusado ciegamente para `twitter:image`) y, en la segunda vuelta, un efecto colateral genuino de la propia corrección (comparación de URLs post-truncado) — ninguno de los dos lo hubiera cazado una sola pasada de review.
- Reusar la defensa SSRF de Phase 31 verbatim (subpath dedicado `packages/checks/src/network.ts`, no el barrel) en el proxy de imágenes de Phase 32 evitó reimplementar una superficie de seguridad ya endurecida.
- El integration checker de cierre de milestone confirmó en una sola pasada que la incompletitud de Phase 28 (Task 3 sin correr) no sangraba a ninguna fase downstream — permitió cerrar con confianza en vez de re-verificar manualmente cada consumidor.

### What Was Inefficient

- La sesión que ejecutó Phase 32 se cortó por agotamiento de contexto justo después del último plan (32-04), antes de correr code-review/verify — igual que el patrón ya visto en v1.5 Phase 27. Sigue siendo el punto de corte más común y más costoso de reconciliar.
- El sandbox donde corrió el cierre de milestone no resuelve `shared-postgres` (DNS), así que no se pudo browser-test contra datos reales — los 7 ítems de verificación visual/de red de Phase 32 y el smoke-test de Phase 28 quedaron genuinamente diferidos (no reconstruidos retroactivamente como en v1.4), lo cual es más honesto pero deja más trabajo pendiente post-cierre.
- El primer intento de spawnear los agentes de code-review/verify falló por límite de sesión/cuota de API a mitad de ejecución — el retry funcionó sin pérdida de trabajo (no había artefactos parciales que reconciliar), pero es la segunda vez que un límite de cuota interrumpe una corrida autónoma larga (ver v1.5).
- `gsd-tools milestone.complete` archivó con el prefijo de versión sin `v` (`1.6-ROADMAP.md` en vez de `v1.6-ROADMAP.md`) porque se le pasó `"1.6"` en vez de `"v1.6"` — inconsistente con el resto de `.planning/milestones/`; se corrigió a mano antes de comitear. Pasar siempre el argumento de versión con el prefijo `v` completo.

### Patterns Established

- Auto-fix loop de code review (fix → re-review independiente → fix si hace falta, capado a 3 iteraciones) como práctica estándar para hallazgos critical/warning antes de marcar una fase verificada — no confiar en que la primera corrección sea completa, especialmente cuando toca lógica de comparación/igualdad.
- Decisiones de seguridad "no es un bug" (ej. WR-03: allowlist de origin exacto sin excepciones) se dejan explícitamente sin tocar por el auto-fix y quedan documentadas para sign-off humano — el fixer no debe reinterpretar una decisión de producto ya bloqueada en el CONTEXT.md de la fase.
- Verificación humana genuinamente diferida (UAT.md con items pendientes + fila en `STATE.md` → Deferred Verification) es preferible a inventar una confirmación retroactiva cuando no hay forma real de probar contra datos/entorno reales — más honesto, aunque dependa de una sesión posterior con acceso real.

### Key Lessons

- Cuando `/gsd-autonomous` corre en un entorno sin acceso a la infraestructura real (DB/red interna), la verificación humana de UI/red debe quedar explícitamente diferida, no simulada ni omitida — decírselo al usuario y dejarlo registrado es mejor que fingir cobertura.
- Un fallo de cuota/límite de sesión a mitad de un Agent() no implica pérdida de trabajo si el agente no había escrito su artefacto de salida todavía — reintentar el mismo spawn es seguro; el riesgo real está en fallos *después* de que el artefacto ya se escribió pero antes del commit.
- Pasar siempre la versión completa con prefijo (`v1.6`, no `1.6`) a comandos de `gsd-tools` que la usan para nombrar archivos — un desajuste de convención en el nombre de archivo no rompe nada funcionalmente pero ensucia el archivo histórico si no se revisa a mano.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- 5 fases entregadas entre 2026-08-01 y 2026-08-06 (con retoma de Phase 32 y cierre de milestone en una sesión separada tras agotamiento de contexto), más un retry de agentes por límite de cuota.
- Notable: el chain de auto-fix (3 iteraciones de review + fix) sobre una sola fase (32) costó más tokens de subagente que las 3 fases previas combinadas (29-31) — pero cazó 2 bugs reales que una verificación de una sola pasada no hubiera encontrado.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Shipped | Nota |
|-----------|--------|-------|---------|------|
| v1.0 MVP | 7 | 7 | 2026-07-06 | Pipeline funcional, 63/63 req, 6 bugs reales cazados en verificación |
| v1.1 UI/UX | 3 | 19 | 2026-07-06 | UI-only, 31/31 req, pipeline v1.0 intacto |
| v1.4 Visualización avanzada + resolución URL | 4 | 10 | 2026-07-10 | 7/7 req, audit inicial gaps_found (proceso, no funcional) resuelto por confirmación retroactiva |
| v1.5 Fingerprinting técnico + fixes por CMS | 3 | 12 | 2026-07-25 | 18/18 req, audit `passed`, integración 10/10 wired, primer `SECURITY.md` del proyecto |
| v1.6 Meta Tags / Social | 5 | 22 | 2026-08-06 | 21/24 req `passed`, audit `gaps_found` (2 fases con UAT genuinamente diferido, 0 blockers de integración), auto-fix loop cazó 2 bugs reales |

**Tendencias:**
- Verificación con datos reales (juan-tech.com) sigue siendo la que caza los bugs de mayor impacto.
- Separar milestones por naturaleza (pipeline vs UI) mantuvo el blast radius chico y el audit limpio.
- Los checkpoints `human-verify` necesitan cerrarse con un artefacto escrito en el momento de la aprobación — de lo contrario el milestone-audit los marca como gap y hay que reconstruir la aprobación retroactivamente al cerrar (visto en v1.4, Fases 21/22; evitado en v1.5 cerrando en el momento; en v1.6 quedó genuinamente diferido en vez de reconstruido porque no había acceso real a datos).
- Copy de UI de terceros se desactualiza entre el research y el cierre de fase — verificar contra documentación oficial vigente al momento de la validación humana, no solo confiar en el research inicial (v1.5, Phase 27).
- La última fase de un milestone es la que más frecuentemente se corta por agotamiento de contexto justo antes de code-review/verify (v1.5 Phase 27, v1.6 Phase 32) — patrón recurrente a tener presente al planear la última fase de un milestone (dejarla más chica, o presupuestar una sesión de retoma).
- El auto-fix loop (review → fix → re-review, capado a 3 iteraciones) paga su costo extra de tokens cuando encuentra bugs reales de segunda orden (efectos colaterales del propio fix) que una sola pasada de review no vería (v1.6, Phase 32).
