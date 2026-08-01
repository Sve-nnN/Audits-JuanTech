/**
 * Script de verificación de PAGEPERF-01/02/03 (Phase 28, plan 28-03).
 *
 * Reporta, sobre las filas `Page` YA PERSISTIDAS de una auditoría real, la
 * cobertura, la distribución y la tabla de severidades de las dos métricas que
 * agregó esta fase: `responseMs` (tiempo de respuesta del rastreo) y
 * `htmlBytes` (peso del HTML sin comprimir). Su propósito es darle a Juan los
 * números de sus propios sitios para decidir sobre dos suposiciones marcadas,
 * en vez de decidir sobre una muestra de sitios ajenos.
 *
 * Requiere DATABASE_URL con red hacia la base configurada. NO se ejecuta
 * automáticamente en un entorno offline: sin acceso a la base falla de forma
 * ruidosa (imprime el `name` de la clase de error de Prisma, su `code` si
 * existe, y el comando manual exacto) y sale con código distinto de cero.
 * NUNCA fabrica ni estima valores: si no puede leer la base, no reporta nada.
 *
 * Modos
 * -----
 * - Por defecto: CERO requests al sitio auditado. Sólo lee filas `Page`.
 * - `--probe` (opt-in explícito): vuelve a pedir hasta 10 URLs de la auditoría
 *   con la misma configuración de politeness del crawler real (concurrencia,
 *   requests por minuto, timeout, reintentos y user agent idénticos) e imprime
 *   las fases de timing de got. Este modo SÍ genera tráfico contra el sitio
 *   auditado, que es infraestructura de terceros; por eso es opt-in y está
 *   acotado a 10 páginas.
 *
 * Las dos suposiciones que este script existe para resolver
 * ---------------------------------------------------------
 * - FA-1 (umbrales). El modo por defecto imprime qué porcentaje de páginas cae
 *   en severidad distinta de `ok` en cada check. Si ese porcentaje supera
 *   aproximadamente el 30%, los umbrales están marcando casi todo y funcionan
 *   como ruido, no como señal: conviene recalibrarlos antes de producción.
 *   El script imprime el número y la referencia; la decisión es de Juan.
 * - FA-2 (fuente del timing). `responseMs` sale hoy de `timings.phases.total`,
 *   que INCLUYE la fase `wait` (espera de socket) generada por nuestro propio
 *   `maxConcurrency`. El modo `--probe` imprime `wait` al lado de `firstByte`,
 *   `download` y `total` para que se vea qué fracción de la métrica es
 *   encolado nuestro y no latencia del sitio auditado. Si esa fracción es
 *   significativa, cambiar la fuente a `phases.firstByte` (o a `total - wait`)
 *   es una sola línea dentro de `extractPageMetrics`.
 *
 * Uso:
 *   pnpm --filter @auditor/worker exec tsx scripts/verify-pageperf.mts [auditId] [--probe]
 *
 * Sin auditId toma la auditoría `done` más reciente.
 */

import { CheerioCrawler, Configuration, type CheerioCrawlingContext } from "@crawlee/cheerio";
import { prisma } from "@auditor/db";
import { DEFAULT_USER_AGENT } from "@auditor/crawler";

const LOG = "[verify-pageperf]";

const MANUAL_HINT =
  "Corré este script manualmente con acceso de red a la base:\n" +
  "  pnpm --filter @auditor/worker exec tsx scripts/verify-pageperf.mts <auditId>\n" +
  "  pnpm --filter @auditor/worker exec tsx scripts/verify-pageperf.mts <auditId> --probe";

// ---------------------------------------------------------------------------
// Umbrales replicados a propósito para que este diagnóstico se lea solo, sin
// importar el catálogo de checks.
// MANTENER SINCRONIZADO A MANO con:
//   packages/checks/src/checks/perf/responseTime.ts (PERF-10)
//   packages/checks/src/checks/perf/htmlSize.ts     (PERF-11)
// Si allá cambian los valores y acá no, este script reporta una distribución
// que no corresponde a los issues que el reporte va a mostrar.
// ---------------------------------------------------------------------------
const WARN_MS = 600;
const CRITICAL_MS = 1500;
const WARN_BYTES = 100 * 1024;
const CRITICAL_BYTES = 300 * 1024;

