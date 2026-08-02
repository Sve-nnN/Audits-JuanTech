---
phase: 30
slug: checks-de-meta-tags-social
type: outline
plans: 6
tracer_mode: true
mvp_mode: false
granularity: standard
security_asvs_level: 1
security_block_on: high
created: 2026-08-02
---

# Phase 30 — Plan Outline

> Outline-only. Cada fila se expande después a `30-NN-PLAN.md` en una corrida propia.
> Fuente de verdad de decisiones: `30-CONTEXT.md`. Verificación técnica: `30-RESEARCH.md`.
> Analogs y excerpts de código: `30-PATTERNS.md`. Contrato de tests: `30-VALIDATION.md`.

| Plan ID | Objective | Wave | Depends On | Requirements |
|---|---|---|---|---|
| 30-01 | **TRACER** — Slice end-to-end de una sola etiqueta: crear `packages/meta-social` (paquete puro, espejo de `packages/fingerprint`), el extractor unificado `property \|\| name`, el check `SOCIAL-01` (og:title presencia + 10-60 chars), el barrel `socialPageChecks` y el cableado a `registry.ts`. Se verifica corriendo `pageChecks` del registry real sobre HTML fixture y assertando un `IssueDraft` con `category: "social"` y fingerprint de `pageFingerprint`. | 1 | — | SOCIAL-01 |
| 30-02 | Expansión: checks de texto sobre el extractor ya probado — `SOCIAL-02` (og:description, 55-200 chars) y `SOCIAL-05` (og:type, sólo presencia). | 2 | 30-01 | SOCIAL-02, SOCIAL-05 |
| 30-03 | Expansión: checks de URL — `SOCIAL-03` (og:image absoluta HTTPS; relativa / protocol-relative / `http:` en sitio `https`) y `SOCIAL-04` (og:url coherente con canonical), ambos vía `normalizeUrl` de `@auditor/crawler` desde `packages/checks` (nunca desde `meta-social`). | 3 | 30-01 | SOCIAL-03, SOCIAL-04 |
| 30-04 | Expansión: checks multi-hallazgo — `SOCIAL-06` (duplicados OG con valores distintos) y `SOCIAL-07` (twitter:card presente + valor válido, con la regla anti-falso-positivo de fallback a OG). | 4 | 30-01 | SOCIAL-06, SOCIAL-07 |
| 30-05 | Expansión: `SOCIAL-08` — `hasCharsetInFirstKB(html)` en `meta-social` (ventana de 1024 bytes reales vía `Buffer`) + el `PageCheck` que lo consume leyendo `page.html` crudo, con la limitación de charset-por-header declarada en el `criterion`. | 5 | 30-01 | SOCIAL-08 |
| 30-06 | Cierre: guardarraíl de Success Criterion #5 (cero colisión de fingerprint con el retirado `ONPAGE-05`, con autoprueba de detección), ampliación de `registry.test.ts` con los 8 `SOCIAL-*`, y calibración de la banda de score de la categoría `social` contra 5 fixtures de perfil (Yoast, RankMath, Shopify, Webflow, Next Metadata, sitio sin OG). | 6 | 30-02, 30-03, 30-04, 30-05 | SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07, SOCIAL-08 |

**Por qué las olas son secuenciales:** `packages/checks/src/checks/social/index.ts` (el barrel `socialPageChecks`) es un archivo compartido por 30-01..30-05 — cada plan agrega su import + su entrada al array. Solapamiento de `files_modified` fuerza olas distintas. Coincide además con la convención del proyecto registrada en STATE.md ("executor(es) secuenciales en main tree").

---

## Notes per plan

### 30-01 — Tracer: paquete puro + extractor + SOCIAL-01 + cableado

