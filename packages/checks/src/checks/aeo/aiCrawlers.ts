import robotsParser from "robots-parser";
import type { SiteCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "AEO-01";
const SCOPE = "ai-crawlers";

/** AI crawler user-agents worth checking for access control in robots.txt. */
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "Applebot-Extended",
];

/** AEO-01: reports allow/deny per AI crawler user-agent from robots.txt. Deny may be intentional — informational. */
export const aiCrawlersCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ origin, robotsTxt }) {
    const url = `${origin}/robots.txt`;

    if (!robotsTxt) {
      return [
        {
          checkId: CHECK_ID,
          category: "aeo",
          title: "No se pudo evaluar el acceso de crawlers de IA",
          severity: "warning",
          measuredValue: "robots.txt no accesible",
          source: url,
          criterion:
            "El acceso de crawlers de IA (GPTBot, ClaudeBot, PerplexityBot, etc.) debería poder evaluarse desde robots.txt",
          recommendation: "Publica un robots.txt accesible para poder auditar el acceso de crawlers de IA.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    const robot = robotsParser(url, robotsTxt);
    const denied: string[] = [];
    const allowed: string[] = [];

    for (const bot of AI_BOTS) {
      const isAllowed = robot.isAllowed(`${origin}/`, bot);
      if (isAllowed === false) denied.push(bot);
      else allowed.push(bot);
    }

    if (denied.length > 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "aeo",
          title: "Crawlers de IA bloqueados en robots.txt",
          severity: "warning",
          measuredValue: `Bloqueados: ${denied.join(", ")}${
            allowed.length > 0 ? ` | Permitidos: ${allowed.join(", ")}` : ""
          }`,
          source: url,
          criterion:
            "Los crawlers de IA deberían poder acceder si se busca visibilidad en respuestas de motores de IA",
          recommendation:
            "Si el bloqueo es intencional (por ejemplo, para evitar entrenamiento de modelos), no requiere acción. Si buscas visibilidad en respuestas de IA, permite estos user-agents en robots.txt.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "aeo",
        title: "Crawlers de IA permitidos",
        severity: "ok",
        measuredValue: `Permitidos: ${allowed.join(", ")}`,
        source: url,
        criterion:
          "Los crawlers de IA deberían poder acceder si se busca visibilidad en respuestas de motores de IA",
        recommendation: "Sin acción necesaria.",
        fingerprint: siteFingerprint(CHECK_ID, SCOPE),
        scope: SCOPE,
      },
    ];
  },
};
