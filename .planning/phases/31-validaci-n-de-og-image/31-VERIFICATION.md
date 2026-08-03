---
phase: 31-validaci-n-de-og-image
verified: 2026-08-03T21:30:00Z
status: passed
score: 4/4 success criteria verified
behavior_unverified: 0
deferred_manual: 1
verified_by: executing agent (self-verification — ver "Limitación de esta verificación")
human_verification:
  - test: "Confirmar la regla de dos señales de IMG-02: una og:image servida con content-type genérico (application/octet-stream, binary/octet-stream o cabecera ausente) pero cuyos bytes SÍ parsean como imagen no se marca como error."
    expected: "El Success Criterion 2 dice literalmente 'marca como error las og:image con status 4xx/5xx o cuyo content-type no es una imagen'. La implementación exige las DOS condiciones a la vez (content-type no-imagen Y dimensiones ilegibles), así que es más angosta que la letra del criterio. La razón está documentada (Pitfall 6 / amenaza T-31-11): muchos CDN mal configurados sirven imágenes perfectamente válidas con tipo genérico, y marcarlas por la cabecera convertiría una mala configuración ajena en un defecto inventado del usuario. Confirmar que ese estrechamiento es lo deseado y registrarlo como override, o pedir el comportamiento literal."
    why_human: "Es una decisión de producto sobre falsos positivos, no un hecho verificable en el código. El código hace exactamente lo que dice hacer y está probado en las dos direcciones; lo que está en duda es cuál de los dos errores se prefiere pagar."
  - test: "Confirmar la banda de proporción aceptable: 1.7 a 2.1, en lugar de una tolerancia alrededor de 1.91."
    expected: "El requisito IMG-03 dice 'ratio lejos de 1.91:1' sin definir 'lejos'. La banda elegida acepta las tres proporciones que las plataformas recomiendan (1.9048, 1.9108, 1.9139) y también 16:9 (1.7778), que sirve de hecho una parte grande del universo de CMS; rechaza la cuadrada (1.0) y la de 4:3 (1.333). Si Juan prefiere otra banda son dos números en packages/meta-social/src/thresholds.ts:106 y :109."
    why_human: "Asunción de calibración marcada en 31-04-PLAN.md. No hay oráculo externo que defina 'lejos'; la elección correcta depende del universo real de sitios que audite la herramienta."
  - test: "Confirmar la base binaria de los umbrales de peso: 1 MiB = 1048576 y 5 MiB = 5242880."
    expected: "El requisito IMG-04 dice '1MB' y '5MB' sin especificar base. La diferencia frente a la interpretación decimal es de 4.9 por ciento en cada borde, así que sólo cambia el veredicto de imágenes que caen exactamente en esa franja. Si Juan prefiere base decimal son dos números en packages/meta-social/src/thresholds.ts:119 y :122."
    why_human: "Asunción de calibración marcada en 31-04-PLAN.md."
deferred_verification:
  - item: "Tasa real de filas og-image-undetermined contra una auditoría de un sitio real"
    why: "Es el respaldo empírico de la asunción sobre el tamaño de la ventana de lectura del sondeo (64 KiB, backstop A1). Ningún test puede medirla: depende de la distribución de formatos y de dónde cae el marcador de dimensiones en imágenes reales."
    declared_in: "31-VALIDATION.md — verificación manual declarada desde la planificación, no un descubrimiento de esta verificación"
    blocks_phase: false
---

# Phase 31: Validación de og:image — Verification Report

**Phase Goal:** El auditor verifica que la imagen social (og:image) de cada página sea alcanzable, tenga dimensiones adecuadas y no pese demasiado, sin sobrecargar el sitio auditado con requests repetidos.
**Verified:** 2026-08-03T21:30:00Z
**Status:** passed (con 3 confirmaciones de producto pendientes y 1 verificación manual diferida, ninguna bloqueante)
**Re-verification:** No — initial verification

## Limitación de esta verificación

Esta verificación la escribió el mismo agente que ejecutó las olas 3 y 4 de la fase. Se delegó primero a un `gsd-verifier` y a un `gsd-code-reviewer` en subagentes, y ninguno de los dos llegó a escribir su archivo a disco, así que el análisis se rehizo inline en lugar de dejar la fase sin cerrar.