- **Crea:** `packages/meta-social/package.json`, `packages/meta-social/tsconfig.json`, `src/types.ts`, `src/extract.ts`, `src/thresholds.ts`, `src/index.ts`, `src/extract.test.ts`, `src/__fixtures__/` (mínimo: Yoast + el caso `property`/`name` contradictorio); `packages/checks/src/checks/social/ogTitle.ts`, `social/index.ts`, `social/ogTitle.test.ts`, `social/pipeline.test.ts`. **Modifica:** `packages/checks/src/registry.ts` (un import + un spread), `packages/checks/src/index.ts` (`export * from "./checks/social"`), `packages/checks/package.json` (`"@auditor/meta-social": "workspace:*"`) + `pnpm install` en la raíz.
- **Constraint de CONTEXT.md (arquitectura, no negociable):** `packages/meta-social` es motor puro — `extractMetaSocial($, html): MetaSocialData`, sin conocer `Issue`/`PageCheck`, **sin más dependencia de runtime que Cheerio**. `normalizeUrl` de `@auditor/crawler` NO puede entrar al paquete. Espejo verbatim de `packages/fingerprint/package.json` + `tsconfig.json` (sin script `build`, sin `vitest.config.ts`, `types: ["node"]` para habilitar `Buffer`).
- **`checkpoint:decision` obligatorio ANTES de escribir `ogTitle.ts` — reversibility `one-way`:** CONTEXT.md dice "mantener consistencia con el formato `SOCIAL-01:og-title`" (D-1 de RESEARCH). Ningún check de producción pone `:` en `checkId`; el subtipo va sólo en el fingerprint (`headings.ts`, `canonicalDeep.ts`). Un `checkId` con subtipo rompe el lookup exact-match de `resolveCmsRecommendation` y fragmenta `groupIssuesByType`. Es one-way porque el `checkId` y el fingerprint quedan persistidos en filas `Issue` y gobiernan el diff histórico. Opciones a presentar: (a) `checkId` plano `SOCIAL-01`..`SOCIAL-08` + subtipo sólo en `pageFingerprint(\`${CHECK_ID}:${subtype}\`, url)` [recomendada]; (b) literal de CONTEXT.md.
- **Decisiones a registrar en el plan (discreción de Claude según CONTEXT.md):** los 8 checks emiten fila `ok` explícita (mayoría del catálogo: `title`/`metaDescription`/`canonical`/`htmlSize`); severidad `critical` sólo para ausencia de `og:title`/`og:image` y para `og:image` relativa/insegura, `warning` para todo lo demás; `Page.socialMeta` **NO** se persiste en esta fase (sin columnas nuevas → el schema-gate de Prisma no dispara), pero `MetaSocialData` se diseña serializable a JSON plano para que Phase 32 sólo agregue la columna.
- **`<assumption_delta_decision>` (advisory, `pluralization`):** la clave de identidad de un meta tag pasa de `property` (singular) a la clave normalizada `property || name` en minúsculas + trim. Decisión: **promote** — la clave normalizada es el sustantivo primario; `property` queda como una variante de emisor. Todos los checks leen del extractor; ninguno hace su propio `$('meta[...]')`.
- **Seguridad / `<threat_model>` (ASVS 1, block_on high):** `T-30-01` Tampering — prototype pollution vía clave controlada por el sitio (`<meta property="__proto__">`) → mitigar con `Map<string,string[]>`, nunca objeto literal. `T-30-SC` supply chain → sin paquetes externos nuevos; la tabla `## Package Legitimacy Audit` de `30-RESEARCH.md` ya cubre `cheerio`/`vitest`/`typescript`/`@types/node` como aprobados, sin `[ASSUMED]`/`[SUS]`/`[SLOP]`.
- **Artefacto de gate:** escribir `.planning/phases/30-checks-de-meta-tags-social/COVERAGE.md` con la declaración `No external API integration: la fase corre 100% offline sobre HTML ya crawleado; ninguna llamada de red (og:image se valida en Phase 31).`
- **Verify del tracer (end-to-end, no unit por capa):** `pnpm install && pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test`; `pipeline.test.ts` importa `pageChecks` desde `../../registry`, corre sobre `makePage({ url, html })` y asserta que sale un draft con `checkId: "SOCIAL-01"`, `category: "social"` y `fingerprint === pageFingerprint("SOCIAL-01", url)`.
- **Anti-patterns a nombrar en el `<action>`:** `$("meta[property]")` a secas (era el defecto de ONPAGE-05); colapsar `og:image` múltiple quedándose con el último (ogp.me: gana la primera); comparar claves sin bajar a minúsculas; re-parsear `page.html` con `cheerio.load` dentro de un check (viola ARCH-03).

### 30-02 — SOCIAL-02 (og:description) + SOCIAL-05 (og:type)

