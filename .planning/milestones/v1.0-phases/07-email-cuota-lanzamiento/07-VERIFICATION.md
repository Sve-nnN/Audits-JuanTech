---
status: passed
phase: 7
verified: 2026-07-06
---

# Phase 7 Verification: Email, cuota y compuerta de lanzamiento

**Result:** ✅ PASSED — 5/5 success criteria verified end-to-end (dev-mode, Neon real) + 15 unit tests. Sin bugs.

## Success Criteria

### 1. Double opt-in antes de lanzar auditoría ✅
- `POST /api/audits` con email no verificado → **HTTP 403** ("Tenés que verificar tu email antes de lanzar la auditoría", needsVerification:true).
- `POST /api/request-verification` → token único (dev-mode devuelve `devVerifyUrl`). `POST /api/verify` con token+consentText → ok. Tras verificar, launch → **HTTP 201** (auditId).

### 2. Normalización antes de guardar ✅
- Verifiqué `juanverify2@gmail.com`, lancé con `juanverify2+xyz@gmail.com` → **201** (mismo email, plus-addressing normalizado). AUTH-02: lowercase, strip plus-addressing (gmail), blocklist de ~25 dominios desechables.

### 3. Evidencia de consentimiento registrada ✅
- Tras verify: `verified=true`, `verifiedAt`, `consentIp="::1"`, `consentTextShown="Acepto recibir..."`, `consentAt` — todos persistidos en Email (GDPR flag cubierto con registro probatorio).

### 4. Cuota 1/semana; mensaje claro al exceder ✅
- 2do launch del mismo email en la semana → **HTTP 429**: "Ya usaste tu auditoría gratuita de esta semana. Podés lanzar otra a partir del 12 jul 2026..." + `nextAllowedAt`. Ventana móvil 7 días (`FREE_WEEKLY_LIMIT=1`). Límite 500 URLs forzado (`FREE_URL_LIMIT`, crawler HARD_URL_CAP).

### 5. Historial por email persistido y consultable ✅
- `/history?email=juanverify2@gmail.com` → HTTP 200, muestra "Historial", sitio auditado, score, email. Audits asociados vía `Audit.emailId`.

## Requirements
- AUTH-01..05 ✅  QUOTA-01..04 ✅

## Tests
- vitest: 12 en @auditor/email (normalize plus/dots/desechables, token lifecycle create→verify→reuse-rejected→expired), 3 en @auditor/quota (dentro/fuera de ventana). Total repo: 140 tests verdes. typecheck + build limpios (10 paquetes).

## Notas de producción
- **Envío real de email requiere `RESEND_API_KEY` + dominio verificado en Resend.** Sin la key, el sistema corre en dev-mode (loguea/devuelve el link, no manda emails). `APP_URL` y `EMAIL_FROM` opcionales.
- Sin auth pesada (no passwords) — email verificado alcanza para el lead magnet v1.
- Revisión legal GDPR formal recomendada antes de lanzamiento real (el registro de consentimiento ya está implementado).

## Human verification
Ninguna bloqueante — flujo completo verificado end-to-end contra Neon real.
