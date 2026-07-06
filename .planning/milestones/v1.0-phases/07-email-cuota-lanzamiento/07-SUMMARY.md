---
phase: 7
plan: 1
subsystem: email-verification-quota-launch-gate
tags: [email, double-opt-in, quota, rate-limiting, launch-gate]
requires: [packages/db (Email/EmailVerification/QuotaUsage/Audit.emailId), apps/web/app/api/audits]
provides: [packages/email, packages/quota, request-verification flow, /verify page, gated /api/audits, /history]
affects: [apps/web/app/page.tsx, apps/web/app/api/audits/route.ts]
tech-stack:
  added: ["@auditor/email", "@auditor/quota"]
  patterns: ["storage-interface DI for offline-testable verification/quota logic", "provider abstraction (Resend/DevProvider) picked by env"]
key-files:
  created:
    - packages/email/src/normalize.ts
    - packages/email/src/provider.ts
    - packages/email/src/verification.ts
    - packages/email/src/prismaStore.ts
    - packages/email/src/index.ts
    - packages/quota/src/canRunAudit.ts
    - packages/quota/src/prismaStore.ts
    - packages/quota/src/index.ts
    - apps/web/app/api/request-verification/route.ts
    - apps/web/app/api/verify/route.ts
    - apps/web/app/verify/page.tsx
    - apps/web/app/verify/VerifyClient.tsx
    - apps/web/app/history/page.tsx
    - apps/web/app/HomeClient.tsx
  modified:
    - packages/db/prisma/schema.prisma
    - apps/web/app/api/audits/route.ts
    - apps/web/app/page.tsx
    - apps/web/app/home.module.css
    - apps/web/next.config.ts
    - apps/web/package.json
decisions:
  - "Verification/quota persistence goes through small storage interfaces (VerificationStore, AuditCountStore) with a PrismaXStore implementation, so token/quota logic is unit-tested fully offline with in-memory fakes."
  - "Dev-mode surfaces the verification link directly in the /api/request-verification response (devVerifyUrl) when RESEND_API_KEY is unset, in addition to console-logging it, so the full flow can be exercised without a real inbox."
  - "Gmail normalization treats googlemail.com as gmail.com and strips dots + plus-tags; other domains only strip plus-tags."
metrics:
  duration: "~90 min"
  completed: "2026-07-05"
---

# Phase 7 Plan 1: Email, cuota y compuerta de lanzamiento Summary

Double opt-in por email (normalización + lista de desechables + token de verificación de 24h), cuota gratuita de 1 auditoría/semana por email (ventana móvil de 7 días) y compuerta de lanzamiento en `POST /api/audits`, con historial de auditorías por email.

## What Was Built

### 1. DB (`packages/db/prisma/schema.prisma`)

- Nuevo modelo `EmailVerification` (`id`, `emailId` FK, `token @unique`, `expiresAt`, `usedAt?`, `createdAt`, índice por `emailId`).
- `Email`, `QuotaUsage` y `Audit.emailId` ya existían desde la Fase 1; sólo se agregó la relación inversa `verifications` en `Email`.
- `prisma db push` + `generate` corridos contra el Neon real (`DATABASE_URL` de `.env`).

### 2. `packages/email` (`@auditor/email`)

- **`normalize.ts`** — `normalizeEmail(raw)`: trim + lowercase, valida formato básico, detecta dominios desechables (lista de ~25 dominios: mailinator, guerrillamail, 10minutemail, yopmail, tempmail, etc.), y normaliza direcciones Gmail (`googlemail.com` → `gmail.com`, quita puntos y todo lo posterior a `+`). Para dominios no-Gmail sólo recorta el sufijo `+tag`. Devuelve `{ address, normalizedAddress, isDisposable, valid }`.
- **`provider.ts`** — interfaz `EmailProvider` (`send({to, subject, html, text})`). `ResendProvider` llama a la API de Resend vía `fetch` usando `RESEND_API_KEY` (+ `EMAIL_FROM` opcional). `DevProvider` sólo hace `console.log` del asunto + link (modo offline). `getEmailProvider()` elige por la presencia de `RESEND_API_KEY`.
- **`verification.ts`** — lógica pura de tokens: `generateToken()` (32 bytes random hex), `buildVerificationUrl()` (usa `APP_URL` o `http://localhost:3000`), `createVerification(emailId, to, store, provider?)` (crea token con TTL 24h, persiste y envía el email), `verifyToken(token, {ip, consentText}, store)` (válido + no usado + no expirado → marca usado + marca `Email.verified/verifiedAt/consentIp/consentTextShown/consentAt`). Depende de una interfaz `VerificationStore`, no de Prisma directamente — permite tests 100% offline con un store/provider en memoria.
- **`prismaStore.ts`** — `PrismaVerificationStore` implementa `VerificationStore` contra `@auditor/db`.
- Constante `CONSENT_TEXT` (texto de consentimiento exacto mostrado y persistido).
- Tests: `normalize.test.ts` (plus-addressing, dots de Gmail, googlemail→gmail, desechables, formatos inválidos) y `verification.test.ts` (ciclo completo con store/provider fake: creación+envío, verificación exitosa, reintento de token usado rechazado, token expirado rechazado con `vi.useFakeTimers`).