/** Umbral de lectura de FA-1: por encima de esto los umbrales marcan casi todo. */
const NOISE_RATIO_PCT = 30;

// ---------------------------------------------------------------------------
// Configuración del sondeo, replicada de packages/crawler/src/crawl.ts para que
// las fases medidas sean comparables con las de un crawl real (misma presión de
// concurrencia = misma fase `wait`). Cambiar allá sin cambiar acá invalida la
// evidencia de FA-2.
// ---------------------------------------------------------------------------
const PROBE_MAX_URLS = 10;
const PROBE_MAX_CONCURRENCY = 5;
const PROBE_MAX_REQUESTS_PER_MINUTE = 120;
const PROBE_HANDLER_TIMEOUT_SECS = 30;
const PROBE_MAX_REQUEST_RETRIES = 2;
/** 400–599 son DATO, no error: mismo criterio que el crawler real. */
const PROBE_IGNORED_HTTP_ERROR_STATUS_CODES = Array.from({ length: 200 }, (_v, i) => 400 + i);

type Severity = "ok" | "warning" | "critical";

/** Fases de timing que got adjunta a la respuesta; Crawlee no las declara. */
interface ProbeResponse {
  timings?: {
    phases?: {
      wait?: number;
      dns?: number;
      tcp?: number;
      request?: number;
      firstByte?: number;
      download?: number;
      total?: number;
    };
  };
}

interface ProbeRow {
  url: string;
  wait: number | null;
  firstByte: number | null;
  download: number | null;
  total: number | null;
  bytes: number | null;
}

/** Percentil por rango más cercano sobre una lista ya ordenada ascendente. */
function percentile(sortedAsc: readonly number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const index = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[index] ?? null;
}

/** Comparación estrictamente mayor: el valor límite exacto cuenta como el escalón inferior. */
function severityFor(value: number, warn: number, critical: number): Severity {
  return value > critical ? "critical" : value > warn ? "warning" : "ok";
}

function countSeverities(values: readonly number[], warn: number, critical: number) {
  const counts: Record<Severity, number> = { ok: 0, warning: 0, critical: 0 };
  for (const value of values) counts[severityFor(value, warn, critical)] += 1;
  return counts;
}