- **Crea:** `packages/checks/src/checks/social/ogDescription.ts`, `ogType.ts`, `ogDescription.test.ts`, `ogType.test.ts`. **Modifica:** `packages/checks/src/checks/social/index.ts` (2 imports + 2 entradas), `packages/meta-social/src/thresholds.ts` (`OG_DESC_MIN = 55`, `OG_DESC_MAX = 200`).
- **Constraint de CONTEXT.md:** umbrales 55-200 para og:description (deliberadamente distintos de ONPAGE-02, que usa 70-160). **SOCIAL-05 sólo verifica presencia** — prohibido validar el valor contra una lista cerrada (`website`/`article`/…): está en `## Deferred Ideas`.
- **Constraint de patrón:** un archivo = un check (molde `onpage/title.ts`): rama de ausencia → rama de longitud con `tooShort` ternario → rama `ok` explícita (`severity: "ok"`, `recommendation: "Sin acción necesaria."` literal). Los umbrales viven en `@auditor/meta-social`, no se redeclaran en el check (Phase 32 los reusa).
- **Constraint de copy (discreción acotada):** `title`/`criterion`/`recommendation` en español neutro, imperativo impersonal sin voceo ("Agrega", "Acorta"), sin em dashes. Referencias de tono: `onpage/title.ts`, `onpage/contentLength.ts`.
- **Lectura de datos:** `firstValue(data, "og:description")` / `firstValue(data, "og:type")` sobre el resultado de `extractMetaSocial`, nunca un selector propio. Etiqueta presente con `content` vacío = fallo, no `ok` (el extractor ya descarta contenido vacío).

### 30-03 — SOCIAL-03 (og:image) + SOCIAL-04 (og:url vs canonical)

- **Crea:** `packages/checks/src/checks/social/ogImage.ts`, `ogUrl.ts`, `ogImage.test.ts`, `ogUrl.test.ts`. **Modifica:** `packages/checks/src/checks/social/index.ts`.
- **Constraint de CONTEXT.md (SOCIAL-04):** relee el canonical directo del `$` ya cargado (`$('link[rel="canonical"]').attr('href')`), **sin depender del resultado de `TECH-04`/`canonicalCheck`** — los `PageCheck` no comparten estado (`PageCheckCtx` sólo da `page` + `$`). Fallback a `page.finalUrl ?? page.url` si no hay canonical explícito, mismo patrón que `canonical.ts:11,48,66-69`.
- **Constraint de arquitectura:** `normalizeUrl` se importa desde `@auditor/crawler` **dentro de `packages/checks`**, jamás dentro de `packages/meta-social`. Comparación `normalizeUrl(ogUrlRaw, url)` vs `normalizeUrl(canonicalHref ?? url, url)` con fallback `?? raw` — mismo criterio que `canonicalCheck`, para no emitir dos veredictos contradictorios sobre la misma página.
- **SOCIAL-03, detección de relativa (Pitfall 6, "hallazgo de mayor valor del milestone"):** comparar el valor **crudo** contra el **resuelto**; cubrir protocol-relative (`//host/x.png`, por prefijo de string), relativa (`!raw.startsWith("http")`) e insegura (`resolved.startsWith("http://")`). `normalizeUrl` devuelve `null` para esquemas no-http(s) → `og:url="javascript:…"` cae en rama de valor inválido, no en la de coherencia.
- **`<threat_model>` adicional:** `T-30-02` Information disclosure / XSS diferido — esquema peligroso (`javascript:`, `data:`, `file:`) en `og:url`/`og:image` persistido en `measuredValue` → mitigar con `normalizeUrl` (ya devuelve `null`); anotar que Phase 32 debe re-validar antes de renderizarlo como `href`/`src`. **Prohibido en esta fase: cualquier fetch de la URL de la imagen** (es Phase 31, IMG-01..04).
- **Tests obligatorios (VALIDATION.md):** og:image ausente / relativa / protocol-relative / `http:` en sitio `https` / absoluta OK; og:url ausente / difiere de canonical / coherente.

### 30-04 — SOCIAL-06 (duplicados OG) + SOCIAL-07 (twitter:card)

