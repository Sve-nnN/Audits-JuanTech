import { beforeAll, describe, expect, it } from "vitest";
import { diffIssues } from "@auditor/scoring";
import { runAllChecks } from "../../registry";
import { pageFingerprint } from "../../util";
import { makePage } from "../../testUtils";
import type { IssueDraft } from "../../types";

/**
 * Guardarraíl del Success Criterion #5 de la fase 30 — INTEGRADO (cruza la
 * categoría social con el catálogo entero y con el check retirado en v1.6).
 *
 * Ningún test aislado cubre este concern. Cada uno de los ocho checks prueba su
 * propia forma y su propio contrato de fingerprint, pero ninguno puede ver lo
 * que pasa cuando los ocho corren juntos sobre la misma página, y ninguno puede
 * ver al catálogo retirado. El criterio de aceptación número cinco del ROADMAP
 * dice textualmente que `SOCIAL-01..08` son distintos de `ONPAGE-05` por
 * diseño, pero que esta fase debe PROBARLO y no asumirlo.
 *
 * Por qué importa: las dos colecciones construyen el `fingerprint` con el mismo
 * formato exacto (`checkId` + ":" + URL — ver `util.ts#pageFingerprint`) y no
 * hay constraint único sobre `Issue.fingerprint` en base de datos. Una colisión
 * no da error: colapsa dos filas en el `Map` de `diffIssues`, corrompe los
 * contadores `new`/`persistent` y degrada el reporte en silencio.
 *
 * Por qué el fingerprint del check retirado se RECONSTRUYE y no se importa: el
 * módulo de `ONPAGE-05` fue borrado del árbol en la fase 29 y `registry.test.ts`
 * tiene un guardarraíl dedicado a que cualquier reintroducción ponga la suite en
 * rojo. Reconstruirlo llamando a `pageFingerprint`, la misma función que usan
 * los ocho checks, es lo que hace que este archivo siga siendo válido el día que
 * cambie el formato: si la cadena estuviera escrita a mano, el guardarraíl
 * seguiría pasando en verde justo en el escenario contra el que existe.
 *
 * Las filas se obtienen llamando a `runAllChecks`, nunca importando el barrel de
 * la categoría: si el spread del registry se cayera en un merge, la colección
 * social se queda vacía y la guarda anti vacuidad del primer caso lo delata en
 * vez de dejar pasar todo lo demás por vacuidad.
 */

const ORIGIN = "https://example.com";

/**
 * URL fija de prueba: los fingerprints de página sólo pueden colisionar sobre
 * una misma URL. Se llama `TEST_URL` y no `URL` a propósito: una constante de
 * módulo con ese nombre tapa al constructor global.
 */
const TEST_URL = "https://example.com/page";

/** Identificador del check absorbido por la categoría social y retirado en v1.6. */
const RETIRED_CHECK_ID = "ONPAGE-05";

/** Cantidad de checks que la categoría social registra en `pageChecks`. */
const SOCIAL_CHECK_ID_COUNT = 8;

/**
 * Las cuatro etiquetas Open Graph básicas: exactamente el caso que el check
 * retirado resolvía emitiendo una fila por página, y el que nombra el criterio
 * de aceptación cinco del ROADMAP.
 */
const FOUR_OG_TAGS_HTML =
  "<html><head>" +
  '<meta property="og:title" content="Título" />' +
  '<meta property="og:description" content="Descripción" />' +
  '<meta property="og:image" content="https://example.com/og.png" />' +
  `<meta property="og:url" content="${TEST_URL}" />` +
  "</head><body><h1>Hola</h1></body></html>";

/**
 * Devuelve los valores que aparecen más de una vez en la colección.
 *
 * Vive extraída y exportada, y no inline dentro de un `it`, para que el
 * guardarraíl pueda demostrar su propia capacidad de detección con datos
 * sintéticos (último caso del archivo). Probarlo mutando código de producción
 * sería peor: una edición temporal que quede sin revertir persiste exactamente
 * el defecto que este archivo existe para impedir, y sin constraint único sobre
 * `Issue.fingerprint` nada lo detectaría.
 */
export function findDuplicateFingerprints(fingerprints: Iterable<string>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const fingerprint of fingerprints) {
    if (seen.has(fingerprint)) duplicates.add(fingerprint);
    else seen.add(fingerprint);
  }
  return [...duplicates];
}

/** Devuelve los valores presentes en las dos colecciones. */
export function findSharedFingerprints(
  fingerprintsA: Iterable<string>,
  fingerprintsB: Iterable<string>,
): string[] {
  const b = new Set(fingerprintsB);
  const shared = new Set<string>();
  for (const fingerprint of fingerprintsA) {
    if (b.has(fingerprint)) shared.add(fingerprint);
  }
  return [...shared];
}

