---
phase: 30-checks-de-meta-tags-social
verified: 2026-08-03T10:50:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
unverified_prohibitions: 43
human_verification:
  - test: "Revisar el estrechamiento de SOCIAL-06 a la lista blanca de 7 propiedades og de valor único (og:title, og:description, og:url, og:type, og:site_name, og:locale, og:determiner) contra la regla lockeada en 30-CONTEXT.md, que dice 'agrupar meta[property] por su valor de property; marcar issue sólo cuando un grupo tiene >1 tag Y sus content difieren'."
    expected: "Confirmar que excluir og:image, og:locale:alternate y las familias og:video*/og:audio* del check es la decisión deseada, y registrar un override si se acepta. La lista blanca es más estrecha que el Success Criterion #3 y que la decisión de contexto, aunque coincide mejor con el objetivo de fase (una og:image repetida no rompe el compartido: es la forma documentada del protocolo para declarar varios recursos)."
    why_human: "Es una decisión de producto sobre el alcance de un requisito, no un hecho verificable en el código. El código hace exactamente lo que dice hacer y está probado; lo que está en duda es si ese alcance es el que Juan quiere."
  - test: "Decidir el destino de WR-05: packages/cms-adapters/src/types.ts sigue listando ONPAGE-05 en SUPPORTED_CHECK_IDS y no contiene ninguna entrada SOCIAL-01..08."
    expected: "Toda incidencia de Open Graph sobre WordPress/Shopify/Webflow/Wix/Squarespace pierde la recomendación específica de plataforma que tenía antes de v1.6 y cae al texto genérico, mientras un slot del catálogo lo ocupa un check que ya no puede dispararse. Ni Phase 31 ni Phase 32 lo cubren en sus Success Criteria, así que no es un gap diferido: o se planifica o se acepta explícitamente."
    why_human: "Requiere decidir prioridad y fase de destino. La verificación sólo puede constatar que la regresión existe y que ninguna fase posterior la reclama."
  - test: "Aceptar o corregir los falsos negativos de SOCIAL-08 (WR-01), reproducidos empíricamente en esta verificación."
    expected: "Una página con <meta name=\"description\" content=\"Como declarar charset=utf-8\"> y sin declaración real devuelve hasCharsetInFirstKB = true; una con la etiqueta comentada <!-- <meta charset=\"utf-8\"> --> también. En los dos casos el usuario nunca ve la fila de advertencia. El comportamiento central es correcto (sin charset -> advierte; charset después del byte 1024 -> advierte; http-equiv -> ok)."
    why_human: "El header del archivo declara el primer caso como aproximación aceptada, pero el caso del comentario no está documentado y la dirección del error (falso negativo) es la que la auditoría no puede recuperar. Decidir si se aplica el fix propuesto en 30-REVIEW.md o se acepta el riesgo."
---

# Phase 30: Checks de meta tags/social — Verification Report

