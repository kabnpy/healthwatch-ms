// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DocumentPreviewTarget } from "@/hooks/useDocumentPreviewSession"
import { DocumentPreviewDrawer } from "./DocumentPreviewDrawer"

const mockSetIncludeDigitalStamp = vi.fn()
const mockSetSpecialConditions = vi.fn()
const mockHandleGenerateServerPdf = vi.fn()
const mockHandleInsertClause = vi.fn()
const mockHandleSaveClauses = vi.fn()

vi.mock("@/hooks/useDocumentPreviewSession", () => ({
  PRESET_CLAUSES: [
    {
      name: "Tracker Warranty",
      snippet: "- **Tracker Warranty:** Fitted within 14 days.",
    },
  ],
  useDocumentPreviewSession: () => ({
    includeDigitalStamp: true,
    setIncludeDigitalStamp: mockSetIncludeDigitalStamp,
    specialConditions: "Existing condition",
    setSpecialConditions: mockSetSpecialConditions,
    isGeneratingPdf: false,
    isSavingClauses: false,
    validation: { isValid: true, missingFields: [] },
    draftSnapshot: { special_conditions: "Existing condition" },
    handleGenerateServerPdf: mockHandleGenerateServerPdf,
    handleInsertClause: mockHandleInsertClause,
    handleSaveClauses: mockHandleSaveClauses,
  }),
}))

vi.mock("./CanonicalDocumentViewer", () => ({
  CanonicalDocumentViewer: ({
    resourceType,
    resourceId,
    title,
  }: {
    resourceType: string
    resourceId: string
    title?: string
  }) => (
    <div data-testid="canonical-document-viewer">
      {resourceType}:{resourceId}:{title}
    </div>
  ),
}))

type RiskNoteTarget = Extract<DocumentPreviewTarget, { kind: "risk_note" }>

const mockRiskNote = {
  id: "rn-123",
  risk_note_number: "RN-2026-001",
  status: "Draft",
  policy_id: "pol-1",
} as unknown as RiskNoteTarget["riskNote"]

const mockPolicy = {
  id: "pol-1",
  policy_number: "POL-2026-001",
  product: { name: "Motor Private Comprehensive" },
} as unknown as RiskNoteTarget["policy"]

describe("DocumentPreviewDrawer", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders RiskNote mode with digital stamp toggle, PDF export, and Clause Studio", () => {
    render(
      <DocumentPreviewDrawer
        isOpen={true}
        onOpenChange={vi.fn()}
        target={{
          kind: "risk_note",
          riskNote: mockRiskNote,
          policy: mockPolicy,
        }}
      />,
    )

    expect(screen.getByText("Policy Schedule")).toBeTruthy()
    expect(screen.getByText("Motor Private Comprehensive")).toBeTruthy()
    expect(
      screen.getByTestId("canonical-document-viewer").textContent,
    ).toContain("risk_note:rn-123:Motor Private Comprehensive")

    // Digital stamp toggle
    const stampCheckbox = screen.getByRole("checkbox")
    fireEvent.click(stampCheckbox)
    expect(mockSetIncludeDigitalStamp).toHaveBeenCalledWith(false)

    // PDF export
    fireEvent.click(screen.getByRole("button", { name: /Official PDF/i }))
    expect(mockHandleGenerateServerPdf).toHaveBeenCalledTimes(1)

    // Switch to Clause Studio tab
    fireEvent.click(screen.getByText(/Clauses Studio/i))
    expect(screen.getByText("Warranties & Special Conditions")).toBeTruthy()

    // Insert preset clause
    fireEvent.click(
      screen.getByRole("button", { name: /\+ Tracker Warranty/i }),
    )
    expect(mockHandleInsertClause).toHaveBeenCalledWith(
      "- **Tracker Warranty:** Fitted within 14 days.",
    )

    // Save clauses
    fireEvent.click(screen.getByRole("button", { name: /Save Clauses/i }))
    expect(mockHandleSaveClauses).toHaveBeenCalledTimes(1)
  })

  it("renders Invoice mode as read-only preview with PDF export and without Clause Studio", () => {
    render(
      <DocumentPreviewDrawer
        isOpen={true}
        onOpenChange={vi.fn()}
        target={{
          kind: "invoice",
          invoiceId: "inv-456",
          invoiceNumber: "INV-2026-009",
        }}
      />,
    )

    expect(screen.getByText("Invoice / Debit Note")).toBeTruthy()
    expect(screen.getByText("Invoice - INV-2026-009")).toBeTruthy()
    expect(
      screen.getByTestId("canonical-document-viewer").textContent,
    ).toContain("invoice:inv-456:Invoice - INV-2026-009")

    // Clause Studio and Digital Stamp should not be rendered in Invoice mode
    expect(screen.queryByRole("button", { name: /Clause Studio/i })).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()

    // PDF export
    fireEvent.click(screen.getByRole("button", { name: /Official PDF/i }))
    expect(mockHandleGenerateServerPdf).toHaveBeenCalledTimes(1)
  })
})
