---
phase: 25-fingerprint-de-stack-tecnico-contrato-de-datos-y-motor-de-deteccion
reviewed: 2026-07-21T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - packages/fingerprint/src/types.ts
  - packages/fingerprint/src/index.ts
  - packages/fingerprint/src/detectStack.ts
  - packages/fingerprint/src/detectStack.test.ts
  - packages/fingerprint/src/signatures/registry.ts
  - packages/fingerprint/src/signatures/registry.test.ts
  - packages/fingerprint/src/signatures/cms.ts
  - packages/fingerprint/src/signatures/builder.ts
  - packages/fingerprint/src/signatures/cdn.ts
  - packages/fingerprint/src/signatures/hosting.ts
  - packages/fingerprint/src/signatures/jsFramework.ts
  - packages/fingerprint/src/signatures/analytics.ts
  - packages/fingerprint/src/__fixtures__/synthetic.ts
  - packages/fingerprint/src/__fixtures__/realSites.ts
  - packages/crawler/src/captureHeaders.ts
  - packages/crawler/src/crawl.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: resolved
resolution:
  reviewed_by: gsd-code-reviewer
  fixed_by: execute-phase-25 (inline)
  fixed_commit: 3444b11
  outcomes:
    WR-01: fixed
    WR-02: fixed
    WR-03: fixed
    IN-01: no_change_needed
    IN-02: no_change_needed
    IN-03: no_change_needed
  post_fix_verification: "pnpm --filter @auditor/fingerprint typecheck exit 0; 34/34 tests pass"
---

# Phase 25: Reporte de Code Review

**Revisado:** 2026-07-21
**Profundidad:** deep (análisis cross-file de motor + firmas + wiring del crawler)
**Archivos revisados:** 16
**Estado:** issues_found

## Resumen

El código de fingerprinting está bien construido en lo estructural y cumple los focos críticos de la fase:

- **Desacople runtime:** `@auditor/fingerprint` solo depende de `cheerio` (verificado en `package.json` y por grep de imports). No hay import de `@auditor/db`, `@auditor/crawler`, `@auditor/checks` ni `@prisma/client`. Correcto.
- **Seguridad de captura:** `parseCookieNames` extrae solo el nombre (`split(";")[0].split("=")[0]`), nunca valores/atributos. `set-cookie` no está en `CURATED_HEADER_KEYS`, así que su valor jamás se persiste. `curateHeaders` itera el allowlist fijo, nunca las keys entrantes → sin prototype pollution. `aggregate` refuerza con `Object.create(null)`. Correcto.
- **Independencia por eje:** cada eje se resuelve por separado (`resolveAxis`/`resolveBuilder`/`resolveAnalytics`), no hay winner-take-all. Verificado con `multiAxisPage`.
- **Umbrales de confianza:** `resolveConfidence` implementa exactamente 2+ fuertes → alto, 1 fuerte inequívoca → alto, 1 fuerte → medio, débil → bajo, 0 → no-detectado.
- **WordPress sin builder:** `resolveBuilder` devuelve `no-detectado` cuando no hay marcador positivo y en empate real; Gutenberg solo matchea con `wp-block-*`/`<!-- wp:`. Correcto, con cobertura de test.
- **`Signature.test` devuelve number:** confirmado en todas las firmas y en `registry.test.ts`.

No se hallaron BLOCKERs de seguridad ni de pérdida de datos. Los hallazgos son de **correctness de calibración** (falsos positivos en analytics) y de **coherencia entre documentación y comportamiento** del resolvedor de confianza. El más impactante (WR-01) produce una detección sistemáticamente incorrecta en un caso muy común.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Falso positivo sistemático de "Google Tag Manager" por el token genérico `dataLayer`

