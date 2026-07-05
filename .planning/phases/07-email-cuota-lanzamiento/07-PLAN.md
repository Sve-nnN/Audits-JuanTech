# Phase 7 Plan: Email, cuota y compuerta de lanzamiento

**Requirements:** AUTH-01..05, QUOTA-01..04
**Mode:** mvp · última fase (compuerta de lanzamiento)

## Tasks

1. **DB** — `EmailVerification` (id, emailId, token @unique, expiresAt, usedAt?) o token en Email. Confirmar campos de consentimiento en Email (ya existen). Push a Neon.
2. **`packages/email`** (`@auditor/email`):
   - `normalize.ts` — `normalizeEmail(raw)`: lowercase/trim, strip plus-addressing (gmail), detectar desechables (lista básica); devuelve `{ address, normalizedAddress, isDisposable }`.
   - `provider.ts` — interfaz `EmailProvider`; `ResendProvider` (si `RESEND_API_KEY`), `DevProvider` (loguea link). `getEmailProvider()` elige según env.
   - `verification.ts` — crear token (crypto), armar link, enviar; verificar token (válido, no usado, no expirado) → marca Email verified + consentimiento.
   - tests (normalize, token lifecycle con provider fake).
3. **Web — flujo de verificación + cuota:**
   - `POST /api/request-verification` `{ email }` → normaliza, upsert Email, si no verificado crea token + envía (dev-mode loguea). Registra intento de consentimiento.
   - `GET /api/verify?token=...` (o `/verify` page) → verifica token, marca Email verified + consentIp/At/TextShown.
   - `POST /api/audits` — AHORA requiere email verificado + chequea cuota (1/7días) antes de encolar; asocia `Audit.emailId`; fuerza urlLimit ≤ 500. Si no verificado → 403 con instrucción; si excede cuota → 429 con mensaje claro (QUOTA-03).
   - `/history?email=...` o por token/cookie → lista auditorías del email (score, fecha, sitio, link al reporte).
   - Home actualizado: email + URL; maneja estados (no verificado → pedir verificación; verificado → lanzar).
4. **Cuota** — `packages/quota` o helper: `canRunAudit(emailId)` cuenta audits en 7 días; `recordUsage`. QUOTA-01/02/03/04.
5. **Verificación** — flujo completo dev-mode: request-verification → capturar token del log → verify → launch audit (ok) → 2do launch misma semana → bloqueado (429). Normalización: `user+1@gmail.com` == `user@gmail.com`. Consentimiento registrado. Unit tests.

## Success Criteria (ROADMAP)
1. Usuario debe dejar email y verificarlo (double opt-in) antes de lanzar auditoría.
2. Email normalizado (lowercase, sin plus-addressing, filtro desechables) antes de guardar.
3. Evidencia de consentimiento (timestamp, IP, texto) registrada al verificar.
4. Email verificado no puede iniciar > 1 auditoría por ventana móvil de 7 días; al exceder, mensaje claro.
5. Historial de auditorías por email (sitio, stats, fecha, estado de corrección) persistido y consultable.

## Verification Strategy
- Unit: normalize (plus/desechables), token lifecycle, cuota (dentro/fuera de ventana).
- Integración dev-mode: flujo completo request→verify→launch→cuota-block; historial; asociación emailId.