describe("guardarraíl SC#5 — la categoría social no colisiona con ONPAGE-05 ni consigo misma", () => {
  let socialIssues: IssueDraft[] = [];
  let otherIssues: IssueDraft[] = [];

  beforeAll(async () => {
    const page = makePage({ url: TEST_URL, html: FOUR_OG_TAGS_HTML });

    const { issues } = await runAllChecks({
      pages: [page],
      origin: ORIGIN,
      sitemapUrls: [],
      includeNetworkChecks: false,
    });

    socialIssues = issues.filter((i) => i.category === "social");
    otherIssues = issues.filter((i) => i.category !== "social");
  });

  it("emite filas de los ocho checks de la categoría social por el camino de producción", () => {
    // Guarda anti vacuidad, primer caso a propósito: si el spread del registry
    // se cayera en un merge, la colección social saldría vacía y TODAS las
    // aserciones de abajo pasarían por vacuidad. El guardarraíl se convertiría
    // en un falso PASS silencioso. Falla ruidosamente acá.
    expect(socialIssues.length).toBeGreaterThan(0);
    const distinctCheckIds = new Set(socialIssues.map((i) => i.checkId));
    expect(distinctCheckIds.size).toBe(SOCIAL_CHECK_ID_COUNT);
  });

  it("no emite ningún fingerprint igual al del check retirado ONPAGE-05 sobre la misma URL", () => {
    // El fingerprint de referencia se OBTIENE llamando a la función real, la
    // misma que usan los ocho checks. Componer la cadena a mano dejaría este
    // caso pasando en verde el día que cambie el formato de fingerprint.
    const retiredFingerprint = pageFingerprint(RETIRED_CHECK_ID, TEST_URL);

    expect(socialIssues.map((i) => i.fingerprint)).not.toContain(retiredFingerprint);
    expect(socialIssues.map((i) => i.checkId)).not.toContain(RETIRED_CHECK_ID);
  });

  it("no repite ningún fingerprint dentro de la propia categoría social", () => {
    // Cubre el riesgo real de los dos checks multi hallazgo (SOCIAL-06 y
    // SOCIAL-07), que componen un subtipo dentro del fingerprint.
    const fingerprints = socialIssues.map((i) => i.fingerprint);
    expect(findDuplicateFingerprints(fingerprints)).toEqual([]);
  });

  it("no comparte ningún fingerprint con las otras cinco categorías de la misma corrida", () => {
    // Se asserta INTERSECCIÓN, no unicidad global: un duplicado preexistente
    // dentro de las categorías viejas es deuda ajena a esta fase y no debe
    // poner en rojo su cierre. Una colisión que cruce la frontera sí es
    // responsabilidad de la categoría nueva.
    expect(otherIssues.length).toBeGreaterThan(0);
    const shared = findSharedFingerprints(
      socialIssues.map((i) => i.fingerprint),
      otherIssues.map((i) => i.fingerprint),
    );
    expect(shared).toEqual([]);
  });

  it("no colapsa ninguna fila social en el diff entre auditorías", () => {
    // La unicidad no es cosmética: tiene que sobrevivir al mecanismo que
    // consume los fingerprints.
    const diff = diffIssues(socialIssues, []);
    expect(diff.statusByFingerprint.size).toBe(socialIssues.length);
    for (const issue of socialIssues) {
      expect(diff.statusByFingerprint.get(issue.fingerprint)).toBe("new");
    }
    expect(diff.resolved).toEqual([]);
  });

  it("detecta la colisión cuando existe (autoprueba con fingerprints sintéticos)", () => {
    // Sin este caso, "cero duplicados" y "cero intersección" serían
    // indistinguibles de dos comparadores rotos que siempre devuelven lista
    // vacía. Los datos son sintéticos y viven dentro del caso: no se toca ni un
    // archivo de código de producción.
    const fingerprints = socialIssues.map((i) => i.fingerprint);
    const repeated = fingerprints[0]!;
    expect(findDuplicateFingerprints([...fingerprints, repeated])).toEqual([repeated]);

    // Variante que cierra el criterio cinco: si el fingerprint del check
    // retirado estuviera de verdad en la colección social, la comparación de
    // conjuntos tiene que reportarlo.
    const retiredFingerprint = pageFingerprint(RETIRED_CHECK_ID, TEST_URL);
    expect(findSharedFingerprints([...fingerprints, retiredFingerprint], [retiredFingerprint])).toEqual([
      retiredFingerprint,
    ]);
  });
});
