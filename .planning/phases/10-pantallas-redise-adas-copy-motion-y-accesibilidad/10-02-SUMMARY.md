---
phase: 10-pantallas-redise-adas-copy-motion-y-accesibilidad
plan: 02
subsystem: web-ui
tags: [screen-01, home, re-skin, copy, motion, a11y, ds-01]
requires:
  - "Phase 9 components: Field, Input, Button, Badge"
  - "Wave 1 motion: useReveal/Reveal hook + globals [data-reveal] + motion tokens"
  - "Phase 8 tokens: --container-narrow, --text-secondary, --font-khand, spacing scale"
provides:
  - "Home SCREEN-01 re-skineado sin dead-space, contraste AA, copy neutro, motion sutil"
affects:
  - "apps/web/app/home.module.css (compartido con History — clases legacy preservadas)"
tech-stack:
  added: []
  patterns:
    - "Field+Input+Button composition para formularios accesibles"
    - "useReveal (mount, above-the-fold) + Reveal per-chip stagger + key-remount cross-fade"
    - "Foco por document.getElementById (id inyectado por Field) en vez de ref sobre Input"
key-files:
  created: []
  modified:
    - apps/web/app/HomeClient.tsx
    - apps/web/app/home.module.css
decisions:
  - "Home usa clases nuevas (.home/.shell/.hero/.flowCard/.homeForm/.foot); History conserva las clases legacy intactas — solo .page pierde el centrado al viewport"
  - "Input no expone ref en su tipo: el foco de paso se resuelve por id (Field inyecta id=email/url), sin tocar el componente Phase 9"
metrics:
  duration: ~35m
  completed: 2026-07-06
---

# Phase 10 Plan 02: Home SCREEN-01 Re-skin Summary

Re-skin del Home componiendo Field/Input/Button/Badge de Fase 9 + useReveal de Wave 1, matando el dead-space vertical (sin centrado al alto del viewport), subiendo el contraste a AA (--text-secondary), con copy en español neutro sin voceo (strings exactos del UI-SPEC) y motion sutil (reveal en carga, cross-fade de pasos, stagger de chips). La máquina de 3 estados y ambos fetch quedan idénticos en comportamiento.

## What Was Built

- **Estructura top→bottom (SCREEN-01):** hero `<h1>` Khand 36/600 + subtitle Geist Sans 16 en `--text-secondary`; card de flujo `--surface`/`--radius-lg`/`--shadow-md` con padding `--space-6`→`--space-8`; strip de 5 chips `<Badge variant="neutral">` (SEO Técnico · On-Page · Datos Estructurados · Rendimiento · AEO) con flex-wrap; footnote `--text-secondary` + link "Ver historial".
- **Formulario Fase 9:** pasos email/url usan `<Field label htmlFor hint error>` envolviendo `<Input inputSize="lg" type email|url>` con fuente mono tokenizada; CTAs `<Button size="lg" loading>`; back `<Button variant="ghost" iconLeft={ArrowLeft}>`. Panel check-email con `MailCheck` 32px + título Khand + body (no EmptyState). Línea de correo verificado con `CheckCircle2`.
- **Dead-space fix:** `.home` con padding vertical `--space-12`→`--space-16`→`--space-20` (capado), contenedor `--container-narrow` (720px). Cero `min-height:100vh`, cero centrado vertical al viewport. `.page` legacy también des-centrado (beneficia a History, no lo rompe).
- **Motion:** hero y card con `useReveal` (fade+slide en mount, above-the-fold); cross-fade del cuerpo del paso vía `key={step}` + animación opacity `--motion-base`; chips con stagger `--reveal-delay` (0/60/120/180/240ms) usando `<Reveal>`. Reduced-motion neutralizado por globals.css de Wave 1.
- **A11y:** un solo `<h1>`; al avanzar de paso el foco va al primer control (por id) o al heading del panel (`tabIndex=-1`); errores de campo vía `Field error` (role="alert"), errores de red/verificación en un bloque `role="alert"` de nivel superior; chips no interactivos; CTAs `<button type="submit">` reales.
- **Copy:** todos los strings exactos del UI-SPEC SCREEN-01, español neutro, sin voceo, sin em/en dashes.

