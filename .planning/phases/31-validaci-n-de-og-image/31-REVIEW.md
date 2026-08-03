---
phase: 31-validaci-n-de-og-image
reviewed: 2026-08-03T17:30:00Z
depth: deep
reviewer: gsd-code-reviewer (revisión adversarial, segunda pasada)
supersedes: revisión previa del 2026-08-03T17:18 (0 Critical / 0 High / aprobado)
files_reviewed: 18
files_reviewed_list:
  - packages/checks/package.json
  - packages/checks/src/checks/network/brokenExternalLinks.test.ts
  - packages/checks/src/checks/network/brokenExternalLinks.ts
  - packages/checks/src/checks/network/brokenResources.ts
  - packages/checks/src/checks/network/concurrency.ts
  - packages/checks/src/checks/network/imageProbe.test.ts
  - packages/checks/src/checks/network/imageProbe.ts
  - packages/checks/src/checks/network/index.ts
  - packages/checks/src/checks/network/linkChecker.test.ts
  - packages/checks/src/checks/network/linkChecker.ts
  - packages/checks/src/checks/network/ogImageNetwork.test.ts
  - packages/checks/src/checks/network/ogImageNetwork.ts
  - packages/checks/src/checks/network/ssrfGuard.test.ts
  - packages/checks/src/checks/network/ssrfGuard.ts
  - packages/checks/src/checks/social/social-guardrail.test.ts
  - packages/checks/src/registry.test.ts
  - packages/meta-social/src/index.ts
  - packages/meta-social/src/thresholds.ts
findings:
  critical: 2
  high: 4
  medium: 6
  low: 12
  total: 24
status: fixed
blocking_resolved: [CR-01, CR-02, HI-01, HI-02]
resolution_commits:
  CR-01: 7be95bb
  CR-02: db654f8
  HI-01: c449793
  HI-02: 3214f72
