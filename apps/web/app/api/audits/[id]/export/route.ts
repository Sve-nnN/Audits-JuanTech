import { NextResponse } from "next/server";
import { buildReportModel } from "@auditor/report-model";
import { toPdf, toMarkdown, toPptx } from "@auditor/export";

// Runs in the Node runtime (NOT edge): the serializers use pure JS libraries
// (@react-pdf/renderer, pptxgenjs) that need Node APIs; no headless browser is
// involved, so this stays out of the worker and runs on Vercel.
export const runtime = "nodejs";

/** Supported export formats and their download metadata. */
const FORMATS = {
  pdf: {
    ext: "pdf",
    contentType: "application/pdf",
  },
  md: {
    ext: "md",
    contentType: "text/markdown; charset=utf-8",
  },
  pptx: {
    ext: "pptx",
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
} as const;

type ExportFormat = keyof typeof FORMATS;

function isFormat(value: string | null): value is ExportFormat {
  return value === "pdf" || value === "md" || value === "pptx";
}

/** Sanitize the audited domain into a filesystem/header-safe filename token. */
function slugifyDomain(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sitio"
  );
}

/**
 * GET /api/audits/[id]/export?format=pdf|md|pptx
 *
 * Reads the shared ReportModel (Plan 01) and streams the requested format via
 * the matching serializer (Plans 02/03) as an attachment. Access is by
 * `auditId` only — same free-tier visibility as the on-screen report — and the
 * response NEVER carries PII (the ReportModel excludes email/verification
 * token by construction).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format");

  if (!isFormat(format)) {
    return NextResponse.json(
      { error: "Invalid or missing format. Use ?format=pdf|md|pptx" },
      { status: 400 }
    );
  }

  const model = await buildReportModel(id);
  if (!model) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const { ext, contentType } = FORMATS[format];
  const filename = `auditoria-${slugifyDomain(model.audit.domain)}-${id}.${ext}`;

  // `string` for Markdown, binary (`Uint8Array`/`Buffer`) for PDF/PPTX. The Node
  // runtime accepts both as a Response body; the cast bridges the DOM `BodyInit`
  // type (which omits `Uint8Array` in this lib version).
  let body: string | Uint8Array;
  if (format === "md") {
    body = toMarkdown(model);
  } else if (format === "pdf") {
    body = await toPdf(model);
  } else {
    body = await toPptx(model);
  }

  return new Response(body as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