### 3. `packages/quota` (`@auditor/quota`)

- **`canRunAudit.ts`** — `canRunAudit(emailId, store, now?)`: cuenta auditorías del email en la ventana móvil de 7 días vía `AuditCountStore.countRecentAudits`; si `count < FREE_WEEKLY_LIMIT` (1) permite, si no bloquea con mensaje claro en español + `nextAllowedAt` calculado desde la auditoría más antigua dentro de la ventana. `FREE_URL_LIMIT = 500` también exportado desde acá como fuente única de verdad para el cap.
- **`prismaStore.ts`** — `PrismaAuditCountStore` cuenta `Audit` por `emailId` + `createdAt >= since` y busca la más antigua dentro de la ventana.
- Tests: dentro de cuota (0 previas → permitido), fuera de cuota (1 hace 3 días → bloqueado con `nextAllowedAt` = oldest + 7d), y caso "afuera de la ventana" (store ya excluye lo viejo → permitido).

### 4. Web — flujo de verificación + compuerta

- **`POST /api/request-verification`** — normaliza el email, rechaza inválidos/desechables, hace `upsert` de `Email` por `normalizedAddress`. Si ya está verificado devuelve `{verified:true}`; si no, crea el token + envía (Resend o dev-log) y devuelve `{sent:true}`. En dev-mode (sin `RESEND_API_KEY`) también incluye `devVerifyUrl` en la respuesta para poder probar el flujo sin bandeja de entrada real.
- **`/verify?token=...`** — página server component que lee el token y muestra el texto de consentimiento (`CONSENT_TEXT` importado del paquete) vía un subcomponente cliente (`VerifyClient`) con botón "Confirmar y aceptar".
- **`POST /api/verify`** — recibe `{token, consentText}`, extrae IP de `x-forwarded-for`/`x-real-ip`, llama `verifyToken`. Maneja `not_found` / `used` / `expired` con mensajes claros; en éxito marca el `Email` verificado con evidencia de consentimiento.
- **`POST /api/audits`** — ahora exige `{url, email}`: normaliza el email, busca `Email` verificado por `normalizedAddress` (403 + `needsVerification:true` si no existe o no está verificado), corre `canRunAudit` (429 + `reason`/`nextAllowedAt` si excede cuota), y sólo entonces crea `Site`/`Audit` (con `emailId`) y encola. `urlLimit` sigue capado en `FREE_URL_LIMIT` (500), ahora importado de `@auditor/quota` como única fuente del cap (antes era una constante local duplicada).
- **`/history?email=...`** — página server component: formulario de búsqueda por email + tabla de auditorías previas de ese email (dominio, score, estado, fecha, link al reporte).
- **Home (`app/page.tsx` + `app/HomeClient.tsx`)** — ahora es un flujo de 3 pasos: (1) pedir email → `POST /api/request-verification`; si ya verificado salta directo a (3); si no, pasa a (2) "revisá tu email" (muestra el link en dev-mode); tras confirmar en `/verify`, el usuario vuelve a `/?email=...` que salta directo a (3) URL → `POST /api/audits`, maneja 403 (vuelve a pedir verificación) y 429 (cuota) mostrando el mensaje del backend, y en éxito redirige a `/audits/[id]`.

### 5. Config

- `apps/web/next.config.ts`: agregados `@auditor/email` y `@auditor/quota` a `transpilePackages` (paquetes workspace sin build step).
- `apps/web/package.json`: agregadas dependencias `@auditor/email` y `@auditor/quota`.

## Verification Performed

