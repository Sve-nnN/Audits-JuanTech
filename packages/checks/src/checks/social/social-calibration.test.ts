import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { scoreCategory } from "@auditor/scoring";
import { runAllChecks } from "../../registry";
import { makePage } from "../../testUtils";
import type { IssueDraft } from "../../types";

/**
 * Arnés de calibración de la banda de score de la categoría social.
 *
 * Cierra la asunción A3 de `30-RESEARCH.md`, que estimaba la banda objetivo del
 * score de la categoría en sesenta a ochenta con confianza media. Acá esa
 * estimación pasa a ser una MEDICIÓN contra seis perfiles de emisor reales del
 * universo objetivo del lead magnet: WordPress con Yoast, WordPress con Rank
 * Math, Shopify, Webflow, Next.js Metadata API, y el piso del conjunto, un
 * sitio sin ninguna etiqueta social.
 *
 * El modo de falla que este archivo hace exigible es el de la Pitfall 5 de la
 * investigación: la SATURACIÓN. Si los ocho checks emiten fila de aprobado
 * explícita, la categoría puede terminar puntuando alto en todos los sitios y
 * dejar de discriminar entre un emisor bien configurado y uno que no declara
 * nada. Los cuatro asertos de discriminación de abajo lo convierten en suite
 * roja en vez de en un número que nadie mira.
 *
 * La tabla de detección por perfil es el aserto más valioso del archivo: fija
 * exactamente qué ve el catálogo sobre cada emisor real, así que un cambio
 * futuro en la rama de cualquiera de los ocho checks que altere un veredicto se
 * ve como un diff legible en vez de deslizarse sin que nadie lo note. Incluye
 * emisores que mandan las etiquetas del vocabulario de X por el atributo
 * alterno, así que si un plan futuro reintrodujera la lectura restringida a un
 * solo atributo, el veredicto de esos perfiles cambiaría y la tabla lo delata.
 *
 * Los fixtures viven en el motor puro y se leen del disco por ruta relativa con
 * `readFileSync`, nunca importando `@auditor/meta-social` para obtenerlos: es el
 * mismo mecanismo con el que el guardarraíl de colisión de la carpeta `perf` lee
 * el fuente del paquete de PSI, y sirve para no agregar ninguna arista nueva al
 * grafo de dependencias que resuelve la aplicación web.
 *
 * El score se calcula con `scoreCategory`, la misma función del paquete de
 * scoring que produce el número del reporte. Medir con una copia local del
 * modelo daría un número que no es el que ve el usuario.
 */

const ORIGIN = "https://example.com";

/**
 * Prefijo de las URLs de perfil. Se llama `PROFILE_URL_PREFIX` y no `URL` a
 * propósito: una constante de módulo con ese nombre tapa al constructor global
 * y rompe la resolución de rutas de fixture con `import.meta.url`, que este
 * archivo usa.
 */
const PROFILE_URL_PREFIX = "https://example.com/perfil";

const PROFILES = [
  "yoast",
  "rankmath",
  "shopify",
  "webflow",
  "next-metadata",
  "no-og",
] as const;

type ProfileName = (typeof PROFILES)[number];

/**
 * URL de la página con la que se mide cada perfil.
 *
 * Los cinco fixtures de este plan declaran su propia `og:url` con el prefijo de
 * perfil, así que la página se construye con esa misma URL y SOCIAL-04 compara
 * contra la referencia correcta. `yoast.html` es artefacto de 30-01 y declara
 * una URL propia distinta: se lo mide con la suya en vez de modificar un fixture
 * ajeno a este plan, que además sujeta las aserciones de `extract.test.ts`.
 */
const PROFILE_PAGE_URL: Record<ProfileName, string> = {
  yoast: "https://ejemplo.com/guia-auditoria-seo/",
  rankmath: `${PROFILE_URL_PREFIX}/rankmath`,
  shopify: `${PROFILE_URL_PREFIX}/shopify`,
  webflow: `${PROFILE_URL_PREFIX}/webflow`,
  "next-metadata": `${PROFILE_URL_PREFIX}/next-metadata`,
  "no-og": `${PROFILE_URL_PREFIX}/no-og`,
};

/**
 * Tabla de DISEÑO: qué checks deben emitir al menos una fila de problema sobre
 * cada perfil. Se escribe a mano desde el diseño de los fixtures, no se copia de
 * una corrida.
 *
 * Dos checks no aparecen en ninguna fila y eso es el hallazgo de la
 * calibración, no un descuido: SOCIAL-06 (duplicados de Open Graph con valores
 * contradictorios) y SOCIAL-08 (charset dentro del primer kilobyte) pasan en los
 * seis perfiles, porque un emisor real no repite etiquetas con contenidos
 * contradictorios ni declara el charset tarde. La remediación que contempla la
 * convención C-4 de la fase NO se aplica desde este plan: quitarle la fila de
 * aprobado a esos dos checks pone en falso criterios de aceptación ya aceptados
 * en 30-04 y 30-05, así que la decisión se devuelve a planeación con el número
 * medido a la vista.
 */
