# Phase 31 — Code Review

**Alcance:** los archivos que la fase creó o modificó, commits `c587ce0..HEAD`.

- `packages/checks/src/checks/network/ogImageNetwork.ts` y su test
- `packages/checks/src/checks/network/imageProbe.ts`
- `packages/checks/src/checks/network/ssrfGuard.ts`
- `packages/checks/src/checks/network/linkChecker.ts`, `concurrency.ts`
- `packages/meta-social/src/thresholds.ts`, `index.ts`
- `packages/checks/src/registry.test.ts`, `packages/checks/src/checks/social/social-guardrail.test.ts`

**Estado del gate:** `pnpm test` (14 tareas), `pnpm typecheck` (17 tareas) y `pnpm assert:web-boundary` los tres en verde. `@auditor/checks`: 43 archivos, 325 casos.

## Resumen

| Severidad | Cantidad | Bloqueantes |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 2 | 0 |
| Low | 4 | 0 |

**Ninguno de los seis hallazgos bloquea el cierre de la fase.** Los dos Medium son riesgos residuales ya documentados en el código o fuera del alcance declarado; los cuatro Low son endurecimiento incremental.

## Lo que se revisó con foco y salió limpio

**Defensa de destino en cada salto de redirección.** Era el riesgo principal de la fase y está cerrado en el camino nuevo. `imageProbe.ts:235` valida la URL inicial antes de abrir nada, y `imageProbe.ts:285` revalida **cada** destino de redirección antes de seguirlo, con `redirect: "manual"` (`imageProbe.ts:216`). El bypass clásico —un dominio público que redirige a `127.0.0.1` o a `169.254.169.254`— no pasa.

**Clasificación numérica de direcciones, no de nombres.** `ssrfGuard.ts` resuelve el nombre pidiendo **todas** las direcciones (`{ all: true }`, línea 150) y rechaza si **alguna** es privada (línea 156). Cubre v4 privadas, loopback, link-local/metadata, CGNAT, y en v6 cubre `::`, `::1`, `fc00::/7`, `fe80::/10` y —lo importante— desenvuelve las IPv4 mapeadas `::ffff:a.b.c.d` para evaluarlas con la tabla de v4 (líneas 97-101). Verifiqué a mano la expansión de `::ffff:127.0.0.1` y clasifica privada correctamente. Todo lo no reconocido se clasifica como privado (`ssrfGuard.ts:123`): falla cerrado, que es la decisión correcta.

**Lectura acotada de bytes con cancelación garantizada.** `readUpTo` (`imageProbe.ts:84`) cuenta bytes acumulados y no confía en que el servidor haya honrado el `Range`, que es lo correcto porque RFC 7233 permite ignorarlo. El `reader.cancel()` está en un `finally` (línea 102), así que la conexión se cierra también cuando el servidor todavía tenía megabytes por mandar. Sin ese cancel el tope no protegería nada.

**El timer de aborto cubre también la lectura del cuerpo.** `requestOnce` (`imageProbe.ts:206`) hace el `readUpTo` **dentro** del bloque que posee el timer, y lo limpia en `finally`. Un servidor que gotea bytes indefinidamente queda acotado por los 5 s, no sólo por el tope de bytes.

**Contrato de precisión de IMG-04.** Verificado: las dos comparaciones de peso van sobre el entero de bytes con estrictamente mayor que (`ogImageNetwork.ts`, bloque de peso), y `toMib` es sólo presentación — ninguna comparación lee su salida. `toByteCount` (`imageProbe.ts:123`) rechaza decimales, negativos y no finitos antes de que lleguen a la aritmética de umbrales. `deriveTotalBytes` distingue correctamente el `content-length` de un `206` (que describe el fragmento) del total del lado derecho del `content-range`, y devuelve `null` ante `*`.

**Aritmética de coma flotante del ratio.** La banda se declara con dos extremos explícitos y se compara con `<` / `>`, así que los extremos exactos pasan. El test afirma primero que `1700/1000` es exactamente `OG_IMAGE_RATIO_MIN` y `2100/1000` exactamente `OG_IMAGE_RATIO_MAX`, lo que hace el borde verificable en vez de aproximado. Correcto.

**Orden de ramas de clasificación.** La rama de no verificable va antes que la de inalcanzable y no mira el status, lo que es necesario: sus dos casos llegan con status nulo y puestos después caerían en inalcanzable. Las tres terminales cortan antes de evaluar dimensiones. Verificado contra los tests, no sólo por lectura.

**Colisiones de fingerprint.** Probadas contra el mecanismo que de verdad las consume (`diffIssues`), incluido el caso de dos ramas sobre la misma página. La prueba de dientes documentada en `31-05-SUMMARY.md` confirma que el guardarraíl se pone en rojo cuando el subtipo se cae.

**Tests que podrían pasar por vacuidad.** Revisé los dos guardarrailes: los dos abren con una guarda anti vacuidad explícita como primer caso, y los dos se demostraron en rojo por mutación. `registry.test.ts` corre en 0.68 s, incompatible con conexiones reales.

## Hallazgos

### M1 — TOCTOU entre la resolución del nombre y la apertura de la conexión (Medium, no bloqueante)

