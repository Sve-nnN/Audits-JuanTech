import type { NetworkCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "AEO-02";
const SCOPE = "llms.txt";
const FETCH_TIMEOUT_MS = 8_000;

interface FetchResult {
  ok: boolean;
  body?: string;
}

async function fetchText(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ok: false };
    const body = await res.text();
    return { ok: true, body };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * AEO-02: presence + basic structure of `/llms.txt` and `/llms-full.txt`.
 * Low weight / informational: this is an emerging, low-adoption standard
 * (research shows most sites publishing it get near-zero AI crawler hits).
 */
export const llmsTxtCheck: NetworkCheck = {
  checkId: CHECK_ID,
  async run({ origin }) {
    const llmsUrl = `${origin}/llms.txt`;
    const fullUrl = `${origin}/llms-full.txt`;

    const [llms, llmsFull] = await Promise.all([fetchText(llmsUrl), fetchText(fullUrl)]);

    if (!llms.ok && !llmsFull.ok) {
      return [
        {
          checkId: CHECK_ID,
          category: "aeo",
          title: "Sin llms.txt",
          severity: "warning",
          measuredValue: "no encontrado (ni llms.txt ni llms-full.txt)",
          source: llmsUrl,
          criterion:
            "llms.txt es un estándar emergente para guiar a agentes de IA sobre el contenido del sitio (peso bajo: adopción y uso aún muy limitados)",
          recommendation:
            "Considera publicar un llms.txt con un resumen del sitio y enlaces a contenido clave. Su impacto actual es bajo (la mayoría de los sitios que lo publican reciben pocas o ninguna consulta de bots de IA), así que no es prioritario.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    const found: string[] = [];
    if (llms.ok) found.push("llms.txt");
    if (llmsFull.ok) found.push("llms-full.txt");

    const hasStructure = Boolean(llms.ok && llms.body && /^#\s+/m.test(llms.body));

    return [
      {
        checkId: CHECK_ID,
        category: "aeo",
        title: "llms.txt presente",
        severity: "ok",
        measuredValue: `Encontrado(s): ${found.join(", ")}${
          llms.ok ? (hasStructure ? ", con estructura Markdown" : ", sin encabezados Markdown claros") : ""
        }`,
        source: llmsUrl,
        criterion: "llms.txt es un estándar emergente para guiar a agentes de IA (peso bajo)",
        recommendation: hasStructure
          ? "Sin acción necesaria."
          : "Estructura el archivo con encabezados Markdown (#) para facilitar su interpretación por agentes de IA.",
        fingerprint: siteFingerprint(CHECK_ID, SCOPE),
        scope: SCOPE,
      },
    ];
  },
};