## Data-fetching Preserved (verbatim behavior)

- Máquina `Step = "email" | "check-email" | "url"` intacta.
- `POST /api/request-verification` con ramas `data.verified` (→ url) / `data.devVerifyUrl` (→ check-email).
- `POST /api/audits` → `router.push('/audits/${auditId}')`, con la rama `403 + needsVerification` → vuelve a email.
- `page.tsx` sigue siendo el wrapper delgado (no modificado).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Input` no acepta `ref` en su tipo**
- **Found during:** Task 1 (typecheck TS2322).
- **Issue:** El interface/plan sugería un `ref` sobre `<Input>` para el foco de paso, pero `InputProps` (Fase 9) no expone `ref` (no usa `forwardRef`).
- **Fix:** El foco de paso se resuelve con `document.getElementById("email"|"url")` (Field inyecta el `id`), sin tocar el componente Fase 9. Esto además cierra los errores TS2322 que 10-05/10-06 habían registrado en deferred-items para este archivo.
- **Files modified:** apps/web/app/HomeClient.tsx
- **Commit:** 1f5dcd0

**2. [Rule 3 - Blocking] Prop `mono` inexistente en `Input`**
- **Found during:** Task 1.
- **Issue:** El plan/interfaz pedía `<Input mono>` pero `Input` no tiene esa prop (sería atributo HTML inválido + error de tipo).
- **Fix:** Se aplica la fuente mono vía `className={styles.mono}` (`--font-geist-mono` tokenizado), que `Input` concatena a su lista de clases.
- **Files modified:** apps/web/app/HomeClient.tsx, apps/web/app/home.module.css
- **Commit:** 1f5dcd0

**3. [Rule 1 - Tooling bug] Regex de voceo del plan sobre-captura copy neutro correcto**
- **Found during:** Task 1 verification.
- **Issue:** El comando `grep -inE 'ingres[áa]|...|consult[áa]'` del `<verify>` matchea también las formas neutras correctas mandadas por el UI-SPEC ("Ingresa tu correo", "consultar o compartir") porque `[áa]` incluye la 'a' sin acento.
- **Fix:** Se validó ausencia de voceo con un detector acentuado real (`ingresá|podés|abrilo|volvé|consultá|escribinos|usá|...`) → **cero** coincidencias. Se conservan los strings exactos del UI-SPEC (mandato del prompt). El requisito real (cero voceo) queda satisfecho.
- **Files modified:** ninguno (validación).

## Verification Results

- `pnpm --filter @auditor/web typecheck`: **mis 3 archivos type-clean** (cero errores en HomeClient.tsx / page.tsx / home.module.css). El typecheck app-wide queda en rojo por un único error ajeno (`audits/[id]/page.tsx:337`, `<Reveal>` sin cerrar) del plan de report en progreso — registrado en deferred-items, fuera de scope.
- Voceo real: **0** coincidencias.
- `min-height:100vh` en home.module.css: **0** (incluidos comentarios).
- `useReveal` presente en HomeClient.tsx.
- Hex crudo en home.module.css: **0** (solo tokens semánticos).
- Strings exactos del UI-SPEC presentes ("Audita tu sitio en minutos", "Auditar mi sitio").
- `next lint`: no configurado en el repo (prompt interactivo) — condición preexistente, fuera de scope.

## Checkpoint

- **Task 2 (checkpoint:human-verify)** auto-aprobado ("approved") bajo AUTO_MODE tras pasar los gates automatizados. La captura completa vía dev server queda interferida por el error JSX del plan hermano (report); la ruta `/` está aislada y compila. Validación pixel-perfect final (dark/light, 360px/1280px, contraste, foco, sin overflow) pendiente de Juan.

## Deferred Issues

- `apps/web/app/audits/[id]/page.tsx:337` — JSX `<Reveal>` sin cerrar (TS17002). Trabajo de SCREEN-04/report (10-04/10-05), no de 10-02. Ver `deferred-items.md`.

## Self-Check: PASSED

- FOUND: apps/web/app/HomeClient.tsx
- FOUND: apps/web/app/home.module.css
- FOUND: .planning/phases/10-.../10-02-SUMMARY.md
- FOUND: commit 1f5dcd0