Para acotar el sesgo, cada afirmación de abajo se apoya en una lectura directa del código de producción (no de los SUMMARY) y en la salida de comandos re-corridos en esta misma sesión. Aun así, una auto-verificación es estructuralmente más débil que una independiente: si algún criterio se quiere confirmar con ojos frescos, los tres candidatos son el estrechamiento de la regla de dos señales, la banda de proporción y el orden de las ramas terminales.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dedupe de URLs de og:image antes de verificarlas, con el mismo patrón dedupe+cap+concurrencia de `linkChecker.ts`/TECH-13 | ✓ VERIFIED | `ogImageNetwork.ts` construye un `Map` con clave `normalizeUrl(value, baseUrl)` y acumula las páginas afectadas en cada entrada. Cap: `entries = allEntries.slice(0, MAX_URLS_PER_NETWORK_CHECK)`, importado de `linkChecker.ts` (150), con fila informativa cuando recorta. Concurrencia: `probeImages` delega en `mapWithConcurrency(urls, DEFAULT_NETWORK_CONCURRENCY, probeImage)`, el mismo runner único que 31-03 dejó para toda la capa de red. La URL de la petición se calcula **sin** normalizar a propósito, porque la normalización reordena los parámetros de query e invalidaría las firmas de los CDN que firman por query; la normalizada sólo es clave de dedupe. Probado en aislamiento (`ogImageNetwork.test.ts#dedup: la misma og:image en tres páginas se sondea una sola vez`, que asserta sobre el argumento de la llamada de red y no sobre el número de filas) **y** por el camino de producción con la red activa (`registry.test.ts#emite filas de IMG-01 con categoría social y el pageId de la página, y dedupea la petición`). |
| 2 | Error ante status 4xx/5xx o content-type que no es imagen | ✓ VERIFIED (con estrechamiento documentado) | **4xx/5xx: verificado sin excepciones.** `imageProbe.ts:294` corta en `res.status >= 400` y `classifyImageProbe` enruta todo resultado de fallo no atribuible a nuestra propia defensa a la rama de inalcanzable con severidad `critical`. El carve-out anti falso positivo de TECH-12 (`isBlockedStatus`) **no** se trasladó: `grep -Eci 'isBlockedStatus\|blockedStatus'` sobre el check devuelve 0, y un test recorre 401, 402, 403, 405, 406, 429 y 999 afirmando `critical` y **cero** filas de no verificable. Es la letra de la decisión lockeada de `31-CONTEXT.md`. **Content-type: verificado con la regla de dos señales**, que es más angosta que la letra del criterio — ver ítem 1 de verificación humana. |
| 3 | Warning entre 200×200 y 600×315 o con ratio lejos de 1.91:1; error si menor a 200×200 | ✓ VERIFIED | Umbrales importados de `packages/meta-social/src/thresholds.ts`; `grep -v '^\s*[/*]' ogImageNetwork.ts \| grep -cE '^\s*const [A-Z_]+ *= *[0-9]'` devuelve 0, así que el check no redeclara ninguno. Bordes probados **en los dos lados**: 200×200 no es error y 199×200 / 200×199 sí; 600×315 no avisa y 599×315 / 600×314 sí. Ratio: la banda se declara con dos extremos explícitos y se compara con `<` / `>`, y el test afirma primero que `1700/1000 === OG_IMAGE_RATIO_MIN` y `2100/1000 === OG_IMAGE_RATIO_MAX` antes de ejercitar los cuatro bordes, lo que hace el borde verificable en vez de aproximado. La banda concreta es una asunción marcada — ver ítem 2 de verificación humana. |
| 4 | Error si pesa más de 5MB, warning entre 1MB y 5MB | ✓ VERIFIED | Las dos comparaciones van sobre el entero de bytes con estrictamente mayor que. Los cuatro bordes probados leyendo las constantes y no escribiendo el número a mano: exactamente 1 MiB no produce fila, un byte más produce advertencia, exactamente 5 MiB produce advertencia y un byte más produce error. El contrato de precisión tiene su propio caso: dos tamaños que se **muestran con la misma cifra redondeada** reciben veredictos distintos, lo que prueba que el redondeo de `toMib` es sólo presentación y no alimenta ningún umbral. Aguas arriba, `toByteCount` (`imageProbe.ts:123`) rechaza decimales, negativos y no finitos antes de que un valor de cabecera hostil llegue a la aritmética. La base binaria es una asunción marcada — ver ítem 3 de verificación humana. |

### Objetivo de fase, leído hacia atrás

El objetivo dice tres cosas y las tres se sostienen contra el código:

**"verifica que la imagen social sea alcanzable"** — sí, y por una sola petición: un `GET` con cabecera `Range` en vez del `HEAD` + `GET` que decía el contexto original. La desviación está documentada en el docblock de `imageProbe.ts` con la razón correcta: un `HEAD` no trae ninguna señal que el `GET` con rango no traiga ya, y el `GET` además trae los bytes que la lectura de dimensiones necesita. Emitir los dos duplicaría la carga sobre el sitio auditado, en contra del objetivo declarado de la fase.

**"tenga dimensiones adecuadas y no pese demasiado"** — sí, y sin pedir un solo byte extra: las cuatro señales (status, content-type, tamaño total y dimensiones) salen todas de la misma respuesta. `readDimensions` nunca reintenta con un rango mayor cuando falla; el resultado correcto de esa situación es declarar las dimensiones indeterminadas, con severidad informativa, porque que el fragmento no alcanzara para leer el marcador es una limitación de nuestro método de medición y no una falla del sitio auditado.

**"sin sobrecargar el sitio auditado con requests repetidos"** — sí, por tres mecanismos que se acumulan: dedupe por URL normalizada, cap a 150 imágenes únicas con aviso explícito cuando recorta, y concurrencia acotada por el runner compartido. Una imagen declarada en 500 páginas cuesta exactamente una petición.

## Requirements Coverage