**Archivo:** `packages/fingerprint/src/signatures/analytics.ts:29`
**Issue:** La firma de GTM matchea con OR sobre tres needles: `"googletagmanager.com/gtm.js"`, `"GTM-"` y `"dataLayer"`. El snippet estándar de instalación de **GA4 vía gtag.js** (sin GTM) incluye literalmente `window.dataLayer = window.dataLayer || [];`. Por lo tanto, casi cualquier sitio con GA4 estándar será reportado también como "Google Tag Manager" (confianza `medio`), aunque no use GTM. Es una detección incorrecta en una configuración muy frecuente y no está cubierta por ningún test (el único fixture, `analyticsTrioPage`, sí tiene GTM real, ocultando el defecto).
**Fix:** Exigir un marcador propio de GTM y sacar `dataLayer` como disparador único. Por ejemplo, requerir el patrón de contenedor o el loader:
```ts
// analytics.ts
test: (ctx) => htmlIncludes(ctx, "googletagmanager.com/gtm.js", "GTM-"),
```
`dataLayer` puede conservarse como señal secundaria solo si coexiste con `GTM-`, pero no debe bastar por sí solo para reportar GTM.

### WR-02: La confianza de CDN/hosting no refleja el conteo multi-header; el docstring afirma lo contrario

**Archivo:** `packages/fingerprint/src/signatures/cdn.ts:5` (docstring) y `packages/fingerprint/src/detectStack.ts:93-99`
**Issue:** El comentario de `cdn.ts` afirma: "La confianza se deriva del número de headers independientes del mismo vendor (multi-señal)". Pero el motor colapsa cada firma en **una sola** `Signal` (`resolveAxis` crea un `Signal` por firma, no por marcador). Como cada vendor de CDN/hosting/jsFramework tiene **una única firma**, `resolveConfidence` siempre ve como máximo 1 señal fuerte → `medio`, salvo que la firma sea `unequivocal` (→ `alto`). Consecuencia real: **Fastly nunca puede llegar a `alto`** aunque estén presentes `x-served-by` + `x-cache` + `via: varnish` (count=3), porque no está marcada `unequivocal`. El valor `count` que devuelven estas firmas es efectivamente inerte para la confianza (solo se usa en el desempate de `builder`). El comportamiento contradice la intención documentada.
**Fix:** O bien alinear el docstring con la realidad (la confianza de CDN depende de `unequivocal`, no del conteo), o bien, si se quiere que multi-header suba a `alto`, hacer que `resolveConfidence` considere el `count` del `Signal` (p. ej. `count >= 2` de una firma fuerte → tratarlo como 2+ fuertes). Recomendado como mínimo corregir el comentario para no inducir a error en la fase de reporte (Phase 26).

### WR-03: Needles de analytics (Meta Pixel / GA4) demasiado laxos → riesgo de falso positivo

**Archivo:** `packages/fingerprint/src/signatures/analytics.ts:22,36`
**Issue:** Misma clase de problema que WR-01, de menor frecuencia: `"connect.facebook.net"` (línea 36) también lo carga el SDK de Facebook / login social sin tener el Pixel, y `"gtag("` (línea 22) puede aparecer en sitios que despliegan gtag a través de GTM sin tener GA4 propio. Cualquiera de los tres needles por sí solo dispara la detección (suma con `+`, count≥1). Produce herramientas reportadas que el sitio no usa realmente.
**Fix:** Endurecer a marcadores propios: para Meta Pixel exigir `fbevents.js` o `fbq(` (no la mera presencia de `connect.facebook.net`); para GA4 exigir el loader con id `gtag/js?id=G-` en lugar de aceptar `gtag(` suelto. Añadir un fixture "GA4-only" y "FB-SDK-sin-Pixel" para blindar contra regresiones.

## Info

### IN-01: `as never` sobre campos Json de Prisma oculta el tipado del payload

**Archivo:** `packages/crawler/src/crawl.ts:127,132,140,143`
**Issue:** `responseHeaders as never` y `redirectChain as never` anulan por completo el chequeo de tipos en el borde crawler→DB. Si el shape de `curateHeaders` cambiara, el compilador no lo detectaría. Es un patrón de escape de tipos.
**Fix:** Tipar contra `Prisma.InputJsonValue` (`responseHeaders satisfies Prisma.InputJsonValue`) en lugar de `as never`, para conservar la verificación estructural del payload persistido.