`ssrfGuard.ts:131-159` resuelve el nombre y clasifica las direcciones, pero `fetch` vuelve a resolver por su cuenta al conectar. Un nombre rebindeado entre los dos momentos (DNS rebinding) no queda cubierto: la validación aprueba la dirección pública y la conexión termina abriéndose contra la privada.

**Ya está documentado como riesgo residual aceptado** en el docblock del archivo (`ssrfGuard.ts:15-19`), con la razón correcta: cerrarlo exige un agente de transporte propio que fije la dirección resuelta. No es un descuido.

**Recomendación:** dejarlo como está en esta fase. Si en algún momento el nivel de aseguramiento sube, la forma de cerrarlo es un `dispatcher` de undici con `lookup` propio que devuelva la dirección ya validada, de modo que la resolución de la validación y la de la conexión sean literalmente la misma.

### M2 — La defensa de TECH-12 y TECH-13 no cubre los saltos de redirección (Medium, no bloqueante, fuera de alcance)

`linkChecker.ts` valida el destino inicial pero conserva el modo de redirección automático, así que los dos checks que lo consumen quedan cubiertos sólo en el primer salto. Es la deuda **T-31-02**, registrada explícitamente en el docblock del archivo por 31-03 y repetida en el SUMMARY.

Vale aclarar el impacto real, porque es menor de lo que suena: en TECH-12 y TECH-13 el destino sale de un `href` o un `src` del HTML, no de un valor que el atacante elija con precisión para esta ruta, y el camino donde el destino sí lo elige un valor de meta tag —el sondeo de imagen— **sí** tiene el bucle manual y está cerrado.

**Recomendación:** cerrarlo en la primera fase que toque la capa de red, reusando el bucle de `imageProbe.ts`, que ya es el patrón de la casa. No justifica una fase propia.

### L1 — `readUpTo` puede sobrepasar el tope por un chunk (Low)

`imageProbe.ts:91` usa `while (total < maxBytes)`, así que el último chunk leído puede empujar `total` por encima de `maxBytes`. Después se asigna `new Uint8Array(total)` (línea 105) y recién ahí se recorta con `subarray`. El `subarray` devuelve una vista: el buffer subyacente del tamaño mayor sigue vivo mientras la vista lo esté.

En la práctica el exceso está acotado por el tamaño de un chunk del stream (típicamente decenas de KiB), así que el consumo real es del orden de 128 KiB por sondeo en el peor caso, no ilimitado. No es una vulnerabilidad.

**Recomendación:** recortar el chunk antes de acumular (`value.subarray(0, maxBytes - total)`) y salir del bucle, o copiar en vez de `subarray` al final. Cambio de tres líneas, sin efecto observable en el veredicto.

### L2 — La tabla de v4 no cubre multicast ni el rango reservado (Low)

`ssrfGuard.ts:30-40` no clasifica `224.0.0.0/4` (multicast), `240.0.0.0/4` (reservado) ni `255.255.255.255` (broadcast). No son destinos SSRF clásicos y un `fetch` contra ellos no llega a ningún lado útil, pero la tabla se lee como exhaustiva y no lo es.

**Recomendación:** agregar `a >= 224` a `isPrivateV4Octets`. Una línea, y hace que la tabla cumpla lo que su nombre promete.

### L3 — v6 no desenvuelve NAT64 ni 6to4 (Low)

`isPrivateV6` desenvuelve `::ffff:a.b.c.d`, que es el disfraz común, pero no `64:ff9b::/96` (NAT64) ni `2002::/16` (6to4), que también encodean una IPv4 y podrían encodear una privada. El riesgo es bajo porque requiere que el resolver devuelva una de esas formas y que el stack sepa rutearla.

**Recomendación:** anotarlo junto a la rama de IPv4 mapeada. Cerrarlo es agregar dos condiciones que reusen `isPrivateV4Octets`, igual que la rama que ya existe.

### L4 — El destino interno rechazado en un salto se transcribe al valor medido (Low, probablemente deseable)

Cuando la defensa rechaza un salto de redirección, `imageProbe.ts:287` devuelve `url: next`, y esa URL —que puede ser una dirección interna como `169.254.169.254`— termina en el valor medido de la fila de "no verificable", recortada al tope compartido.

Lo marco por completitud más que como defecto: revelarle al dueño del sitio que su `og:image` termina redirigiendo a una dirección interna es exactamente la información accionable de esa fila, y el valor está acotado en longitud y no llega ni al ámbito ni al fingerprint. Sólo conviene tenerlo presente cuando Phase 32 pinte ese texto en el panel.

**Recomendación:** ninguna acción en esta fase. Traspaso a Phase 32: revalidar el valor medido antes de usarlo como destino de un enlace o de una imagen, que es el traspaso que la fase 30 ya había dejado escrito.

## Veredicto

**Aprobado para cerrar la fase.** No hay hallazgos Critical ni High. Los dos Medium son riesgos residuales conocidos, documentados en el propio código con su razón, y ninguno de los dos está en el camino que esta fase introduce: el sondeo de imagen valida cada salto. Los cuatro Low son endurecimiento incremental que no cambia ningún veredicto del reporte.

La calidad de los tests es la parte más fuerte de la fase: los bordes están probados en los dos lados, los dos guardarrailes de integración se vieron en rojo antes de darlos por buenos, y ninguna aserción de las que revisé pasa por vacuidad.