- `pnpm install`, `prisma db push` + `generate` contra Neon real: OK.
- `pnpm -r typecheck`: OK en los 11 proyectos (incluidos los 2 paquetes nuevos).
- `pnpm -r test`: OK — 12 tests nuevos en `@auditor/email` (normalize + verification lifecycle), 3 en `@auditor/quota`; el resto de la suite (scoring, psi, crawler, checks) sigue en verde (140 tests totales entre todos los paquetes).
- `pnpm -r build`: OK, `next build` genera todas las rutas nuevas (`/api/request-verification`, `/api/verify`, `/verify`, `/history`) sin errores.
- **Flujo end-to-end en dev-mode** (levantando `next dev` localmente contra el Neon real, sin `RESEND_API_KEY`):
  1. `POST /api/request-verification {email: "testphase7+dev@gmail.com"}` → `{sent:true, devVerifyUrl: ".../verify?token=..."}`.
  2. `POST /api/verify {token, consentText}` → `{ok:true, email:"testphase7+dev@gmail.com"}`. `Email.verified=true` con IP/consentAt/consentTextShown grabados.
  3. `POST /api/audits {url:"https://example.com", email:"testphase7@gmail.com"}` (nótese: sin el `+dev`, mismo `normalizedAddress`) → `201 {auditId}` — confirma que la normalización de plus-addressing funciona de punta a punta (mismo email normalizado, ya verificado por el paso 2).
  4. Segundo intento la misma semana con `testphase7+other@gmail.com` (misma dirección normalizada) → `429` con mensaje "Ya usaste tu auditoría gratuita de esta semana. Podés lanzar otra a partir del [fecha]." y `nextAllowedAt`.
  5. Intento con email nunca verificado → `403 {needsVerification:true}`.
  6. `request-verification` con `throwaway@mailinator.com` → `400` (desechable rechazado).
  7. `/history?email=testphase7@gmail.com` → lista la auditoría creada en el paso 3.
  - Los datos de prueba (Email, Audit, EmailVerification de `testphase7@gmail.com`) se limpiaron de la base Neon real al finalizar la verificación; no queda data de prueba residual.

## How to Verify the Flow Yourself (dev-mode, sin RESEND_API_KEY)

1. `pnpm --filter @auditor/web dev`
2. Abrir `http://localhost:3000/`, ingresar un email.
3. Como no hay `RESEND_API_KEY`, la respuesta de `/api/request-verification` (visible en Network tab, y también en consola del server) incluye el link `devVerifyUrl` / se loguea `[DEV EMAIL]` con el link — la UI también lo muestra directamente bajo "Modo desarrollo".
4. Abrir ese link (`/verify?token=...`), click "Confirmar y aceptar".
5. Volver a la home (el link post-verificación ya redirige con `?email=...`), ingresar una URL, lanzar la auditoría.
6. Repetir el lanzamiento con el mismo email dentro de la misma semana → debe devolver 429.

## Deviations from Plan

None — el plan se ejecutó tal como estaba escrito. Decisiones de diseño (documentadas arriba en `decisions`): interfaces de storage para DI/testing offline, y el campo `devVerifyUrl` de conveniencia en dev-mode (no estaba explícitamente detallado en el plan pero es consistente con "dev-mode shows the link" de la sección 4 del prompt).

## Known Stubs

Ninguno. El flujo completo (request → verify → launch → quota-block → historial) está conectado a datos reales de Postgres, sin mocks ni datos hardcodeados en la UI.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: new-endpoint | apps/web/app/api/request-verification/route.ts | Nuevo endpoint público que hace upsert de Email por email arbitrario del request — mitigado por normalización + filtro de desechables; no hay rate-limiting propio del endpoint (fuera de alcance v1, igual que el resto de la app). |
| threat_flag: new-endpoint | apps/web/app/api/verify/route.ts | Nuevo endpoint público que consume un token de un solo uso; IP capturada vía `x-forwarded-for` (confiable sólo si el hosting está detrás de un proxy que la setea correctamente, ej. Vercel). |
| threat_flag: consent-evidence | packages/email/src/prismaStore.ts | Persiste IP + texto de consentimiento exacto como evidencia probatoria (dato potencialmente sensible bajo GDPR) — alineado con la decisión de Fase 7, pendiente la revisión legal ya marcada como blocker en STATE.md. |

## Production Notes

- **RESEND_API_KEY** no está seteada en este entorno (`.env` sólo tiene `DATABASE_URL`, `REDIS_URL`, `PSI_API_KEY`) — en producción hace falta setearla + tener un dominio de envío verificado en Resend (o usar el dominio compartido `onboarding@resend.dev` sólo para pruebas, no apto para producción real). Sin la key, `getEmailProvider()` sigue devolviendo `DevProvider` (sólo logs), por lo que el double opt-in real de usuarios finales no funcionará hasta configurarla.
- `APP_URL` (opcional) controla el host usado en los links de verificación; por defecto `http://localhost:3000`. Debe setearse al dominio real de producción (ej. Vercel) para que los links de verificación apunten correctamente.
- `EMAIL_FROM` (opcional) controla el remitente en Resend; por defecto `Auditor <onboarding@resend.dev>` (dominio de pruebas de Resend, reemplazar por un dominio propio verificado en producción).

## Self-Check

Verifying created files and referenced commits below.