- **Crea:** `packages/checks/src/checks/social/ogDuplicates.ts`, `twitterCard.ts`, `ogDuplicates.test.ts`, `twitterCard.test.ts`. **Modifica:** `packages/checks/src/checks/social/index.ts`, `packages/meta-social/src/thresholds.ts` (`TWITTER_CARD_VALUES = ["summary","summary_large_image","app","player"]`).
- **Constraint de CONTEXT.md (SOCIAL-06), regla de negocio intacta + corrección D-2:** issue **sólo** cuando un grupo tiene `values.length > 1` **Y** `new Set(values).size > 1`. Duplicados con el mismo valor exacto NO se marcan. La agrupación se hace sobre `MetaSocialData.tags` (clave normalizada `property || name`), **no** sobre un `$('meta[property]')` propio — si no, el caso más interesante (`property="og:title"` + `name="og:title"` con contenidos contradictorios) queda invisible. Alcance limitado a `og:*`; `twitter:*` duplicado queda fuera de v1.6.
- **Constraint de CONTEXT.md (SOCIAL-07), regla anti-falso-positivo:** mapeo `twitter:title`↔`og:title`, `twitter:description`↔`og:description`, `twitter:image`↔`og:image`. `twitter:card` se evalúa **siempre** (no tiene equivalente OG). Los tres campos secundarios se marcan **sólo cuando faltan el `twitter:*` Y su equivalente `og:*`** — si el OG existe, la ausencia del `twitter:*` no se penaliza (X hace fallback a OG). Está explícito en REQUIREMENTS.md Out of Scope.
- **Patrón multi-hallazgo:** helper `push(subtype, …)` de `onpage/headings.ts:47-63` — `checkId` plano en el draft, subtipo **sólo** en `pageFingerprint(\`${CHECK_ID}:${subtype}\`, url)`. Early return `return []` cuando no aplica (`headings.ts:45`). Alias `const fp = (subtype) => …` de `canonicalDeep.ts:68`.
- **Assumption marcada:** los valores legacy de `twitter:card` (`photo`/`gallery`/`product`) se tratan como inválidos — es [ASSUMED] en `30-RESEARCH.md` (A1). Impacto bajo (falso positivo raro, recomendación igual correcta); registrarlo como asunción flagged, no como hecho verificado.

### 30-05 — SOCIAL-08 (charset dentro del primer 1KB)

- **Crea:** `packages/meta-social/src/charset.ts`, `src/charset.test.ts`, `packages/checks/src/checks/social/charset.ts`, `social/charset.test.ts`. **Modifica:** `packages/meta-social/src/index.ts` (exportar `hasCharsetInFirstKB` + `CHARSET_WINDOW_BYTES`), `packages/checks/src/checks/social/index.ts`.
- **Constraint de CONTEXT.md:** medir sobre el HTML **crudo** (`page.html`, no sobre `$` ya parseado, que pierde posición), buscando `<meta charset` o `<meta http-equiv="Content-Type" … charset=` dentro de los primeros **1024 bytes REALES** — `Buffer.from(html,"utf8").subarray(0,1024).toString("utf8")`, nunca `.slice(0,1024)` por caracteres (mismo rigor que Phase 28 aplicó a `htmlBytes`). Mecánica verbatim de `packages/fingerprint/src/detectStack.ts:37-41`.
- **Resolución D-3 (severidad + limitación declarada):** severidad `warning`, nunca `critical`, y el `criterion` declara textualmente que se evalúa la declaración en el HTML y que un `charset` enviado sólo por header HTTP no es visible para esta auditoría. Motivo: un sitio con `Content-Type: text/html; charset=utf-8` y sin `<meta charset>` está correcto según el HTML Standard y pasa Lighthouse, pero hoy el dato no es observable (`content-type` no está en `CURATED_HEADER_KEYS`; `Page.contentType` guarda el MIME sin el parámetro). **No ampliar el alcance a `packages/crawler` en esta fase.**
- **`<threat_model>`:** `T-30-03` DoS — ReDoS del regex de charset sobre HTML minificado sin saltos de línea → mitigar aplicando el regex **después** de recortar a la ventana de 1024 bytes y usando `[^>]+` en lugar de `.*`, sin cuantificadores anidados.
- **Limitación a documentar en el docblock del módulo (Pitfall 7):** `page.html` ya viene decodificado por Crawlee, así que re-encodear a UTF-8 reproduce los bytes originales sólo si el documento se sirvió en UTF-8. El sesgo es conservador (falsos positivos posibles, falsos negativos no). No leer `$` en este check; leer `page.html` como string para medir bytes **no** es un re-parseo y no viola ARCH-03.
- **Tests:** charset en byte ~100 (ok) / después del byte 1024 (issue) / ausente (issue) / multibyte antes de la declaración que empuja el corte. El helper `run()` del test debe usar `makePage({ url, html })` porque el check lee `page.html`.

### 30-06 — Guardarraíl SC#5 + registry + calibración de score

