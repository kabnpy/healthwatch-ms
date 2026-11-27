// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ClientStatementView } from "./ClientStatementView"

const mockUseClientStatement = vi.fn()
const mockExportPdf = vi.fn()

vi.mock("@/hooks/useStatements", () => ({
  useClientStatement: (clientId: string) => mockUseClientStatement(clientId),
}))

vi.mock("@/hooks/useDocumentJobs", () => ({
  useDocumentPdfExport: () => ({
    exportPdf: mockExportPdf,
    isExporting: false,
  }),
}))

vi.mock("@/components/Documents/CanonicalDocumentViewer", () => ({
  CanonicalDocumentViewer: ({
    resourceType,
    resourceId,
    title,
    onDownloadPdf,
  }: {
    resourceType: string
    resourceId?: string
    title?: string
    onDownloadPdf?: () => void
  }) => (
    <div
      data-testid="canonical-document-viewer"
      data-resource-type={resourceType}
      data-resource-id={resourceId}
    >
      <span>{title}</span>
      {onDownloadPdf && (
        <button type="button" onClick={onDownloadPdf}>
          Download PDF
        </button>
      )}
    </div>
  ),
}))

describe("ClientStatementView", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseClientStatement.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        client_id: "client-1",
        client_name: "Acme Health Ltd",
        kra_pin: "P051111111A",
        ledger_entries: [
          {
            date: "2026-05-01",
            type: "INVOICE",
            reference: "INV-001",
            description: "Invoice INV-001",
            debit: "1000.00",
            credit: "0.00",
            status: "PARTIAL",
            running_balance: "1000.00",
          },
        ],
      },
    })
  })

  it("delegates HTML preview and PDF export to CanonicalDocumentViewer with resourceType='statement'", async () => {
    render(
      <ClientStatementView clientId="client-1" clientName="Acme Health Ltd" />,
    )

    const viewer = screen.getByTestId("canonical-document-viewer")
    expect(viewer.getAttribute("data-resource-type")).toBe("statement")
    expect(viewer.getAttribute("data-resource-id")).toBe("client-1")

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }))
    expect(mockExportPdf).toHaveBeenCalledWith({
      resource_type: "statement",
      resource_id: "client-1",
    })
  })

  it("renders Export CSV button when ledger entries exist", () => {
    render(<ClientStatementView clientId="client-1" />)
    const csvButton = screen.getByRole("button", { name: /Export CSV/i })
    expect(csvButton).toBeTruthy()
    expect((csvButton as HTMLButtonElement).disabled).toBe(false)
  })
})