### IN-02: `curateHeaders` devuelve un objeto literal en vez de `Object.create(null)`

**Archivo:** `packages/crawler/src/captureHeaders.ts:50`
**Issue:** `const out: Record<string, string> = {}` usa el prototipo estándar. Es inofensivo aquí porque solo se escriben keys del allowlist (nunca keys controladas por el sitio), pero es inconsistente con la defensa endurecida de `aggregate` (`Object.create(null)`). Coherencia defensiva.
**Fix:** Opcional. `const out: Record<string, string> = Object.create(null);` alinea el patrón anti-pollution en ambos bordes.

### IN-03: Detección de Vue por substring `"data-v-"` puede matchear salida de otras herramientas de CSS scoped

**Archivo:** `packages/fingerprint/src/signatures/jsFramework.ts:59`
**Issue:** `"data-v-"` es el atributo de scoped-CSS de Vue SFC, pero cadenas similares pueden aparecer en HTML generado por otras toolchains. Está correctamente marcado `debil` (tope `bajo`), así que el impacto es limitado, pero conviene documentarlo como calibración conocida.
**Fix:** Aceptable como está por ser `debil`. Si se desea más precisión, combinar con la presencia de `__vue__`/`data-server-rendered` para elevar señal.

---

## Resolución de hallazgos (2026-07-21, commit 3444b11)

| Finding | Outcome | Nota |
|---------|---------|------|
| WR-01 | **fixed** | Firma GTM endurecida: needles `googletagmanager.com/gtm.js` + `GTM-`; se quitó `dataLayer` (compartido con el snippet de GA4). Elimina el falso positivo sistemático de GTM. |
| WR-02 | **fixed** | Docstring de `cdn.ts` corregido: aclara que la confianza la fija `resolveConfidence` por marcador `unequivocal` o firma única fuerte, y que el conteo de headers es solo evidencia (no puntaje). Se documentó como limitación conocida; NO se cambió el motor (Fastly sigue topando en `medio` por diseño — evita subir a `alto` sin marcador inequívoco). |
| WR-03 | **fixed** | GA4 exige el loader `gtag/js?id=G-` (se quitó `gtag(` suelto, compartido con Google Ads/GTM). Meta Pixel exige `fbevents.js`/`fbq(` (se quitó `connect.facebook.net` suelto, que también carga el SDK de FB). |
| IN-01 | **no_change_needed** | `responseHeaders as never` replica la convención pre-existente de `redirectChain as never` (también campo Json) en el mismo archivo. Cambiar a `satisfies Prisma.InputJsonValue` divergiría del patrón vigente y arriesga regresión de typecheck. Se deja consistente; candidato a limpieza transversal futura de todos los casts Json del crawler. |
| IN-02 | **no_change_needed** | `curateHeaders` escribe SOLO keys del allowlist hardcodeado (`CURATED_HEADER_KEYS`), nunca keys controladas por el sitio → sin vector de prototype pollution. Migrar a `Object.create(null)` arriesgaría los `toStrictEqual` de la suite del crawler sin ganancia de seguridad real. |
| IN-03 | **no_change_needed** | La firma de Vue (`data-v-`) está correctamente marcada `debil` → tope de confianza `bajo`. Endurecerla con `__vue__`/`data-server-rendered` arriesga falsos negativos en SSR de Vue; se acepta como calibración conocida documentada. |

**Verificación post-fix:** `pnpm --filter @auditor/fingerprint typecheck` exit 0; `vitest run` 34/34 tests en verde.
**Estado final:** resolved (3 warnings corregidos, 3 info anotados como no_change_needed con justificación).

---

_Revisado: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Fixes inline + resolución: execute-phase-25_
_Depth: deep_