function pct(part: number, total: number): string {
  if (total === 0) return "n/d";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function fmt(value: number | null, unit: string): string {
  return value == null ? "n/d" : `${value} ${unit}`;
}

function printDistribution(label: string, sortedAsc: readonly number[], unit: string): void {
  if (sortedAsc.length === 0) {
    console.log(`${LOG} ${label}: sin datos (ninguna página tiene la métrica).`);
    return;
  }
  console.log(
    `${LOG} ${label} sobre ${sortedAsc.length} páginas: ` +
      `mín=${fmt(sortedAsc[0] ?? null, unit)} ` +
      `p50=${fmt(percentile(sortedAsc, 50), unit)} ` +
      `p90=${fmt(percentile(sortedAsc, 90), unit)} ` +
      `máx=${fmt(sortedAsc[sortedAsc.length - 1] ?? null, unit)}`
  );
}

function printSeverityRow(
  checkId: string,
  label: string,
  values: readonly number[],
  warn: number,
  critical: number
): number {
  const counts = countSeverities(values, warn, critical);
  const total = values.length;
  const notOk = counts.warning + counts.critical;
  console.log(
    `${LOG}   ${checkId} (${label}): ` +
      `ok=${counts.ok} warning=${counts.warning} critical=${counts.critical} ` +
      `— distinto de ok: ${notOk}/${total} (${pct(notOk, total)})`
  );
  return total === 0 ? 0 : (notOk / total) * 100;
}

/**
 * Sondeo de fases de timing. SÓLO se llama con la bandera `--probe`: genera
 * hasta PROBE_MAX_URLS requests reales contra el sitio auditado.
 */
async function runProbe(urls: readonly string[]): Promise<void> {
  console.log(
    `${LOG} --- sondeo de fases (--probe) --- ${urls.length} requests reales al sitio auditado`
  );

  const rows: ProbeRow[] = [];

  // Almacenamiento en memoria y no persistido: el sondeo no escribe nada a disco
  // ni interfiere con una auditoría en curso en el mismo proceso.
  const config = new Configuration({
    storageClientOptions: { persistStorage: false },
    purgeOnStart: true,
  });

  const crawler = new CheerioCrawler(
    {
      maxConcurrency: PROBE_MAX_CONCURRENCY,
      maxRequestsPerMinute: PROBE_MAX_REQUESTS_PER_MINUTE,
      maxRequestsPerCrawl: urls.length,
      requestHandlerTimeoutSecs: PROBE_HANDLER_TIMEOUT_SECS,
      maxRequestRetries: PROBE_MAX_REQUEST_RETRIES,
      ignoreHttpErrorStatusCodes: PROBE_IGNORED_HTTP_ERROR_STATUS_CODES,
      useSessionPool: true,
      preNavigationHooks: [
        (_ctx, gotOptions) => {
          gotOptions.headers = { ...gotOptions.headers, "user-agent": DEFAULT_USER_AGENT };
        },
      ],
      async requestHandler(ctx: CheerioCrawlingContext) {
        const { request, response, body } = ctx;
        const phases = (response as ProbeResponse | undefined)?.timings?.phases;
        const html = typeof body === "string" ? body : body?.toString("utf-8");
        rows.push({
          url: request.loadedUrl ?? request.url,
          wait: phases?.wait ?? null,
          firstByte: phases?.firstByte ?? null,
          download: phases?.download ?? null,
          total: phases?.total ?? null,
          bytes: html == null ? null : Buffer.byteLength(html, "utf-8"),
        });
      },
      failedRequestHandler({ request }, error) {
        console.warn(`${LOG}   FALLÓ ${request.url}: ${(error as Error).message}`);
      },
    },
    config
  );

  await crawler.run([...urls]);

  let sumTotal = 0;
  let sumWait = 0;
  for (const row of rows) {
    const netTotal = row.total != null && row.wait != null ? row.total - row.wait : null;
    console.log(
      `${LOG}   wait=${fmt(row.wait, "ms")} | firstByte=${fmt(row.firstByte, "ms")} | ` +
        `download=${fmt(row.download, "ms")} | total=${fmt(row.total, "ms")} | ` +
        `total-wait=${fmt(netTotal, "ms")} | html=${fmt(row.bytes, "bytes")} | ${row.url}`
    );
    if (row.total != null) sumTotal += row.total;
    if (row.wait != null) sumWait += row.wait;
  }

  if (rows.length === 0) {
    console.warn(`${LOG}   ninguna página del sondeo respondió: no hay evidencia para FA-2.`);
    return;
  }

  console.log(
    `${LOG}   agregado: total=${sumTotal} ms, wait=${sumWait} ms — ` +
      `la fase wait es el ${pct(sumWait, sumTotal)} del total agregado.`
  );
  console.log(
    `${LOG}   FA-2: esa fracción de wait la genera nuestro propio maxConcurrency, ` +
      `no el sitio auditado. Si es significativa, la fuente de responseMs debería ` +
      `pasar de phases.total a phases.firstByte (o total - wait) en extractPageMetrics.`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const wantsProbe = args.includes("--probe");
  const argAuditId = args.find((a) => !a.startsWith("--"));

  // Resuelve la auditoría: id explícito por argv, o la `done` más reciente.
  // Los dos caminos pegan a la base — un P1001 acá significa que no hay red
  // (ver main().catch).
  const audit = argAuditId
    ? await prisma.audit.findUniqueOrThrow({
        where: { id: argAuditId },
        select: { id: true, status: true, finishedAt: true, site: { select: { domain: true } } },
      })
    : await prisma.audit.findFirst({
        where: { status: "done" },
        orderBy: { finishedAt: "desc" },
        select: { id: true, status: true, finishedAt: true, site: { select: { domain: true } } },
      });

  if (!audit) {
    console.error(`${LOG} no hay ningún audit \`done\` en la base. Corré una auditoría primero.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const pages = await prisma.page.findMany({
    where: { auditId: audit.id },
    select: {
      url: true,
      finalUrl: true,
      html: true,
      responseMs: true,
      htmlBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `${LOG} audit=${audit.id} domain=${audit.site.domain} status=${audit.status} páginas=${pages.length}`
  );

  if (pages.length === 0) {
    console.error(`${LOG} la auditoría no tiene páginas persistidas: no hay nada que medir.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // --- Cobertura ---------------------------------------------------------
  const reachable = pages.filter((p) => p.html != null && p.html !== "");
  const withMs = pages.filter((p) => p.responseMs != null);
  const withBytes = pages.filter((p) => p.htmlBytes != null);
  const gapMs = reachable.filter((p) => p.responseMs == null);
  const gapBytes = reachable.filter((p) => p.htmlBytes == null);

  console.log(
    `${LOG} cobertura: responseMs no nulo en ${withMs.length}/${pages.length} ` +
      `(null en ${pages.length - withMs.length}) — ` +
      `htmlBytes no nulo en ${withBytes.length}/${pages.length} ` +
      `(null en ${pages.length - withBytes.length}) — ` +
      `páginas alcanzables (con html): ${reachable.length}`
  );

  if (gapMs.length > 0 || gapBytes.length > 0) {
    console.warn(
      `${LOG} ADVERTENCIA: ${gapMs.length} páginas con html presente y responseMs en null, ` +
        `${gapBytes.length} con html presente y htmlBytes en null. ` +
        `O la auditoría es anterior a esta fase (sin backfill), o got no pobló los timings ` +
        `y hay un defecto de cableado en extractPageMetrics/crawl.ts.`
    );
    for (const p of [...gapMs, ...gapBytes].slice(0, 5)) {
      console.warn(`${LOG}   sin métrica: ${p.finalUrl ?? p.url}`);
    }
  }

  // --- Distribuciones ----------------------------------------------------
  const msValues = withMs.map((p) => p.responseMs as number).sort((a, b) => a - b);
  // Mismo Math.round(bytes / 1024) que usa el check, para que los KB impresos
  // acá coincidan exactamente con el `measuredValue` del reporte.
  const kbValues = withBytes.map((p) => Math.round((p.htmlBytes as number) / 1024)).sort((a, b) => a - b);
  const byteValues = withBytes.map((p) => p.htmlBytes as number);

  printDistribution("responseMs", msValues, "ms");
  printDistribution("htmlBytes", kbValues, "KB");

  // --- Tabla de severidades ---------------------------------------------
  console.log(`${LOG} severidades con los umbrales implementados:`);
  console.log(
    `${LOG}   umbrales: PERF-10 warning > ${WARN_MS} ms / critical > ${CRITICAL_MS} ms — ` +
      `PERF-11 warning > ${WARN_BYTES / 1024} KB / critical > ${CRITICAL_BYTES / 1024} KB ` +
      `(HTML sin comprimir)`
  );
  const msNotOkPct = printSeverityRow("PERF-10", "tiempo de respuesta", msValues, WARN_MS, CRITICAL_MS);
  const bytesNotOkPct = printSeverityRow(
    "PERF-11",
    "tamaño de HTML",
    byteValues,
    WARN_BYTES,
    CRITICAL_BYTES
  );

  // --- Veredicto FA-1 ----------------------------------------------------
  console.log(
    `${LOG} FA-1: páginas con severidad distinta de ok — ` +
      `PERF-10 ${msNotOkPct.toFixed(1)}% / PERF-11 ${bytesNotOkPct.toFixed(1)}%.`
  );
  console.log(
    `${LOG} FA-1: referencia de lectura — si alguno de esos porcentajes supera ` +
      `aproximadamente el ${NOISE_RATIO_PCT}%, el umbral está marcando casi toda página ` +
      `y funciona como ruido, no como señal: conviene recalibrarlo antes de producción. ` +
      `Este script no decide: sólo imprime el número.`
  );

  // --- Peores páginas ----------------------------------------------------
  const worstMs = [...withMs]
    .sort((a, b) => (b.responseMs as number) - (a.responseMs as number))
    .slice(0, 10);
  console.log(`${LOG} peores 10 por responseMs:`);
  for (const p of worstMs) {
    console.log(`${LOG}   ${p.responseMs} ms — ${p.finalUrl ?? p.url}`);
  }

  const worstBytes = [...withBytes]
    .sort((a, b) => (b.htmlBytes as number) - (a.htmlBytes as number))
    .slice(0, 10);
  console.log(`${LOG} peores 10 por htmlBytes:`);
  for (const p of worstBytes) {
    console.log(
      `${LOG}   ${Math.round((p.htmlBytes as number) / 1024)} KB — ${p.finalUrl ?? p.url}`
    );
  }

  // --- Sondeo opt-in -----------------------------------------------------
  if (wantsProbe) {
    // Muestra por paso fijo sobre las páginas alcanzables: evita que las 10
    // URLs caigan todas en el mismo template por venir seguidas del sitemap.
    const stride = Math.max(1, Math.floor(reachable.length / PROBE_MAX_URLS));
    const sample: string[] = [];
    for (let i = 0; i < reachable.length && sample.length < PROBE_MAX_URLS; i += stride) {
      const p = reachable[i];
      if (p) sample.push(p.finalUrl ?? p.url);
    }
    if (sample.length === 0) {
      console.warn(`${LOG} sondeo omitido: la auditoría no tiene páginas alcanzables.`);
    } else {
      await runProbe(sample);
    }
  } else {
    console.log(
      `${LOG} sondeo de fases NO ejecutado (cero requests al sitio auditado). ` +
        `Para la evidencia de FA-2 volvé a correr con --probe: hace hasta ` +
        `${PROBE_MAX_URLS} requests reales al sitio.`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  const err = error as { code?: unknown; name?: unknown; message?: unknown };
  // `name` se imprime tal como viene: para un fallo de conexión de Prisma ya
  // vale el nombre de la clase de inicialización, y es el único identificador
  // estable entre versiones (la propiedad `code` no está garantizada en todas).
  const name = String(err?.name ?? "Error");
  const code = err?.code == null ? "(sin code)" : String(err.code);
  const message = String(err?.message ?? "");
  const isUnreachable =
    code === "P1001" ||
    name === "PrismaClientInitializationError" ||
    /can't reach database server/i.test(message);

  if (isUnreachable) {
    console.error(
      `${LOG} no se pudo alcanzar la base de datos: name=${name} code=${code}. ` +
        `Este entorno no tiene acceso a la base configurada en DATABASE_URL. ` +
        `No se reporta ninguna métrica: este script nunca fabrica ni estima valores.\n` +
        MANUAL_HINT
    );
  } else {
    console.error(`${LOG} error inesperado: name=${name} code=${code}`);
    console.error(error);
    console.error(MANUAL_HINT);
  }

  try {
    await prisma.$disconnect();
  } catch {
    // se ignora el fallo de desconexión sobre una conexión que nunca se abrió
  }
  // Salida explícita distinta de cero: un catch que sólo loguea deja el proceso
  // saliendo en 0 y convierte esta verificación en un falso verde.
  process.exit(1);
});
