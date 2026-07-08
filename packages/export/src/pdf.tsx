import { fileURLToPath } from "node:url";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportModel, ReportIssue } from "@auditor/report-model";
import type { Category } from "@auditor/scoring";
import { prioritizeIssues } from "./priority";
import {
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  STATUS_LABEL,
  SEVERITY_LABEL,
} from "./labels";

/**
 * PDF serializer (EXPORT-01). Pure JS via `@react-pdf/renderer` — its own
 * renderer, sin ningún motor de navegador headless (per CLAUDE.md "What NOT to
 * Use": nada de PDF vía navegador headless en Vercel).
 *
 * Typographic roles v1.1 (preferencia validada de roles tipográficos):
 *   - HEADINGS/títulos = Khand (weights 400/600)
 *   - BODY             = Geist Sans (weight 400)
 *   - La fuente de display de marca NO se usa en títulos (queda reservada) y
 *     no se embebe aquí.
 *
 * Both families have full Latin coverage (áéíóúñ¿¡), so heading AND body text
 * keep their accents without falling back to the PDF Helvetica core font.
 *
 * The volume guardrail is the SHARED `prioritizeIssues(model.priorityCandidates)`
 * (EXPORT-05): top-N over the full critical+warning set, with the "Mostrando N
 * de M" note when capped. NO PII: only ReportModel data reaches this function.
 */

const fontUrl = (file: string): string =>
  fileURLToPath(new URL(`./fonts/${file}`, import.meta.url));

let fontsRegistered = false;
function registerFonts(): void {
  if (fontsRegistered) return;
  // HEADINGS = Khand (400 + 600).
  Font.register({
    family: "Khand",
    fonts: [
      { src: fontUrl("Khand-Regular.ttf"), fontWeight: 400 },
      { src: fontUrl("Khand-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  // BODY = Geist Sans (400).
  Font.register({
    family: "GeistSans",
    src: fontUrl("GeistSans-Regular.ttf"),
    fontWeight: 400,
  });
  // Accented words must not be hyphen-split; keep them whole for clean glyphs.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    // BODY font (Geist Sans) is the page default.
    fontFamily: "GeistSans",
    fontSize: 10,
    lineHeight: 1.4,
    color: "#1a1a1a",
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 44,
  },
  // --- HEADINGS (Khand) ---
  coverTitle: {
    fontFamily: "Khand",
    fontWeight: 600,
    fontSize: 30,
    color: "#111111",
  },
  coverDomain: {
    fontFamily: "Khand",
    fontWeight: 400,
    fontSize: 20,
    color: "#333333",
    marginTop: 6,
  },
  sectionHeading: {
    fontFamily: "Khand",
    fontWeight: 600,
    fontSize: 18,
    color: "#111111",
    marginTop: 20,
    marginBottom: 8,
  },
  categoryHeading: {
    fontFamily: "Khand",
    fontWeight: 600,
    fontSize: 12,
    color: "#222222",
  },
  issueHeading: {
    fontFamily: "Khand",
    fontWeight: 600,
    fontSize: 12,
    color: "#111111",
    marginBottom: 2,
  },
  // --- BODY (Geist Sans) ---
  bodyLarge: {
    fontFamily: "GeistSans",
    fontSize: 14,
    marginTop: 8,
  },
  body: {
    fontFamily: "GeistSans",
    fontSize: 10,
  },
  muted: {
    fontFamily: "GeistSans",
    fontSize: 9,
    color: "#666666",
  },
  note: {
    fontFamily: "GeistSans",
    fontSize: 9,
    color: "#555555",
    marginBottom: 6,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: "1px solid #eeeeee",
  },
  issueBlock: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: "1px solid #f0f0f0",
  },
  issueField: {
    flexDirection: "row",
    marginTop: 1,
  },
  issueLabel: {
    fontFamily: "GeistSans",
    fontSize: 9,
    color: "#888888",
    width: 78,
  },
  issueValue: {
    fontFamily: "GeistSans",
    fontSize: 9,
    color: "#222222",
    flex: 1,
  },
});

const val = (v: string | null | undefined): string =>
  v === null || v === undefined || v === "" ? "no disponible" : v;

const scoreText = (score: number | null | undefined): string =>
  score === null || score === undefined ? "no disponible" : `${score} / 100`;

function ReportDocument({ model }: { model: ReportModel }) {
  const prioritized = prioritizeIssues(model.priorityCandidates);
  return (
    <Document
      title={`Auditoría web — ${model.audit.domain}`}
      author="juan-tech.com"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Portada: dominio + score general + status (headings en Khand) */}
        <Text style={styles.coverTitle}>Auditoría web</Text>
        <Text style={styles.coverDomain}>{model.audit.domain}</Text>
        <Text style={styles.bodyLarge}>
          Score general: {scoreText(model.overall)} · {STATUS_LABEL[model.status]}
        </Text>

        {/* Scores por categoría (heading acentuado en Khand) */}
        <Text style={styles.sectionHeading}>Scores por categoría</Text>
        {CATEGORY_ORDER.map((category) => {
          const result = model.byCategory[category as Category];
          return (
            <View key={category} style={styles.categoryRow}>
              <Text style={styles.categoryHeading}>{CATEGORY_LABEL[category]}</Text>
              <Text style={styles.body}>
                {result
                  ? `${scoreText(result.score)} — ${STATUS_LABEL[result.status]}`
                  : "sin datos"}
              </Text>
            </View>
          );
        })}

        {/* Issues priorizados (cap top-N compartido sobre priorityCandidates) */}
        <Text style={styles.sectionHeading}>
          Issues priorizados ({prioritized.shown})
        </Text>
        {prioritized.note ? (
          <Text style={styles.note}>{prioritized.note}</Text>
        ) : null}

        {prioritized.issues.map((issue: ReportIssue, i: number) => {
          const label = SEVERITY_LABEL[issue.severity] ?? issue.severity;
          return (
            <View key={issue.id} style={styles.issueBlock} wrap={false}>
              <Text style={styles.issueHeading}>
                {i + 1}. [{issue.checkId}] {issue.title} ({label})
              </Text>
              <View style={styles.issueField}>
                <Text style={styles.issueLabel}>Página / selector</Text>
                <Text style={styles.issueValue}>{val(issue.url ?? issue.source)}</Text>
              </View>
              <View style={styles.issueField}>
                <Text style={styles.issueLabel}>Valor medido</Text>
                <Text style={styles.issueValue}>{val(issue.measuredValue)}</Text>
              </View>
              <View style={styles.issueField}>
                <Text style={styles.issueLabel}>Criterio</Text>
                <Text style={styles.issueValue}>{val(issue.criterion)}</Text>
              </View>
              <View style={styles.issueField}>
                <Text style={styles.issueLabel}>Recomendación</Text>
                <Text style={styles.issueValue}>{val(issue.recommendation)}</Text>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

/**
 * Serialize a ReportModel to a PDF binary (Buffer) fully in memory (Node
 * runtime) — apt for the Node export route. Khand in headings, Geist Sans in
 * body, accents preserved, top-N cap, zero PII, sin navegador headless.
 */
export async function toPdf(model: ReportModel): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ReportDocument model={model} />);
}