- **Crea:** `packages/checks/src/checks/social/social-guardrail.test.ts`, y los fixtures de perfil faltantes en `packages/meta-social/src/__fixtures__/` (RankMath, Shopify, Webflow, Next.js Metadata API, sitio sin OG). **Modifica:** `packages/checks/src/registry.test.ts`.
- **Success Criterion #5 (ROADMAP, deferral W-06 de Phase 29) — probarlo, no asumirlo:** sobre una página con las 4 etiquetas OG básicas, ningún fingerprint de los 8 checks colisiona con `pageFingerprint("ONPAGE-05", TEST_URL)`. `ONPAGE-05` fue borrado con `git rm`, así que **no se puede importar**: se reconstruye con la función **real** `pageFingerprint`, nunca con el template string a mano (si el formato cambia, el test debe romperse). Patrón: `perf/checkIdCollision.test.ts:101-124` + `phase11-guardrail.test.ts:23-59`.
- **Cuatro aserciones del guardarraíl:** (a) ningún fingerprint social iguala el de `ONPAGE-05`; (b) los 8 checks no colisionan entre sí sobre la misma página (`new Set(fps).size === fps.length`); (c) no-colapso real vía `diffIssues(combined, [])` con `statusByFingerprint.size === combined.length` y todos en `"new"`; (d) autoprueba de capacidad de detección inyectando un fingerprint duplicado **sintético dentro del test** — nunca mutando código de producción (decisión ya registrada en STATE.md/Phase 28).
- **`registry.test.ts`:** agregar `SOCIAL_CHECK_IDS = ["SOCIAL-01"…"SOCIAL-08"]` con el mismo loop `for (const id of …) expect(registered).toContain(id)` de las líneas 58-63; conservar intactos los tests existentes de "sin checkIds duplicados" y "ya no incluye `ONPAGE-05`". `checkIdCollision.test.ts` (contra el catálogo de `@auditor/psi`) pasa automáticamente al estar los 8 registrados — no tocarlo.
- **Calibración de banda (Pitfall 5 / asunción A3, MEDIUM confidence):** correr los 8 checks contra los 5-6 fixtures de perfil y verificar que `scoreCategory("social")` de un sitio promedio cae en la banda 60-80, no en 95+. Si algún check pasa en >95% de todos los perfiles, convertirlo a "sólo filas de problema" (quitarle la fila `ok`). Es la única verificación manual declarada de la fase (`30-VALIDATION.md` § Manual-Only) — el resto es automatizado.
- **Gate de cierre de fase:** `pnpm typecheck && pnpm test` en verde (baseline `@auditor/checks` medida el 2026-08-01: 28 archivos / 152 tests / 2.12s — debe quedar igual o mayor, siempre verde) más `pnpm assert:web-boundary`, que prueba que el paquete nuevo no ensució el grafo de Vercel.

---

## Aplica a los 6 planes (no repetir la decisión, sí repetir el bloque)

- **Probe de edge cases sin resolver (specless fallback):** las 8 filas `SOCIAL-01..08` del probe determinista salieron `unclassified` → quedan `unresolved`. Cada plan debe surfacearlas como **asunción del planner flagged** para los requirements que cubre; nunca auto-`backstop`, nunca auto-dismiss, nunca drop silencioso. Las prohibiciones del recall pass §B van en `must_haves.prohibitions:` (hermano de `truths`), autoradas **descriptor-less**.
- **Sección obligatoria "Artifacts this phase produces":** listar los símbolos nuevos del plan — `extractMetaSocial`, `firstValue`, `hasCharsetInFirstKB`, `MetaSocialData`, `CHARSET_WINDOW_BYTES`, `OG_TITLE_MIN/MAX`, `OG_DESC_MIN/MAX`, `TWITTER_CARD_VALUES`, `socialPageChecks`, los 8 exports `ogTitleCheck`…`charsetCheck`, los checkIds `SOCIAL-01..08` y el paquete `@auditor/meta-social`.
- **`<read_first>` mínimo por tarea:** el archivo que se modifica + el analog nombrado en `30-PATTERNS.md` + `packages/checks/src/types.ts` y `util.ts` cuando la tarea produce `IssueDraft`.
- **Sampling de tests (`30-VALIDATION.md`):** por commit de tarea `pnpm --filter @auditor/meta-social test && pnpm --filter @auditor/checks test`; por ola `pnpm typecheck && pnpm test`. Siempre `vitest run`, nunca watch. Latencia objetivo < 10s.
- **Fuera de alcance en toda la fase:** UI/panel (Phase 32), fetch de `og:image` (Phase 31), columna `Page.socialMeta` (Phase 32), cambios en `apps/worker`, `packages/scoring`, `packages/report-model` o `packages/crawler`. Cualquier plan que toque `registry.ts` más allá de un import y un spread se salió del carril.