const EXPECTED_DETECTION: Record<ProfileName, string[]> = {
  // Emisor con og:description de 52 caracteres, por debajo del mínimo de 55.
  yoast: ["SOCIAL-02"],
  // Emisor sin defectos: los ocho checks aprueban.
  rankmath: [],
  // La imagen social va escrita en forma protocol-relative, sin esquema.
  shopify: ["SOCIAL-03"],
  // Sin og:url, sin og:type y sin twitter:card.
  webflow: ["SOCIAL-04", "SOCIAL-05", "SOCIAL-07"],
  // og:description de 235 caracteres, por encima del máximo de 200.
  "next-metadata": ["SOCIAL-02"],
  // Sin ninguna etiqueta social: SOCIAL-06 no aplica y SOCIAL-08 aprueba.
  "no-og": [
    "SOCIAL-01",
    "SOCIAL-02",
    "SOCIAL-03",
    "SOCIAL-04",
    "SOCIAL-05",
    "SOCIAL-07",
  ],
};

/** Lee el documento de perfil del motor puro sin importar el paquete. */
function loadFixture(profile: ProfileName): string {
  return readFileSync(
    new URL(`../../../../meta-social/src/__fixtures__/${profile}.html`, import.meta.url),
    "utf-8",
  );
}

interface ProfileMeasurement {
  issues: IssueDraft[];
  score: number;
  /** checkIds que emitieron al menos una fila de severidad distinta de `ok`. */
  fired: string[];
}

async function measureProfile(profile: ProfileName): Promise<ProfileMeasurement> {
  const page = makePage({ url: PROFILE_PAGE_URL[profile], html: loadFixture(profile) });

  const { issues } = await runAllChecks({
    pages: [page],
    origin: ORIGIN,
    sitemapUrls: [],
    includeNetworkChecks: false,
  });

  const socialIssues = issues.filter((i) => i.category === "social");
  const fired = [
    ...new Set(socialIssues.filter((i) => i.severity !== "ok").map((i) => i.checkId)),
  ].sort();

  return { issues: socialIssues, score: scoreCategory(socialIssues).score, fired };
}

describe("calibración de la banda de score de la categoría social", () => {
  const measurements = new Map<ProfileName, ProfileMeasurement>();

  beforeAll(async () => {
    for (const profile of PROFILES) {
      measurements.set(profile, await measureProfile(profile));
    }
  });

  const scores = () => PROFILES.map((p) => measurements.get(p)!.score);

  it("lee los seis fixtures de perfil y sobre todos emite al menos una fila social", () => {
    // Guarda anti vacuidad: si un fixture no existiera o la ruta relativa
    // estuviera mal, `loadFixture` tira; si el spread del registry se cayera, la
    // categoría saldría vacía y los asertos de abajo pasarían por vacuidad,
    // porque una categoría sin filas puntúa cien por definición del modelo.
    expect(measurements.size).toBe(PROFILES.length);
    for (const profile of PROFILES) {
      const measurement = measurements.get(profile)!;
      expect(measurement.issues.length).toBeGreaterThan(0);
    }
  });

  it("dispara exactamente los checks que la tabla de diseño predice sobre cada perfil", () => {
    const measured = Object.fromEntries(
      PROFILES.map((p) => [p, measurements.get(p)!.fired]),
    ) as Record<ProfileName, string[]>;

    expect(measured).toEqual(EXPECTED_DETECTION);
  });

  it("discrimina entre un emisor bien configurado y uno sin ninguna etiqueta social", () => {
    const all = scores();
    const min = Math.min(...all);
    const max = Math.max(...all);
    const noOgScore = measurements.get("no-og")!.score;

    // El piso del conjunto es el sitio sin etiquetas, y es mínimo ESTRICTO:
    // ningún otro perfil puntúa tan bajo.
    expect(noOgScore).toBe(min);
    expect(all.filter((s) => s === min)).toHaveLength(1);
    expect(noOgScore).toBeLessThanOrEqual(65);

    // Separación entre el mejor y el peor emisor del conjunto.
    expect(max - min).toBeGreaterThanOrEqual(30);

    // Al menos la mitad del conjunto queda por debajo de noventa y cinco: si
    // casi todos los perfiles rozaran el cien, la categoría estaría saturada.
    expect(all.filter((s) => s < 95).length).toBeGreaterThanOrEqual(3);
  });

  it("no satura: el promedio de los seis perfiles se mantiene acotado", () => {
    // El umbral es deliberadamente más laxo que la banda estimada de sesenta a
    // ochenta de la asunción A3, porque esa banda es una conjetura de
    // investigación de confianza media y no una medición: hacerla obligatoria
    // bloquearía la fase por una estimación. Lo que este aserto protege es el
    // modo de falla real, la saturación. La comparación contra la banda
    // estimada es la verificación humana declarada de la fase.
    const all = scores();
    const average = all.reduce((sum, s) => sum + s, 0) / all.length;
    expect(average).toBeLessThanOrEqual(92);
  });
});