resolution_notes: >
  Los 4 bloqueantes se cerraron con código real + tests (no sólo
  documentación). CR-01: fetch en imageProbe.ts ahora usa un dispatcher de
  undici (Agent con connect.lookup fijado) que conecta contra la dirección
  ya validada por assertPublicDestination, cerrando el TOCTOU de DNS
  rebinding. CR-02: linkChecker.ts pasó de redirect:"follow" a
  redirect:"manual" con revalidación por salto. HI-01: describe("probeImage
  — redirecciones") agregado con los 6 casos que el review detalló,
  incluido el rechazo SSRF en el salto 2. HI-02: la lectura del cuerpo se
  separó del catch que descartaba todo el resultado, así que un timeout
  durante la lectura ya no pierde status/content-type ya obtenidos.
  Medium/Low (ME-01..06, LO-01..12) quedan fuera de esta corrida, ver
  .planning/BACKLOG.md.
---

# Fase 31 — Reporte de revisión de código (pasada adversarial)

**Alcance real:** `git diff 27eb05d~1..HEAD -- packages/` → 18 archivos, 2643 líneas agregadas. (El rango `c587ce0..HEAD` que usó la revisión previa arrastra archivos de fases anteriores; se acotó al rango de los commits `feat(31-0X)`/`test(31-0X)`.)

**Suite:** 100/100 en verde (`vitest run src/checks/network src/registry.test.ts src/checks/social/social-guardrail.test.ts`). **Ninguno de los 24 hallazgos pone la suite en rojo.** Ese es el dato relevante: los tests de la fase están bien escritos pero cubren el camino feliz de cada rama, no los bordes que fallan.

**Método:** los hallazgos marcados "verificado ejecutando" se reprodujeron corriendo el código real con archivos temporales bajo `packages/checks/src/__probe__/`, ya eliminados. No se modificó ningún archivo de producción.

## Resumen

| Severidad | Cantidad | Bloqueantes |
|---|---|---|
| Critical | 2 | 2 |
| High | 4 | 2 |
| Medium | 6 | 0 |
| Low | 12 | 0 |

La fase entrega una rebanada funcional y excepcionalmente bien documentada, pero **la documentación va por delante del código en tres puntos que importan**: la defensa SSRF tiene el bypass clásico abierto en los dos caminos (rebinding en `imageProbe`, redirección automática en `linkChecker`), el tope de lectura de bytes no es un tope duro, y el camino de redirecciones —el control de seguridad central declarado por 31-01— **no tiene ni un solo test**. Además hay dos defectos de clasificación que producen filas `critical` falsas sobre sitios sanos.

---

## Divergencia con la revisión previa

La revisión anterior (mismo archivo, 17:18) concluyó "0 Critical, 0 High, aprobado para cerrar". Tres de sus afirmaciones no se sostienen al ejecutar el código:

1. **"El timer de aborto cubre también la lectura del cuerpo"**, listado como fortaleza. Es correcto como descripción y es el origen de **HI-02**: cuando el timer dispara después de las cabeceras, se descarta un `200 image/png` válido y se emite `critical "Imagen social inalcanzable"` abanicado por página.
2. **"`readUpTo` ... el exceso está acotado por el tamaño de un chunk ... No es una vulnerabilidad"**. El contrato no lo garantiza y la función está exportada. Verificado ejecutando: con un chunk de 8 MiB, `readUpTo(res, 64*1024)` devuelve una vista de 64 KiB cuyo `buffer.byteLength` es **8388608**, con dos asignaciones de 8 MiB. Ver **ME-01**.
3. **"En TECH-12 y TECH-13 el destino sale de un `href` o un `src` del HTML, no de un valor que el atacante elija con precisión"**. El modelo de amenaza del producto es que cualquier persona envía su propia URL para auditar: el atacante controla el HTML **entero**, incluidos todos los `href` y `src`. La deuda de redirección en `linkChecker` no es menor que la del sondeo de imagen; es **más fácil de explotar**, porque no requiere control de DNS. Ver **CR-02**.

También se disiente del cierre "ninguna aserción pasa por vacuidad": el test rotulado "de punta a punta" no ejercita el transporte (LO-09) y el test del tope de lectura no prueba el tope (LO-07).

---

## Critical

### CR-01: La defensa de destino se salta con DNS rebinding (TOCTOU resolver → fetch)

**Archivo:** `packages/checks/src/checks/network/ssrfGuard.ts:131-160`, consumido en `packages/checks/src/checks/network/imageProbe.ts:235` y `:285`

`assertPublicDestination` resuelve el nombre con `dns.lookup` y clasifica las direcciones; después `fetch()` (`imageProbe.ts:213`) **vuelve a resolver el mismo nombre por su cuenta**. Entre las dos resoluciones no hay vínculo: la dirección validada nunca se fija en la conexión.

El modelo de amenaza del producto lo hace explotable de punta a punta: cualquier persona envía una URL arbitraria y el worker la rastrea, y el valor de `og:image` lo controla el atacante al 100%. Con un DNS autoritativo propio, TTL 0 y respuestas alternadas (pública para el `lookup`, `169.254.169.254` o `127.0.0.1` para el `fetch`), el worker abre la conexión interna. En un contenedor típico no hay caché de resolución que lo estorbe.

Y no queda en la conexión: `classifyImageProbe` persiste status, content-type, tamaño total y dimensiones del destino interno en una fila `Issue` que el atacante recibe en su propio reporte por email. Es un escáner de endpoints internos con oráculo de status y de tamaño.

El docblock de `ssrfGuard.ts:14-20` declara el hueco como "riesgo residual aceptado en L1". Documentarlo no lo cierra, y el resto del archivo se presenta como la defensa contra T-31-01/T-31-02.

**Fix:** fijar la dirección resuelta en el transporte en vez de revalidar el nombre.

```ts
import { Agent } from "undici";

// assertPublicDestination pasa a devolver { ok: true; addresses: string[] }.
function pinnedAgent(allowed: string[]) {
  return new Agent({
    connect: {
      lookup: (_host, _opts, cb) => {
        const address = allowed[0];
        if (!address || isPrivateAddress(address)) {
          return cb(new Error(REASON_NOT_PUBLIC), "", 4);
        }
        cb(null, address, isIP(address));
      },
    },
  });
}

const verdict = await assertPublicDestination(currentUrl);
if (!verdict.ok) return { ok: false, url: currentUrl, status: null, reason: verdict.reason };
const res = await fetch(currentUrl, { /* ... */ dispatcher: pinnedAgent(verdict.addresses) });
```

Si el equipo decide **no** cerrarlo en esta fase, tiene que ser decisión de producto explícita en ROADMAP/STATE —no un comentario dentro de un archivo— y el SUMMARY no debería afirmar que la defensa de destino está en su lugar.

---

### CR-02: En TECH-12 y TECH-13 la defensa se salta con un 302, sin trucos de DNS

**Archivo:** `packages/checks/src/checks/network/linkChecker.ts:43-46` (validación) contra `:52` (`redirect: "follow"`)

`checkOne` valida el destino **una sola vez, sobre la URL inicial**, y después hace `fetch(url, { redirect: "follow" })`. Undici sigue hasta 20 saltos por su cuenta y ninguno pasa por `assertPublicDestination`.

Explotación trivial, sin control de DNS: el sitio auditado publica `<a href="https://evil.example/x">`; `evil.example` responde `302 Location: http://169.254.169.254/latest/meta-data/iam/security-credentials/`; el auditor lo sigue. TECH-12 después persiste `HTTP 200` o `HTTP 404` de ese endpoint interno en el reporte que el atacante recibe. Con `<img src>` y `<script src>`, lo mismo por TECH-13.

Es **más fácil de explotar que CR-01** y afecta a dos checks que ya corren en producción. El comentario de `linkChecker.ts:33-38` lo reconoce y lo difiere "para la fase que toque la capa de red" — pero la fase 31 **es** esa fase: reescribió este archivo justamente para agregarle la defensa. Entregar una defensa que una redirección anula es peor que no entregarla, porque cierra el tema en el ledger.

**Fix (mínimo, sin reescribir el transporte):** pasar a `redirect: "manual"` y reutilizar el bucle que `imageProbe.ts:240-292` ya tiene, extrayéndolo a un helper compartido en vez de duplicarlo. Contención inmediata si el bucle no entra en esta fase: `redirect: "error"` — un enlace que redirige se reporta como no verificable en lugar de seguirse a ciegas. Degrada cobertura, pero no deja el agujero abierto.

---

## High

### HI-01: Cero cobertura de tests sobre el camino de redirecciones — el control de seguridad central de la fase

**Archivos:** `imageProbe.test.ts` (297 líneas), `ssrfGuard.test.ts` (187), `ogImageNetwork.test.ts` (614)

`imageProbe.ts:282-284` declara la revalidación por salto como "el bypass clásico de esta defensa" y la implementa. Ningún test la ejercita. La única aparición de la palabra en los tres archivos es un literal de cadena dentro de una aserción **negativa** (`ogImageNetwork.test.ts:290`).

Quedan sin probar:

- que un `Location` hacia `169.254.169.254` se rechaza en el salto 2 (el control de T-31-02);
- el tope de saltos (`imageProbe.ts:240`, `:311`);
- un `3xx` sin cabecera `Location` (`:268`);
- un `Location` no parseable (`:274-281`);
- un `Location` relativo (`:273`);
- que la URL reportada tras un rechazo en salto es la del salto y no la inicial (`:287`).

Sin estos casos, un refactor que saque `assertPublicDestination(next)` del bucle deja la suite en verde. El guardarraíl anti-vacuidad que el proyecto aplica con tanto cuidado (`social-guardrail.test.ts:157-165`) falta justo donde más importa.

**Fix:** un `describe("probeImage — redirecciones")` con seis casos, sobre el mismo patrón de `mockResolvedValueOnce` de `imageProbe.test.ts:249-271`. El caso obligatorio:

```ts
it("ssrf: un Location hacia la dirección de metadatos se rechaza en el salto, sin abrir la segunda conexión", async () => {
  lookupMock
    .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])    // salto 1: público
    .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]); // salto 2: metadatos
  const fetchMock = vi.fn().mockResolvedValueOnce(
    fakeResponse({ status: 302, headers: { location: "http://interno.example/" } }).res,
  );
  vi.stubGlobal("fetch", fetchMock);

  const result = await probeImage("https://cdn.example.com/og.png");

  expect(fetchMock).toHaveBeenCalledTimes(1); // nunca se abrió el salto 2
  expect(result).toMatchObject({ ok: false, status: null, reason: REASON_NOT_PUBLIC });
  expect((result as { url: string }).url).toBe("http://interno.example/");
});
```

---

### HI-02: Un corte del cuerpo (o el timeout) descarta una respuesta HTTP válida y emite `critical` falso por página

**Archivo:** `packages/checks/src/checks/network/imageProbe.ts:206-228` — la llamada a `readUpTo` en `:219` vive dentro del mismo `try` cuyo `catch` de `:221-224` devuelve `{ kind: "error" }`

El diseño es deliberado y está documentado (el presupuesto de 5 s cubre la lectura). El efecto colateral no lo está: si el `AbortController` dispara **después** de que llegaron las cabeceras —servidor lento, CDN que gotea bytes, imagen grande sobre una conexión pobre— se pierde todo lo ya obtenido (status 200, `content-type: image/png`, `content-length`) y `probeImage` devuelve `{ ok: false, reason: "tiempo agotado" }`.

`classifyImageProbe:127-136` no distingue ese caso de un 404: emite **`critical` "Imagen social inalcanzable"**. Y `ogImageNetwork.ts:379-393` lo abanica por cada página que declara la imagen: en un sitio de 500 páginas con una única `og:image` compartida, **un servidor lento produce 500 filas críticas falsas** y hunde la categoría social. Mismo resultado si el servidor corta el cuerpo tras mandar las cabeceras.

**Fix:** conservar la respuesta cuando ya se obtuvo y degradar sólo lo que falló.

```ts
type FetchOutcome =
  | { kind: "response"; res: Response; head: Uint8Array; truncated: boolean }
  | { kind: "error"; reason: string };

const res = await fetch(url, { /* ... */ });
let head = new Uint8Array(0);
let truncated = false;
try {
  head = await readUpTo(res, IMAGE_HEAD_BYTES);
} catch {
  // Las cabeceras ya llegaron: status y content-type son evidencia válida.
  // Sólo se pierden las dimensiones, que salen `null`.
  truncated = true;
}
return { kind: "response", res, head, truncated };
```

Así un servidor lento cae en la rama informativa de "dimensiones indeterminadas" (`ogImageNetwork.ts:190-199`), que es exactamente la severidad que el propio comentario del archivo dice que corresponde a "una limitación de nuestro método de medición, no una falla del sitio auditado".

---

### HI-03: `text/html` con un `<svg>` en los primeros bytes se clasifica como imagen vectorial crítica

**Archivo:** `packages/checks/src/checks/network/ogImageNetwork.ts:143` (rama SVG) y `:163` (regla de dos señales)

**Verificado ejecutando:** `classifyImageProbe({ ok: true, contentType: "text/html; charset=utf-8", dimensions: { width: 24, height: 24, type: "svg" }, ... })` devuelve `[["og-image-svg", "critical", "Imagen social en un formato que las plataformas no renderizan"]]`.

`image-size@2.0.2` valida SVG con `svgReg.test(toUTF8String(input, 0, 1000))` (`dist/index.cjs:721`): le alcanza con que aparezca `<svg ...>` en el primer kilobyte. Una página HTML con un ícono SVG inline arriba —patrón habitual en Webflow, Shopify y cualquier sprite embebido— parsea como "imagen svg de 24×24".

El caso real: `og:image` apunta a una página HTML (soft 404, página de error del CDN, redirección a un login). El diagnóstico correcto es "La URL de og:image no devuelve una imagen"; el usuario recibe "exportá la imagen social a PNG o JPEG", que no tiene nada que ver con su problema. La regla de dos señales de `:163` existe para el caso simétrico, pero la rama SVG de `:143` corre **antes** y la saltea.

**Fix:** confiar en `dimensions` como señal de imagen sólo cuando la cabecera no la contradice.

```ts
const declaresText = contentType?.startsWith("text/") ?? false;
const looksLikeImage = !declaresText && result.dimensions !== null;

if (contentType?.startsWith("image/svg") || (looksLikeImage && result.dimensions?.type === "svg")) { /* ... */ }

if (!contentType?.startsWith("image/") && !looksLikeImage) { /* no es una imagen */ }
```

---

### HI-04: Un sondeo puede consumir hasta 40 s; no hay presupuesto de tiempo total

**Archivo:** `packages/checks/src/checks/network/imageProbe.ts:240-264`

`IMAGE_PROBE_TIMEOUT_MS` acota **una petición**, no el sondeo. Peor caso por imagen: 4 iteraciones del bucle (`hop <= MAX_REDIRECT_HOPS`, ver LO-01) × 2 peticiones por iteración (la del rango más el respaldo sin rango de `:257-264`) × 5 s = **40 s**. No hace falta un atacante: una cadena de redirecciones lenta lo produce sola.

Con el tope de 150 imágenes y concurrencia 12 (`concurrency.ts:19`), el peor caso de IMG-01 solo es ~500 s. Sumado a TECH-12 y TECH-13, que corren en serie antes (`registry.ts:80-84`), la auditoría puede quedarse mucho más allá de lo que el usuario tolera — el mismo modo de falla que `MAX_URLS_PER_NETWORK_CHECK` existe para evitar (`linkChecker.ts:6-11`).

**Fix:** un deadline por sondeo, además del de cada petición.

```ts
export const IMAGE_PROBE_TOTAL_BUDGET_MS = 12_000;

export async function probeImage(url: string): Promise<ImageProbeResult> {
  const deadline = Date.now() + IMAGE_PROBE_TOTAL_BUDGET_MS;
  // ...
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    if (Date.now() > deadline) {
      return { ok: false, url: currentUrl, status: null, reason: "tiempo agotado" };
    }
    // ...
  }
}
```

---

## Medium

### ME-01: El tope de lectura no es duro — un solo chunk lo desborda sin límite

**Archivo:** `packages/checks/src/checks/network/imageProbe.ts:84-112` (bucle en `:91`, copia en `:105-111`)

El comentario de `:78-82` promete "un conteo duro de bytes acumulados". La condición es `while (total < maxBytes)`: se evalúa **antes** de leer y nunca contra el tamaño del chunk que llega. Un único chunk de N bytes se acepta entero.

**Verificado ejecutando:** con un lector que devuelve un chunk de 8 MiB y `maxBytes = 65536`, `readUpTo` devuelve una vista de 65536 bytes cuyo `buffer.byteLength` es **8388608**. Se asignaron 8 MiB dos veces (el chunk y el `out` de `:105`) y el `Uint8Array` devuelto retiene el buffer completo mientras `head` viva. Con 12 sondeos en vuelo, ~200 MiB de pico frente a los ~1,5 MiB que el diseño supone. Es la amenaza T-31-03 que la función dice cerrar.

Hoy undici corta los chunks al tamaño de lectura del socket, así que el desborde real es de pocos KiB — pero el contrato no lo garantiza y `readUpTo` está exportado.

Segundo defecto en el mismo bucle: `if (!value) continue` (`:95`) no filtra un `Uint8Array` de longitud cero. Un flujo que emita chunks vacíos indefinidamente gira sin avanzar `total`.

**Fix:**

```ts
while (total < maxBytes) {
  const { done, value } = await reader.read();
  if (done) break;
  if (!value || value.byteLength === 0) continue;
  const room = maxBytes - total;
  const slice = value.byteLength > room ? value.subarray(0, room) : value;
  chunks.push(slice);
  total += slice.byteLength;
}
// `out` queda de exactamente `total` bytes: el subarray final ya no hace falta.
```

### ME-02: La tabla de rangos privados deja fuera bloques que embeben o alcanzan direcciones internas

**Archivo:** `packages/checks/src/checks/network/ssrfGuard.ts:30-40` (v4) y `:91-110` (v6)

El comentario de `:115-117` declara la política correcta ("lo que no se reconoce como válido se clasifica como privado"), pero la implementación es una lista de bloqueo parcial: todo lo que **sí** parsea y no está enumerado sale como público.

**Verificado ejecutando `isPrivateAddress`:**

| Dirección | Devuelve | Debería |
|---|---|---|
| `::127.0.0.1` (IPv4-compatible, `::/96`) | `false` | `true` |
| `::ffff:0:127.0.0.1` (IPv4-translated, `::ffff:0:0/96`) | `false` | `true` |
| `64:ff9b::127.0.0.1` (NAT64 well-known) | `false` | `true` |
| `2002:7f00:1::` (6to4 con 127.0.0.1 embebida) | `false` | `true` |
| `fec0::1` (site-local) | `false` | `true` |
| `224.0.0.1`, `239.1.2.3` (multicast `224/4`) | `false` | `true` |
| `240.0.0.1`, `255.255.255.255` (`240/4` + broadcast) | `false` | `true` |
| `192.0.0.1` (`192.0.0.0/24`), `198.18.0.1` (`198.18.0.0/15`) | `false` | `true` |

`ssrfGuard.test.ts:19-95` cubre trece filas de la tabla y ninguna de estas ocho. Que sean difíciles de rutear en la práctica no es argumento: la defensa se diseñó explícitamente para no depender de suposiciones de ruteo.

**Fix:** en `isPrivateV4Octets`, sumar `224/4`, `240/4`, `192.0.0.0/24` y `198.18.0.0/15`. En `isPrivateV6`, desenvolver `::/96`, `::ffff:0:0/96` y `64:ff9b::/96` con la misma tabla de v4 que ya se aplica a `::ffff:a.b.c.d` (`:97-101`), tratar `2002::/16` extrayendo la v4 embebida de los grupos 1-2, y sumar `fec0::/10`.

### ME-03: `checkOne` nunca consume ni cancela el cuerpo de la respuesta

**Archivo:** `packages/checks/src/checks/network/linkChecker.ts:48-65`

El respaldo por método hace un `GET` real (`:52`) y decide leyendo sólo `res.status`. El cuerpo nunca se lee ni se cancela. Undici no devuelve la conexión al pool hasta que el cuerpo se consume o el objeto se recolecta, y emite el aviso de body sin destruir. Con hasta 150 URLs por check y dos checks que lo usan, son hasta 300 respuestas colgadas por auditoría.

Contrasta con la restricción dura que el propio `imageProbe.ts:20-22` se impone ("nunca dejar un lector sin cancelar"), en el archivo hermano tocado en el mismo commit.

**Fix:** `await res.body?.cancel().catch(() => {})` inmediatamente después de leer el status, en las dos ramas (`:56` y `:58`).

### ME-04: Texto controlado por el sitio auditado se persiste sin recorte en TECH-12/TECH-13

**Archivos:** `linkChecker.ts:62-63`, `brokenExternalLinks.ts:133`, `brokenResources.ts:95`

`checkOne` devuelve `reason: error.message` —el mensaje crudo del error de red— y los dos checks lo copian a `measuredValue`. Es literalmente la amenaza T-31-05 que la fase mitiga con cuidado en `ogImageNetwork.ts:60` (`cap()` a `MAX_MEASURED_VALUE_CHARS`) y evita en `imageProbe.ts:200-205` con un vocabulario cerrado. Los dos archivos vecinos, modificados en el mismo commit `526625f`, quedaron sin el control.

Además `source`, `scope` y `fingerprint` embeben `result.url` sin tope (`brokenExternalLinks.ts:89`, `:96`, `:127`; `brokenResources.ts:71`, `:78`, `:89`). Una URL de 8 KB del sitio auditado entra entera en tres columnas, por fila. (En el `fingerprint` el recorte sería un defecto —ver `ogImageNetwork.ts:53-60`—, pero `measuredValue` y `source` sí deben acotarse.)

**Fix:** aplicar en `checkOne` el mismo vocabulario cerrado de `imageProbe.ts` (`"tiempo agotado"` / `"sin respuesta"`, decidido con `controller.signal.aborted`) y `cap()` sobre `measuredValue` y `source` en los dos checks.

### ME-05: Las filas `ok` abanicadas por página inflan el score de la categoría social

**Archivos:** `ogImageNetwork.ts:190-199` (rama informativa) + `:379-393` (abanico), contra `packages/scoring/src/categoryScore.ts:39-46`

`scoreCategory` es la media de salud sobre las filas emitidas, con `ok = 1`. La rama de "dimensiones indeterminadas" tiene severidad `ok` y se abanica por página igual que las de defecto: **una sola imagen que no se pudo medir en un sitio de 500 páginas inyecta 500 filas de crédito completo** en la categoría, sube la media y diluye defectos reales de SOCIAL-01..08.

Es un no-veredicto contando como check aprobado, a escala de tres dígitos. Distinto de TECH-12, donde las filas informativas equivalentes son de ámbito de sitio (una por URL, no por página): IMG-01 es el primer check que multiplica filas `ok` por la cantidad de páginas. Lo mismo, en menor magnitud, con la rama de "no verificable" (`warning`, `:113-124`).

**Fix:** emitir la fila informativa **una sola vez por imagen**, con ámbito de sitio (`siteFingerprint(CHECK_ID, \`og-image-undetermined:${url}\`)`, sin `pageId`), igual que la fila de cap de `:350-365`. El abanico por página tiene sentido para un defecto accionable; para una limitación de medición no aporta nada y sí mueve el score.

### ME-06: La política de no duplicar señales con SOCIAL-03 está implementada a medias

**Archivo:** `ogImageNetwork.ts:298-301` (contrato declarado) y `:315-332` (implementación)

El docstring dice: "Una página sin og:image, o con una cuyo esquema no es http ni https, no produce fila ni petición: SOCIAL-03 ya reporta esa ausencia y duplicar la señal degrada el reporte y el score". Correcto para esos dos casos. Pero SOCIAL-03 (`social/ogImage.ts`) también emite `critical` para tres casos más que IMG-01 **sí** procesa, porque `normalizeUrl` los resuelve sin problema:

- `og:image` relativa (`/img/og.png`) → `ogImage.ts:97-113`
- `og:image` sin protocolo (`//cdn/og.png`) → `ogImage.ts:51-67`
- `og:image` sobre `http://` → `ogImage.ts:114-129`

En los tres, la misma página recibe la crítica de SOCIAL-03 **más** el veredicto completo de IMG-01 sobre la URL resuelta. En un score que es media sobre filas, es doble penalización por un solo defecto — precisamente lo que el docstring dice evitar. `registry.test.ts:233` usa una `og:image` relativa pero con la red apagada, así que el escenario nunca se ejercita.

**Fix:** aplicar la misma condición de salida que usa SOCIAL-03, o exponer desde `@auditor/meta-social` un predicado compartido (`isSociallyUsableImageUrl(value, baseUrl)`) que los dos checks consuman, para declarar la frontera una sola vez.

---

## Low

### LO-01: `MAX_REDIRECT_HOPS = 3` pero se siguen hasta 4 redirecciones
`imageProbe.ts:32` y `:240`. `for (let hop = 0; hop <= MAX_REDIRECT_HOPS; ...)` da 4 iteraciones: hasta 4 peticiones y 4 saltos seguidos antes de `"demasiadas redirecciones"`. La constante dice "redirects followed before giving up". **Fix:** `hop < MAX_REDIRECT_HOPS` (con `MAX_REDIRECT_HOPS = 4` si se quiere conservar el comportamiento), o corregir el docstring.

### LO-02: `toByteCount` acepta hexadecimal y notación exponencial
`imageProbe.ts:123-131`. `Number("0x10")` → 16 y `Number("1e3")` → 1000 pasan el filtro de entero finito. El docstring promete un entero leído de una cabecera HTTP, donde sólo valen dígitos decimales. `imageProbe.test.ts:195-204` cubre cuatro formas hostiles y ninguna de estas dos. **Fix:** `if (!/^\d+$/.test(trimmed)) return null;` antes del `Number()`.

### LO-03: Se muestran mebibytes con la etiqueta "MB"
`ogImageNetwork.ts:68` (`toMib`), `:258` y `:269` (los criterios dicen "5 MB" y "1 MB"), `thresholds.ts:119-122` (constantes binarias). El comentario de `thresholds.ts:113-117` justifica la unidad binaria, pero la etiqueta que ve el usuario es la decimal. Un archivo de 5,0 MB decimales (5 000 000 B) se muestra como "4.8 MB" y no cruza el umbral. **Fix:** etiquetar "MiB", o convertir a MB decimales para presentación manteniendo el umbral binario.

### LO-04: Dimensiones de 0 píxeles se aceptan como medición válida
`imageProbe.ts:171-183`. `Number.isFinite(0)` es `true`, así que `{ width: 0, height: 0 }` pasa el guard. **Verificado ejecutando:** `classifyImageProbe` con `{ width: 0, height: 0, type: "bmp" }` devuelve `og-image-too-small` con severidad `critical`. Un parseo degenerado se convierte en un defecto acusado al usuario, cuando el resultado correcto es "indeterminadas". **Fix:** `if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width <= 0 || size.height <= 0) return null;`

### LO-05: Los status 300 y 304 caen en la rama de éxito
`imageProbe.ts:294`. `REDIRECT_STATUSES` (`:34`) no los incluye y `res.status >= 400` no los atrapa: se devuelve `ok: true` con cuerpo vacío → `dimensions: null` → rama de "no es una imagen" (`critical`) si el `content-type` tampoco es de imagen. **Fix:** tratar todo `3xx` no seguible como `{ ok: false, status, reason: \`HTTP ${status}\` }`.

### LO-06: `mapWithConcurrency` puede devolver un arreglo con huecos
`concurrency.ts:34`. `if (item === undefined) continue` salta la asignación y deja `results[current]` sin definir; si el hueco es el último, `results.length` queda por debajo de `items.length`. `ogImageNetwork.ts:372` (`if (!entry || !result) continue`) descarta la imagen en silencio en vez de reportarla. **Fix:** asignar siempre un resultado, o documentar que el contrato exige un arreglo sin `undefined` y validarlo en la entrada.

### LO-07: El test del tope de lectura no prueba el tope
`imageProbe.test.ts:108-120`. "corta en IMAGE_HEAD_BYTES exactos" sólo afirma `head.byteLength === IMAGE_HEAD_BYTES`, que es el largo de la **vista** devuelta por el `subarray` de `imageProbe.ts:111`. Pasa igual con la implementación desbordada de ME-01. **Fix:** afirmar además `head.buffer.byteLength <= IMAGE_HEAD_BYTES` y el número de llamadas a `read()`.

### LO-08: `linkChecker.test.ts` simula la defensa entera, así que no prueba su cableado real
`linkChecker.test.ts:7-10` reemplaza `assertPublicDestination` con un mock. Los dos casos titulados "ssrf:" (`:37`, `:57`) verifican que `checkOne` respeta el veredicto del mock —útil—, pero el título promete más de lo que hay y ningún test recorre `checkLinks` con la defensa real. En particular, nada detecta CR-02. **Fix:** renombrar a "veredicto de la defensa" y agregar un caso con la defensa real que fije el comportamiento ante una redirección.

### LO-09: El test "de punta a punta" no ejercita el transporte que dice ejercitar
`ogImageNetwork.test.ts:572-613`. El docstring afirma "the real transport runs against a stubbed global fetch". El stub de `:585-591` devuelve un objeto **sin `body`**, así que `readUpTo` sale en su primera línea (`imageProbe.ts:85`) y no se recorre ni la lectura acotada, ni la cancelación del lector, ni `deriveTotalBytes`, ni `readDimensions`. Sólo se cubre el camino de cabeceras de un 404. **Fix:** darle al stub un `body` con `getReader()` (la fábrica `fakeResponse` de `imageProbe.test.ts:31-62` ya lo hace) y afirmar dimensiones y tamaño total en el resultado.

### LO-10: El cap de 150 URLs se importa desde `linkChecker`, no desde la capa compartida
`ogImageNetwork.ts:19`. `MAX_URLS_PER_NETWORK_CHECK` está documentado en `linkChecker.ts:6-11` en términos de "HEAD+GET" y enlaces externos, y ahora gobierna también el sondeo de imágenes. La fase ya extrajo `mapWithConcurrency` y `DEFAULT_NETWORK_CONCURRENCY` a `concurrency.ts` por exactamente ese motivo (T-31-10); el cap se quedó atrás. **Fix:** moverlo a `concurrency.ts` y reexportarlo desde `linkChecker` durante la transición.

### LO-11: Dos páginas con el mismo `finalUrl` producen fingerprints idénticos
`ogImageNetwork.ts:390`. La clave es `IMG-01:<subtipo>:<finalUrl>`, sin `pageId`. Dos filas `Page` distintas que redirigen a la misma URL final (caso `/a` y `/a/`) generan la misma clave y `diffIssues` las colapsa. Es la convención de todo el proyecto (43 usos de `page.finalUrl ?? page.url`), así que es deuda compartida y no de esta fase — pero IMG-01 la amplifica al ser el primer check de la categoría que emite dos filas por página. `social-guardrail.test.ts` sólo usa una página, así que el escenario no está cubierto. **Fix:** fuera de alcance; anotar en el ledger de ventanas rotas.

### LO-12: El dedupe por URL normalizada puede reportar la imagen de otra página
`ogImageNetwork.ts:320` (clave) contra `:329` (URL de petición). Dos páginas cuyas `og:image` difieren sólo en parámetros de tracking normalizan a la misma clave, se sondea la URL **de la primera** y la fila de la segunda muestra esa URL ajena en `measuredValue`. Impacto cosmético; la deduplicación en sí es correcta y deseable.

---

## Lo que se revisó con foco y salió limpio

Se confirman estos aciertos del diseño, verificados y no sólo leídos:

- **Clasificar direcciones resueltas y no el hostname.** `dns.lookup("2130706433", { all: true })` devuelve `127.0.0.1` en Node 24 vía `inet_aton`, así que las formas decimal y octal de una IP quedan neutralizadas por construcción. Decisión correcta y no obvia.
- **`dns.lookup("", { all: true })` devuelve `[]`** en Node 24, así que un `Location` con esquema `file:` cae en `REASON_UNRESOLVABLE` y no rompe la defensa ni lanza.
- **Contrato de precisión de IMG-04.** Las dos comparaciones de peso van sobre el entero de bytes con estrictamente mayor que; `toMib` es sólo presentación y ninguna comparación lee su salida. `deriveTotalBytes` distingue bien el `content-length` de un `206` del total del `content-range`, y devuelve `null` ante `*`.
- **Aritmética de coma flotante del ratio.** La banda se declara con dos extremos explícitos y se compara con `<` / `>`. El test afirma primero que `1700/1000` es exactamente `OG_IMAGE_RATIO_MIN` y `2100/1000` exactamente `OG_IMAGE_RATIO_MAX`, lo que hace el borde verificable en vez de aproximado.
- **Orden de las ramas terminales.** La rama de no verificable va antes que la de inalcanzable y no mira el status, que es necesario: sus dos casos llegan con status nulo y puestos después caerían en inalcanzable. Igual en `brokenExternalLinks.ts:88`, antes de `isBlockedStatus`.
- **Sin ReDoS explotable en `image-size@2.0.2`:** `svgReg` tiene alternativas disjuntas en el primer carácter y `validate` está acotado a 1 KB.
- **Guardarrailes de fingerprint.** Bien construidos: reconstruyen la clave llamando a la función real en vez de escribirla a mano, abren con guarda anti-vacuidad y se prueban contra `diffIssues`, que es el mecanismo que de verdad las consume.

---

## Veredicto

**No aprobado para cerrar sin acción.** Bloquean el cierre:

- **CR-01** y **CR-02** — o se cierran, o el equipo los acepta como decisión de producto explícita en ROADMAP/STATE y el SUMMARY deja de afirmar que la defensa de destino está en su lugar. Un comentario dentro de un archivo no es una aceptación de riesgo.
- **HI-01** — la fase no puede cerrarse reclamando la revalidación por salto como control entregado mientras ningún test la ejercite.
- **HI-02** — genera filas `critical` falsas a escala de cientos por auditoría, que es el modo de falla que más daña la credibilidad del reporte, y el fix son ocho líneas.

HI-03, HI-04 y los seis Medium deberían entrar en la fase de corrección. Los doce Low son endurecimiento incremental y pueden ir al ledger.

---

_Revisado: 2026-08-03_
_Revisor: Claude (gsd-code-reviewer), modo deep, postura adversarial_
