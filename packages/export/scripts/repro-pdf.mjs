/**
 * Standalone REAL-render reproduction for the PDF export crash.
 *
 *   TypeError: Cannot read properties of undefined (reading 'S')
 *     at toPdf (packages/export/src/pdf.tsx) -> renderToBuffer(<ReportDocument/>)
 *
 * Root cause under test: @react-pdf/reconciler reads React's client shared
 * internals (`__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`)
 * and touches its dispatcher slot `.S`. In a Next.js App Router server layer the
 * `react-server` export condition resolves the RSC build of React, which does
 * NOT export client internals -> the object is undefined -> `undefined.S`.
 *
 * Run it two ways:
 *   node packages/export/scripts/repro-pdf.mjs                 # client build -> OK
 *   node --conditions=react-server packages/export/scripts/repro-pdf.mjs   # RSC build -> reproduces the crash
 *
 * This uses @react-pdf/renderer directly (its own JS reconciler render path,
 * the exact one pdf.tsx exercises) with a minimal but realistic document that
 * mirrors ReportDocument: Khand headings + Geist Sans body, accents, many rows.
 */
import { writeFileSync } from "node:fs";
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
import { createElement as h } from "react";

const fontsDir = new URL("../src/fonts/", import.meta.url);
const fontUrl = (file) => fileURLToPath(new URL(file, fontsDir));

Font.register({
  family: "Khand",
  fonts: [
    { src: fontUrl("Khand-Regular.ttf"), fontWeight: 400 },
    { src: fontUrl("Khand-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.register({
  family: "GeistSans",
  src: fontUrl("GeistSans-Regular.ttf"),
  fontWeight: 400,
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { fontFamily: "GeistSans", fontSize: 10, padding: 44 },
  title: { fontFamily: "Khand", fontWeight: 600, fontSize: 30 },
  heading: { fontFamily: "Khand", fontWeight: 600, fontSize: 18, marginTop: 16 },
  body: { fontFamily: "GeistSans", fontSize: 10 },
});

function Doc() {
  return h(
    Document,
    { title: "Auditoría web — example.com", author: "juan-tech.com" },
    h(
      Page,
      { size: "A4", style: styles.page, wrap: true },
      h(Text, { style: styles.title }, "Auditoría web"),
      h(Text, { style: styles.heading }, "Scores por categoría"),
      ...Array.from({ length: 20 }, (_, i) =>
        h(
          View,
          { key: i },
          h(
            Text,
            { style: styles.body },
            `Issue número ${i}: configuración de canónicos áéíóúñ¿¡`
          )
        )
      )
    )
  );
}

const out = "/tmp/repro.pdf";
try {
  const buf = await renderToBuffer(h(Doc));
  writeFileSync(out, buf);
  const header = buf.subarray(0, 5).toString("latin1");
  console.log(
    `OK: wrote ${out} (${buf.length} bytes, header ${JSON.stringify(header)})`
  );
  if (header !== "%PDF-") {
    console.error("FAIL: not a %PDF- file");
    process.exit(1);
  }
} catch (err) {
  console.error("REPRODUCED CRASH:", err);
  process.exit(1);
}
