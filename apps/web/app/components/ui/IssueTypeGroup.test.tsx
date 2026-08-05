// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { ReportIssue, SocialPreviewData } from "@auditor/report-model";
import { IssueTypeGroup } from "./IssueTypeGroup";

afterEach(() => {
  cleanup(); // globals off → desmontar entre tests.
});

/** Construye un ReportIssue mínimo con overrides. */
function makeIssue(over: Partial<ReportIssue> & { id: string }): ReportIssue {
  return {
    id: over.id,
    checkId: over.checkId ?? "CHK",
    category: over.category ?? "onpage",
    title: over.title ?? "Issue",
    severity: over.severity ?? "warning",
    measuredValue: over.measuredValue ?? null,
    source: over.source ?? null,
    criterion: over.criterion ?? null,
    recommendation: over.recommendation ?? null,
    fingerprint: over.fingerprint ?? "fp",
    diffStatus: over.diffStatus ?? null,
    url: over.url ?? null,
    pageId: over.pageId ?? null,
  };
}

/**
 * Dos tipos de issue:
 *  - "Imágenes sin alt text" (IMG-ALT, critical, 2 páginas)
 *  - "Meta description ausente" (META-DESC, warning, 1 página)
 * El helper ordena critical antes que warning, así el DOM debe listar
 * primero el grupo de imágenes y luego el de meta description.
 */
const issues: ReportIssue[] = [
  makeIssue({
    id: "i1",
    checkId: "META-DESC",
    title: "Meta description ausente",
    severity: "warning",
    url: null,
    diffStatus: "new",
  }),
  makeIssue({
    id: "i2",
    checkId: "IMG-ALT",
    title: "Imágenes sin alt text",
    severity: "critical",
    measuredValue: "sin alt",
    url: "https://example.com/a",
  }),
  makeIssue({
    id: "i3",
    checkId: "IMG-ALT",
    title: "Imágenes sin alt text",
    severity: "critical",
    measuredValue: null,
    url: "https://example.com/b/c",
  }),
];

describe("IssueTypeGroup", () => {
  it("renderiza un dropdown por tipo con título y conteo (singular/plural)", () => {
    render(<IssueTypeGroup issues={issues} />);
    expect(screen.getByText("Imágenes sin alt text")).toBeInTheDocument();
    expect(screen.getByText("Meta description ausente")).toBeInTheDocument();
    expect(screen.getByText("2 páginas")).toBeInTheDocument();
    expect(screen.getByText("1 página")).toBeInTheDocument();
  });

  it("respeta el orden del helper: critical (2 páginas) antes que warning (1 página)", () => {
    render(<IssueTypeGroup issues={issues} />);
    const titles = screen
      .getAllByTestId("issue-group-title")
      .map((el) => el.textContent);
    expect(titles).toEqual(["Imágenes sin alt text", "Meta description ausente"]);
  });

  it("expandir un grupo muestra todas sus filas de páginas afectadas sin perder ninguna", () => {
    render(<IssueTypeGroup issues={issues} />);
    const groups = screen.getAllByRole("group");
    // El grupo de imágenes es el primero (orden del helper).
    const imgGroup = groups[0]!;
    // Dos páginas afectadas → dos enlaces (ambas URLs http). Ya no hay
    // role="region" (UI-2): las filas se consultan dentro del propio <details>.
    const links = within(imgGroup).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://example.com/a");
    expect(links[1]).toHaveAttribute("href", "https://example.com/b/c");
    // Valor medido presente para la primera, "—" para la segunda.
    expect(within(imgGroup).getByText("sin alt")).toBeInTheDocument();
  });

  it("renderiza DiffBadge cuando el issue trae diffStatus", () => {
    render(<IssueTypeGroup issues={issues} />);
    // El issue de meta description es "new".
    expect(screen.getByText(/nuevo/i)).toBeInTheDocument();
  });

  it("no renderiza nada cuando la lista de issues está vacía", () => {
    const { container } = render(<IssueTypeGroup issues={[]} />);
    expect(container.querySelectorAll("details")).toHaveLength(0);
  });

  it("monta el panel de preview social antes de la lista de grupos", () => {
    const preview: SocialPreviewData = {
      pageId: "p-1",
      pageUrl: "https://example.com/post",
      domain: "example.com",
      title: "Título social",
      ogTitleDeclared: true,
      description: null,
      ogDescriptionDeclared: false,
      ogImage: null,
      imageStatus: "none",
      ogUrlDeclared: false,
      ogTypeDeclared: false,
      twitterCardDeclared: null,
      twitterCardVariant: "summary",
      twitterTitle: null,
      twitterDescription: null,
      twitterImage: null,
      fixSnippet: null,
    };
    const { container } = render(
      <IssueTypeGroup issues={issues} socialPreviews={[preview]} auditId="audit-1" />
    );
    expect(screen.getByText("Vista previa al compartir")).toBeInTheDocument();
    // El título aparece en el panel de Google y en el de Facebook/LinkedIn: los
    // tres tabs se renderizan siempre, los inactivos con `hidden`.
    expect(screen.getAllByText("Título social")).toHaveLength(2);
    // El panel precede al primer grupo de issues en el orden del DOM.
    const panel = screen.getByText("Vista previa al compartir").closest("section")!;
    const firstGroup = container.querySelector("details")!;
    expect(panel.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("no monta ningún panel cuando no se pasan previews (resto de categorías)", () => {
    render(<IssueTypeGroup issues={issues} />);
    expect(screen.queryByText("Vista previa al compartir")).not.toBeInTheDocument();
  });
});