| Requirement | Status | Dónde vive |
|---|---|---|
| IMG-01 — fetcher dedupeado por URL | ✓ Complete | `ogImageNetwork.ts` (recolección, dedupe, cap, fan-out), `imageProbe.ts` (transporte), `concurrency.ts` (runner compartido) |
| IMG-02 — alcanzable, content-type es imagen | ✓ Complete (con estrechamiento) | `classifyImageProbe`, ramas de no verificable, inalcanzable, formato vectorial y no es imagen |
| IMG-03 — dimensiones y proporción | ✓ Complete | `classifyImageProbe`, bloque de dimensión; umbrales en `thresholds.ts` |
| IMG-04 — peso | ✓ Complete | `classifyImageProbe`, bloque de peso; umbrales en `thresholds.ts` |

## Lo que la fase entregó por encima de lo pedido

Tres cosas que ningún Success Criterion pedía y que conviene registrar, porque son las que más valor de producto agregan:

1. **Defensa de destino (SSRF) con revalidación en cada salto de redirección.** La `og:image` es el primer punto del auditor donde el destino de una conexión lo elige un valor de meta tag del sitio auditado. `imageProbe.ts` usa `redirect: "manual"` y revalida cada salto, así que el bypass clásico —un dominio público que redirige al bucle local o a la dirección de metadata de la nube— no pasa. La defensa se heredó además a TECH-12 y TECH-13 en 31-03.
2. **Rama propia para el formato vectorial.** Una `og:image` en SVG tiene dimensiones perfectamente legibles, así que sin esta rama habría recibido un aprobado limpio mientras ninguna plataforma social genera la vista previa. Corta antes de evaluar dimensiones, con severidad de error.
3. **Rama de "no verificable" separada de "inalcanzable".** Un destino que rechazó nuestra propia defensa nunca llegó a hablar con el servidor: es ausencia de prueba, no prueba de defecto, y reportarlo como imagen rota sería inventar evidencia que el sondeo nunca obtuvo.

## Gate de cierre

| Comando | Resultado |
|---|---|
| `pnpm test` | 14 tareas, todas en verde |
| `pnpm typecheck` | 17 tareas, todas en verde |
| `pnpm assert:web-boundary` | PASS |
| `pnpm --filter @auditor/checks test` | 43 archivos, 325 casos (eran 297 al cerrar la ola 2) |

Árbol limpio: `git diff --stat packages/checks/src/checks/network packages/meta-social` devuelve vacío tras las dos pruebas de dientes de 31-05.

## Guardarrailes demostrados, no asumidos

Es la parte que distingue esta fase de una que sólo dice tener cobertura. Los dos guardarrailes de integración que 31-05 agregó se **vieron en rojo** con una mutación deliberada cada uno, aplicadas de a una y revertidas por completo:

- Quitar la entrada del check del array del barrel de la carpeta de red pone `registry.test.ts` en rojo por dos casos. Sin ese guardarraíl, un check registrado a medias en un merge no corre en producción y nadie se entera.
- Quitar el subtipo de la composición del fingerprint pone el guardarraíl social en rojo por el caso de repetidos y por el del diff. El `expected 9 to be 10` es literalmente la colisión: diez filas sociales entran al diff y salen nueve.

La transcripción completa de los dos fallos está en `31-05-SUMMARY.md`.

## Deuda conocida, registrada y no bloqueante

1. **T-31-02** — la defensa de destino de TECH-12 y TECH-13 cubre el destino inicial pero no cada salto. Documentada en el docblock de `linkChecker.ts`. El camino que esta fase introduce sí está cerrado por completo.
2. **TOCTOU del resolutor** (M1 de `31-REVIEW.md`) — riesgo residual aceptado a este nivel de aseguramiento y documentado en el docblock de `ssrfGuard.ts`.
3. **`brokenResources.ts` sin archivo de test propio** — aceptado como juicio humano en 31-03, no reabierto.
4. **`IMG-01` cae al texto genérico del catálogo de recomendaciones por CMS**, igual que los ocho identificadores de la fase 30. Decisión explícita, fuera de alcance.
5. **Backstop A1** — la tasa de dimensiones indeterminadas queda sin medir hasta correr una auditoría real. Declarada como verificación manual desde `31-VALIDATION.md`.

Ninguna de las cinco toca un Success Criterion de esta fase.

## Verdict

**PASSED.** Los cuatro Success Criteria están verificados contra el código, no contra los SUMMARY, y cada uno con evidencia ejecutable. Los seis bordes numéricos están probados en los dos lados. El code review no encontró hallazgos Critical ni High.

Quedan tres confirmaciones de producto para Juan (el estrechamiento de la regla de dos señales y las dos asunciones de calibración) y una verificación manual diferida contra una auditoría real. Ninguna de las cuatro bloquea el cierre de la fase ni el arranque de Phase 32: las tres primeras son números en un solo archivo y la cuarta es una medición empírica que sólo el uso real puede dar.

**Phase 32 puede arrancar.** Recibe un contrato estable: nueve umbrales en `packages/meta-social/src/thresholds.ts` y nueve subtipos de ámbito de `IMG-01`, con la no colisión probada contra el mecanismo que de verdad los consume.
