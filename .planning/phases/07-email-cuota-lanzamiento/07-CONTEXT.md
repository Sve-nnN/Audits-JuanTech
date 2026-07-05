# Phase 7: Email, cuota y compuerta de lanzamiento - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Mode:** Autonomous. Última fase. Compuerta obligatoria antes de lanzamiento público.

<domain>
## Phase Boundary

Sólo emails verificados y dentro de su cuota semanal pueden lanzar una auditoría, con mitigaciones de abuso activas. Cubre AUTH-01..05, QUOTA-01..04. Cierra la v1 (lead magnet gratuito). NO incluye cobro/planes (v2).
</domain>

<decisions>
## Implementation Decisions

### Email + verificación (AUTH)
- **Provider abstraído:** interfaz `EmailProvider`. Impl **Resend** si `RESEND_API_KEY` está seteada; si no, **dev-mode** que loguea el link de verificación (permite verificar el flujo completo sin dominio/clave). Producción usa Resend (recomendado por research).
- **Double opt-in (AUTH-03/04):** al pedir auditoría con un email no verificado, generar token único (crypto random), guardar, enviar link `/verify?token=...`. El endpoint de verificación marca `Email.verified=true`. Sólo emails verificados pueden lanzar auditorías (AUTH-04).
- **Normalización (AUTH-02):** lowercase, trim, strip plus-addressing (`user+x@gmail` → `user@gmail`), filtro de dominios desechables (lista básica). Guardar `normalizedAddress` (ya existe en schema) + `address` original.
- **Consentimiento (AUTH-05):** al verificar, registrar timestamp, IP, y el texto de consentimiento mostrado (campos ya en modelo Email: consentIp, consentTextShown, consentAt). GDPR flag del research → registro probatorio.

### Cuota (QUOTA)
- **1 auditoría/semana/email (QUOTA-01):** ventana móvil de 7 días. Usar `QuotaUsage` (emailId + weekStart) o contar audits del email en los últimos 7 días. Al exceder → bloquear con mensaje claro (QUOTA-03).
- **Límite 500 URLs (QUOTA-02):** ya aplicado en el crawler (HARD_URL_CAP). Free tier fuerza urlLimit ≤ 500.
- **Historial (QUOTA-04):** persistir auditorías por email (ya via Audit.emailId + Site + scores + fecha). Endpoint/página de historial por email (lista de auditorías previas con score y fecha, y estado de corrección vía diff).

### Flujo integrado
- Home: input email + URL → si email no verificado, dispara verificación (no lanza auditoría aún) → usuario verifica → puede lanzar. Si verificado y dentro de cuota → crea Audit (asociado a emailId) y encola.
- `POST /api/audits` ahora requiere email verificado + chequea cuota antes de encolar.

### Claude's Discretion
- Estructura exacta de endpoints (`/api/verify`, `/api/request-verification`), páginas (`/verify`, `/history`).
- Lista de dominios desechables (básica, extensible).
- Cómo se asocia el email a la sesión (token en URL / cookie simple). Sin auth pesada (no passwords en v1).

<code_context>
## Existing Code Insights

- Modelo `Email` (address, normalizedAddress, verified, verifiedAt, consentIp/TextShown/At), `QuotaUsage` (emailId, weekStart, count), `Audit.emailId` — ya en schema desde Fase 1. Sólo falta la lógica.
- `POST /api/audits` hoy crea Audit sin email. Debe pasar por la compuerta.
- Crawler ya limita 500. Worker asocia todo al audit.
</code_context>

<specifics>
## Specific Ideas

- Verificación end-to-end SIN email real: dev-mode loguea el token/link → el orquestador lo usa para completar el flujo (request → verify → launch → quota block en 2do intento en la semana).
- Mitigación de abuso: normalización (plus-addressing, desechables) probada con `user+1@gmail.com` → mismo normalizedAddress que `user@gmail.com`.
</specifics>

<deferred>
## Deferred Ideas

- Cobro / auditorías ilimitadas / URLs ilimitadas → v2 (PAY).
- Auth con password/OAuth → no en v1 (email verificado alcanza para el lead magnet).
- Revisión legal GDPR formal → recomendada antes de lanzamiento real (flag), el registro de consentimiento queda implementado.
</deferred>
