import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageChecks } from "../../registry";
import { responseTimeCheck } from "./responseTime";
import { htmlSizeCheck } from "./htmlSize";
import { makePage } from "../../testUtils";

/**
 * Guardarraíl de colisión de checkId — INTEGRADO (cruza `packages/checks` con
 * `packages/psi`).
 *
 * Ningún test aislado cubre este concern: cada check prueba su propia forma, y
 * `packages/psi` prueba la suya, pero los dos paquetes construyen el
 * `fingerprint` con el mismo formato exacto (`checkId` + ":" + URL — ver
 * `util.ts#pageFingerprint` y `psi/src/issues.ts`). Si un checkId se repite
 * entre ambos catálogos, las dos filas sobre la misma URL colapsan en el `Map`
 * de `diffIssues`, corrompen los contadores `new`/`persistent` y persisten dos
 * `Issue` con el mismo fingerprint y títulos contradictorios. No hay constraint
 * único sobre `Issue.fingerprint`, así que el defecto no da error: degrada el
 * reporte en silencio.
 *
 * El catálogo de PSI se lee del ARCHIVO FUENTE con `fs`, nunca importándolo:
 * agregar `@auditor/psi` como dependencia de `packages/checks` metería una
 * arista nueva en el grafo que `apps/web` resuelve, y esa frontera es
 * justamente la que blinda `scripts/assert-no-playwright-in-web.mjs`. Leer el
 * archivo mantiene el guardarraíl al día si PSI agrega checkIds en el futuro,
 * sin costo de dependencia.
 */

/**
 * URL fija de prueba: los fingerprints sólo colisionan sobre una misma URL.
 * Se llama `TEST_URL` y no `URL` a propósito: una constante de módulo llamada
 * `URL` tapa al constructor global y rompe la resolución del fuente de PSI.
 */
const TEST_URL = "https://example.com/page";

/** Ruta al fuente de PSI resuelta desde este archivo, sin importarlo. */
const PSI_ISSUES_SOURCE = new URL("../../../../psi/src/issues.ts", import.meta.url);

/** Extrae todos los literales `checkId: "..."` del fuente de PSI (specs + inline). */
function extractPsiCheckIds(): string[] {
  const source = readFileSync(PSI_ISSUES_SOURCE, "utf-8");
  const ids = new Set<string>();
  for (const match of source.matchAll(/checkId:\s*"([^"]+)"/g)) {
    ids.add(match[1]!);
  }
  return [...ids];
}

/**
 * Devuelve los checkIds presentes en las dos colecciones.
 *
 * Vive extraída como función pura, y no inline dentro de un `it`, para que el
 * guardarraíl pueda demostrar su propia capacidad de detección con datos
 * sintéticos (caso 4). Probarlo mutando código de producción sería peor: una
 * edición temporal que quede sin revertir persiste exactamente el defecto que
 * este archivo existe para impedir, y sin constraint único sobre
 * `Issue.fingerprint` nada lo detectaría.
 */
export function findCollisions(checkIdsA: Iterable<string>, checkIdsB: Iterable<string>): string[] {
  const b = new Set(checkIdsB);
  const collisions = new Set<string>();
  for (const id of checkIdsA) {
    if (b.has(id)) collisions.add(id);
  }
  return [...collisions];
}

describe("guardarraíl de colisión de checkId entre @auditor/checks y @auditor/psi", () => {
  it("extrae un catálogo de checkIds no vacío del fuente de PSI", () => {
    // Si la regex se rompe (por un refactor de PSI o de la extracción), el
    // conjunto sale vacío y TODAS las demás aserciones pasarían por vacuidad:
    // el guardarraíl se convertiría en un falso PASS. Falla ruidosamente acá.
    const psiCheckIds = extractPsiCheckIds();
    expect(psiCheckIds.length).toBeGreaterThan(0);
    expect(psiCheckIds).toEqual(
      expect.arrayContaining(["PERF-05", "PERF-06", "PERF-07", "PERF-08", "PERF-09"])
    );
  });

  it("no encuentra ningún checkId compartido entre pageChecks y el catálogo de PSI", () => {
    const registryCheckIds = pageChecks.map((c) => c.checkId);
    expect(findCollisions(registryCheckIds, extractPsiCheckIds())).toEqual([]);
  });

  it("no produce fingerprints duplicados al unir los checks nuevos con los de PSI sobre la misma URL", () => {
    // Fixture que dispara los DOS checks de la fase 28 a la vez.
    const page = makePage({
      url: TEST_URL,
      html: "<html><body><h1>Hola</h1></body></html>",
      responseMs: 1501,
      htmlBytes: 307201,
    });
    const ctx = { page, $: undefined as never };
    const ownFingerprints = [
      ...responseTimeCheck.run(ctx),
      ...htmlSizeCheck.run(ctx),
    ].map((i) => i.fingerprint);
    expect(ownFingerprints.length).toBe(2);

    // PSI construye el fingerprint con el mismo formato byte a byte
    // (`${checkId}:${url}`), así que se reproduce igual acá.
    const psiFingerprints = extractPsiCheckIds().map((id) => `${id}:${TEST_URL}`);

    const union = [...ownFingerprints, ...psiFingerprints];
    expect(new Set(union).size).toBe(union.length);
  });

  it("detecta la colisión cuando existe (autoprueba con un checkId sintético de PSI)", () => {
    // Sin este caso, la aserción de "cero colisiones" sería indistinguible de
    // un falso PASS: una `findCollisions` rota que siempre devuelva `[]` la
    // haría pasar igual. Acá se le inyecta un checkId REAL de PSI en la
    // colección del registry y se exige que lo reporte. Los datos son
    // sintéticos y viven dentro del test: no se toca ni un archivo de `src`.
    const psiCheckIds = extractPsiCheckIds();
    const colliding = psiCheckIds[0]!;
    const registryCheckIdsPlusCollision = [...pageChecks.map((c) => c.checkId), colliding];

    expect(findCollisions(registryCheckIdsPlusCollision, psiCheckIds)).toEqual([colliding]);
  });
});