**Phase Goal:** El auditor detecta y reporta, por página, los problemas de Open Graph, Twitter Card, charset y duplicados de tags que afectan cómo se ve el sitio al compartirse.
**Verified:** 2026-08-03T10:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Extracción desde el HTML ya parseado (sin segundo parseo), og:*/twitter:card/charset, motor puro testeable con fixtures | ✓ VERIFIED | `packages/meta-social/src/extract.ts:31` recibe `CheerioAPI` del contexto. Cero `cheerio.load` en los 8 archivos de check de producción (grep limpio). 7 fixtures en `__fixtures__/`. 20 tests en `@auditor/meta-social` pasan. |
| 2 | Issues de presencia/longitud para og:title (10-60), og:description (55-200), og:image (absoluta HTTPS), og:url (coherente con canonical) y presencia de og:type | ✓ VERIFIED | Umbrales en `thresholds.ts:16,19,28,31` importados por `ogTitle.ts:1` y `ogDescription.ts:1`; cero redeclaración numérica en los checks. `ogImage.ts:97,117` separa absoluta/relativa/protocol-relative/http. `ogUrl.ts:82-86` relee canonical y compara vía `normalizeUrl`. `ogType.ts` sin comparación contra lista cerrada. |
| 3 | Duplicados OG con valores distintos; twitter:card ausente/inválido; resto de twitter:* sólo si falta también el OG equivalente | ✓ VERIFIED (con estrechamiento) | `ogDuplicates.ts:66` exige `values.length > 1 && distinct.size > 1`; caso cruzado property+name cubierto (`ogDuplicates.test.ts:44`). `twitterCard.ts:78` valida contra `TWITTER_CARD_VALUES`; `:100` implementa la regla de dos términos `!twitter && !og`. **Estrechamiento CR-01:** sólo 7 propiedades de valor único (`ogDuplicates.ts:22-30`) — ver ítem 1 de verificación humana. |
| 4 | Advertencia cuando el charset no está declarado dentro del primer 1KB | ✓ VERIFIED | `charset.ts:42-47` mide sobre `Buffer` UTF-8, no sobre unidades de cadena. Probe ejecutado: sin charset → `false` (advierte); charset tras byte 1024 → `false` (advierte); charset real → `true`; forma `http-equiv` → `true`. Severidad tope `warning` (`charsetCheck` línea 29). Falsos negativos de borde documentados como WR-01. |
| 5 | Guardarraíl SOCIAL-09: cero colisión de fingerprint con ONPAGE-05, verificado con test explícito y no por construcción | ✓ VERIFIED | `social-guardrail.test.ts` — 6 casos que pasan. Fingerprint de referencia construido llamando a `pageFingerprint` real (`:132`), no a mano. Filas obtenidas vía `runAllChecks` (`:107`), no importando el barrel. Guarda anti-vacuidad en el primer caso (`:123`). Autoprueba de detección con datos sintéticos (`:169-185`). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/meta-social/package.json` | Paquete workspace, única dep runtime cheerio | ✓ VERIFIED | `dependencies: { cheerio: ^1.2.0 }` — frontera de aislamiento para Phase 32 intacta |
| `packages/meta-social/src/extract.ts` | `extractMetaSocial` + `firstValue`, unión property/name, acumulador `Map` | ✓ VERIFIED | 71 líneas. `Map` en `:32` (mitigación T-30-01). Unión de los dos atributos en `:44` (fix CR-02, commit 1eb2360). Orden de documento preservado. |
| `packages/meta-social/src/thresholds.ts` | Umbrales + `MAX_MEASURED_VALUE_CHARS` + `TWITTER_CARD_VALUES` | ✓ VERIFIED | 70 líneas, las 7 constantes presentes y exportadas por el barrel |
| `packages/meta-social/src/charset.ts` | `hasCharsetInFirstKB` + `CHARSET_WINDOW_BYTES` | ✓ VERIFIED | 48 líneas, medición por bytes, regex sobre ventana recortada (T-30-03) |
| `packages/checks/src/checks/social/ogTitle.ts` (SOCIAL-01) | Presencia + longitud | ✓ VERIFIED | 71 líneas, wired |
| `packages/checks/src/checks/social/ogDescription.ts` (SOCIAL-02) | Presencia + longitud | ✓ VERIFIED | 71 líneas, wired |
| `packages/checks/src/checks/social/ogImage.ts` (SOCIAL-03) | 5 ramas de formato | ✓ VERIFIED | 150 líneas, wired |
| `packages/checks/src/checks/social/ogUrl.ts` (SOCIAL-04) | Coherencia con canonical releída | ✓ VERIFIED | 119 líneas, sin import de `checks/tech`, wired |
| `packages/checks/src/checks/social/ogType.ts` (SOCIAL-05) | Sólo presencia | ✓ VERIFIED | 53 líneas, wired |
| `packages/checks/src/checks/social/ogDuplicates.ts` (SOCIAL-06) | Multi hallazgo con subtipo | ✓ VERIFIED | 107 líneas, wired |
| `packages/checks/src/checks/social/twitterCard.ts` (SOCIAL-07) | Card + fallback OG | ✓ VERIFIED | 130 líneas, wired |
| `packages/checks/src/checks/social/charset.ts` (SOCIAL-08) | Único check que lee `page.html` | ✓ VERIFIED | 55 líneas, wired |
| `packages/checks/src/checks/social/index.ts` | Barrel con las 8 entradas | ✓ VERIFIED | 8 entradas exactas en `socialPageChecks` |
| `social-guardrail.test.ts` / `social-calibration.test.ts` | SC#5 + banda de score medida | ✓ VERIFIED | 186 y 215 líneas, ambos verdes |
| `COVERAGE.md` | Declaración razonada de no integración externa | ✓ VERIFIED | Contiene `No external API integration:` |
| 6 fixtures de perfil de emisor | rankmath, shopify, webflow, next-metadata, no-og, yoast | ✓ VERIFIED | Presentes; sólo dominios `example.com` / `ejemplo.com` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `checks/social/index.ts` | `registry.ts` | spread `socialPageChecks` | ✓ WIRED | `registry.ts:17` import, `:25` spread — dos líneas exactas |
| `meta-social/src/extract.ts` | los 7 checks que leen tags | `firstValue` / `extractMetaSocial` | ✓ WIRED | Ningún check construye selector propio (grep de `cheerio.load` limpio) |
| `meta-social/src/thresholds.ts` | `ogTitle.ts`, `ogDescription.ts`, `twitterCard.ts` | import de constantes | ✓ WIRED | Cero redeclaración de umbrales en checks |
| `crawler/src/normalizeUrl.ts` | `ogUrl.ts`, `ogImage.ts` | `normalizeUrl` | ✓ WIRED | `ogUrl.ts:2,58,84`; misma normalización que `canonicalCheck` |
| `checks/src/util.ts` | los 8 checks | `pageFingerprint` | ✓ WIRED | Ningún template string manual |
| `packages/checks/package.json` | `packages/meta-social` | `workspace:*` | ✓ WIRED | Línea 19; typecheck del monorepo pasa |
| `scoring` | `social-calibration.test.ts` | `scoreCategory` | ✓ WIRED | Importado y ejercitado sobre 6 perfiles |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Los 8 `PageCheck` | `IssueDraft[]` | `runAllChecks` → `pageChecks` → `socialPageChecks` | Sí — `registry.test.ts` obtiene ≥1 fila de problema de cada uno de los 8 sobre HTML roto real | ✓ FLOWING |
| `extractMetaSocial` | `Map<string,string[]>` | recorrido de `$("meta")` del árbol ya cargado | Sí — calibración mide 6 perfiles con detección esperada fijada en tabla | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite de los dos paquetes de la fase | `pnpm --filter @auditor/checks --filter @auditor/meta-social test` | 39 archivos / 242 tests + 2 archivos / 20 tests, todos verdes | ✓ PASS |
| Typecheck de los dos paquetes | `pnpm --filter ... typecheck` | `tsc --noEmit` sin errores en ambos | ✓ PASS |
| Ventana de charset por bytes (SC#4) | probe efímero sobre `hasCharsetInFirstKB` | sin charset→false, tras 1KB→false, real→true, http-equiv→true | ✓ PASS |
| Falso negativo de charset (WR-01) | mismo probe | meta-description con `charset=`→true; comentario→true | ✗ FAIL (edge case, ver ítem humano 3) |
| ONPAGE-05 fuera del registry | `grep -rn "ONPAGE-05" packages/checks/src` | sólo en tests y comentarios; ningún módulo de check | ✓ PASS |
| Frontera de dependencias del motor puro | `cat packages/meta-social/package.json` | única dep de runtime: cheerio | ✓ PASS |
| Plan 06 no tocó producción | `git show --stat 66c339e 8038d06` | sólo archivos `.test.ts` y fixtures | ✓ PASS |

### Probe Execution

No hay probes convencionales (`scripts/*/tests/probe-*.sh`) declarados en los planes ni presentes en el repo para esta fase. La evidencia ejecutable equivalente es la suite de vitest más el probe efímero de charset, ambos ejecutados arriba en este proceso.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SOCIAL-01 | 30-01, 30-06 | og:title presente + 10-60 chars | ✓ SATISFIED | `ogTitle.ts` registrado y alcanzable vía `runAllChecks` |
| SOCIAL-02 | 30-02, 30-06 | og:description presente + 55-200 chars | ✓ SATISFIED | `ogDescription.ts`; bordes exactos probados |
| SOCIAL-03 | 30-03, 30-06 | og:image presente + absoluta HTTPS | ✓ SATISFIED | `ogImage.ts`, 5 ramas + precedencia de la primera etiqueta |
| SOCIAL-04 | 30-03, 30-06 | og:url presente + coherente con canonical | ✓ SATISFIED | `ogUrl.ts`, misma normalización que `canonicalCheck` |
| SOCIAL-05 | 30-02, 30-06 | og:type presente | ✓ SATISFIED | `ogType.ts`, sólo presencia |
| SOCIAL-06 | 30-04, 30-06 | Tags OG duplicados (mismo property, valores distintos) | ⚠️ SATISFIED (alcance estrechado) | `ogDuplicates.ts` limitado a 7 propiedades de valor único tras CR-01 |
| SOCIAL-07 | 30-04, 30-06 | twitter:card válido + regla anti-falso-positivo | ✓ SATISFIED | `twitterCard.ts:100`, condición de dos términos |
| SOCIAL-08 | 30-05, 30-06 | Charset dentro del primer 1KB | ✓ SATISFIED | `charset.ts`, medición por bytes |

**Sin requisitos huérfanos.** REQUIREMENTS.md mapea SOCIAL-01..08 a Phase 30 y SOCIAL-09 a Phase 29; los 8 IDs aparecen en el frontmatter de los planes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD`/`FIXME`/`XXX` en archivos de la fase | — | Ninguno. Grep limpio sobre `packages/checks/src/checks/social/` y `packages/meta-social/src/`. |
| — | — | `TODO`/`HACK`/`PLACEHOLDER` | — | Ninguno |
| — | — | Llamadas de red en los checks | — | Ninguna (prohibición honrada; validación por red es Phase 31) |
| — | — | Segundo parseo por página (ARCH-03) | — | Ninguno |
| `packages/meta-social/src/charset.ts` | 35 | Regex acepta `charset=` como texto libre y dentro de comentarios | ⚠️ Warning | Falso negativo en SOCIAL-08 (WR-01, reproducido) |
| `packages/cms-adapters/src/types.ts` | 42 | `ONPAGE-05` sigue en `SUPPORTED_CHECK_IDS`, sin SOCIAL-* | ⚠️ Warning | Pérdida de recomendaciones por CMS (WR-05) |
| `packages/checks/src/checks/social/ogUrl.ts` | 93 | `measuredValue` compuesto llega a ~173 chars | ℹ️ Info | Rompe el invariante declarado de cap único (WR-06) |

### Prohibitions (judgment tier — NO AUTORITATIVO)

Los 6 planes declaran **43 prohibiciones**, todas con `verification: judgment` y `status: unverified`. Verdicto de juez LLM, no autoritativo — **unverified-prohibition, human review recommended**:

Honradas según inspección de código (muestra representativa):
- Sin selector restringido a un solo vocabulario de atributo — `extract.ts:44` lee los dos como unión.
- Sin subtipo dentro de `checkId` — los 8 checks usan la constante limpia; el subtipo va sólo al `fingerprint`.
- Sin dependencia de runtime extra en `meta-social` — sólo cheerio.
- Sin segundo parseo ni llamadas de red en ningún check.
- Sin colapsar a la última etiqueta — `firstValue` devuelve `[0]`.
- Umbrales y `TWITTER_CARD_VALUES` sólo en el paquete puro.
- `og:type` sin lista cerrada.
- SOCIAL-08 nunca por encima de `warning`; ventana medida en bytes.
- Plan 06 no tocó código de producción; fixtures con dominios de ejemplo.
- Guardarraíl reconstruye el fingerprint llamando a la función real, sin mutar producción.

Ninguna prohibición se observó violada. Ninguna está confirmada por un test negativo dedicado, así que ninguna cuenta como verde certificado.

### Human Verification Required

#### 1. Alcance de SOCIAL-06 tras el fix CR-01

**Test:** Comparar `SINGLE_VALUED_OG_KEYS` (`packages/checks/src/checks/social/ogDuplicates.ts:22-30`) contra el Success Criterion #3 del ROADMAP y contra la regla lockeada en `30-CONTEXT.md` ("agrupar `meta[property]` por su valor de `property`; marcar issue sólo cuando un grupo tiene >1 tag Y sus `content` difieren").
**Expected:** Decidir si excluir `og:image`, `og:locale:alternate` y las familias `og:video*`/`og:audio*` es el alcance deseado. A favor del estrechamiento: el protocolo define esas propiedades como arrays y todo WordPress multilingüe emite una `og:locale:alternate` por idioma, así que marcarlas es un falso positivo sistemático en el universo objetivo, y una `og:image` repetida no rompe cómo se ve el sitio al compartirse — que es exactamente lo que el objetivo de fase acota. En contra: el criterio y la decisión de contexto están escritos sin esa excepción. Si se acepta, registrar un `overrides:` en este archivo.
**Why human:** Decisión de producto sobre alcance de requisito. El código está correcto, probado y documentado; lo que falta es la firma sobre el recorte.

#### 2. Regresión de recomendaciones por CMS (WR-05)

**Test:** Abrir `packages/cms-adapters/src/types.ts:38-48` y buscar entradas `SOCIAL-*`.
**Expected:** No hay ninguna, y `ONPAGE-05` sigue ocupando un slot del catálogo de "10 checks de mayor volumen" pese a estar retirado. `resolveCmsRecommendation` cae al texto genérico para SOCIAL-01..08, así que desde esta fase toda incidencia de Open Graph sobre WordPress/Shopify/Webflow/Wix/Squarespace pierde la instrucción específica de plataforma que tenía antes de v1.6. `coverage.test.ts` sigue en verde porque itera la tupla vieja. Ni Phase 31 ni Phase 32 lo reclaman en sus Success Criteria, así que **no es un gap diferido**: hay que planificarlo o aceptarlo.
**Why human:** Requiere decidir prioridad y fase de destino; la verificación sólo constata la regresión y que nadie la reclama.

#### 3. Falsos negativos de SOCIAL-08 (WR-01)

**Test:** Reproducido en esta verificación con un probe efímero sobre `hasCharsetInFirstKB`.
**Expected:** `<meta name="description" content="Como declarar charset=utf-8">` sin declaración real devuelve `true` (no advierte). `<!-- <meta charset="utf-8"> -->` también devuelve `true`. El comportamiento central sí es correcto: sin charset advierte, charset después del byte 1024 advierte, `http-equiv` se acepta. Decidir entre aplicar el fix de `30-REVIEW.md` (calificar el token como atributo y limpiar comentarios de la ventana, manteniendo la mitigación T-30-03) o aceptar el riesgo.
**Why human:** El header del archivo declara el primer caso como aproximación aceptada pero no menciona el del comentario, y la dirección del error es la que la auditoría no puede recuperar — el usuario nunca ve la fila.

### Gaps Summary

**No hay gaps que bloqueen el objetivo de fase.** Los cinco Success Criteria se cumplen con evidencia ejecutable, no por presencia de archivos:

- Los 8 checks existen, son sustantivos (53-150 líneas cada uno), están cableados por el barrel al `registry.ts` con dos líneas exactas, y `registry.test.ts` prueba que cada uno emite al menos una fila de problema por el camino de producción sobre HTML roto real.
- El motor puro conserva su frontera de aislamiento (única dependencia de runtime: cheerio), que es la precondición de Phase 32.
- El guardarraíl del SC#5 hace las tres cosas que el criterio exige y que los guardarrailes suelen omitir: reconstruye el fingerprint de referencia llamando a la función real en vez de escribir la cadena, obtiene las filas vía `runAllChecks` en vez de importar el barrel, y se autoprueba con datos sintéticos para no ser indistinguible de un detector roto. Además tiene guarda anti-vacuidad como primer caso.
- La banda de score está MEDIDA sobre 6 perfiles de emisor reales con la tabla de detección fijada en el test, no estimada.
- Los dos fixes críticos post-review (CR-01 y CR-02) están commiteados con tests de regresión propios.

Lo que queda abierto son tres decisiones, no tres defectos de implementación: un recorte de alcance deliberado en SOCIAL-06 que va más allá de la letra del criterio (y que probablemente sirve mejor al objetivo), una regresión de calidad de reporte heredada del retiro de ONPAGE-05 que ninguna fase posterior reclama, y dos falsos negativos de borde en el detector de charset. Los 6 warnings y 8 info de `30-REVIEW.md` siguen abiertos y documentados ahí.

---

_Verified: 2026-08-03T10:50:00Z_
_Verifier: Claude (gsd-verifier)_
