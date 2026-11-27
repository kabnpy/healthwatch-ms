// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { InvoicePublic, PaymentRecordPublic } from "@/client"
import { ClientInvoices } from "./ClientInvoices"

const mockAllocateMutateAsync = vi.fn()
const mockReversePaymentMutateAsync = vi.fn()
const mockReverseAllocMutateAsync = vi.fn()
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()

const sampleInvoice: InvoicePublic = {
  id: "inv-1",
  client_id: "client-1",
  invoice_number: "INV-2026-001",
  total_amount: "5000.00",
  balance_due: "2500.00",
  status: "ISSUED",
  issue_date: "2026-01-10",
  due_date: "2026-02-10",
} as unknown as InvoicePublic

const samplePayment: PaymentRecordPublic = {
  id: "pay-1",
  client_id: "client-1",
  amount: "5000.00",
  unallocated_amount: "3000.00",
  payment_method: "MPESA",
  reference_number: "MPESA-XYZ",
  date_received: "2026-01-15",
  status: "CLEARED",
} as unknown as PaymentRecordPublic

vi.mock("@/hooks/useFinancials", () => ({
  useInvoices: () => ({
    data: { data: [sampleInvoice], count: 1 },
    isLoading: false,
  }),
}))

vi.mock("@/hooks/usePayments", () => ({
  usePaymentRecords: () => ({
    data: { data: [samplePayment], count: 1 },
    isLoading: false,
  }),
  useAllocatePayment: () => ({
    mutateAsync: mockAllocateMutateAsync,
    isPending: false,
  }),
  useReversePaymentRecord: () => ({
    mutateAsync: mockReversePaymentMutateAsync,
    isPending: false,
  }),
  useReversePaymentAllocation: () => ({
    mutateAsync: mockReverseAllocMutateAsync,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useCustomToast", () => ({
  default: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

vi.mock("@/components/Financials/ClientStatementView", () => ({
  ClientStatementView: () => <div>ClientStatementView</div>,
}))

vi.mock("@/components/Financials/RecordPaymentModal", () => ({
  RecordPaymentModal: () => null,
}))

vi.mock("@/components/Financials/InvoiceWizard", () => ({
  InvoiceWizard: () => null,
}))

vi.mock("@/components/Documents/DocumentPreviewDrawer", () => ({
  DocumentPreviewDrawer: () => null,
}))

describe("ClientInvoices", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("delegates Allocate Funds to the shared AllocatePaymentDialog with over-allocation guards", async () => {
    render(<ClientInvoices clientId="client-1" />)

    fireEvent.click(screen.getByRole("tab", { name: /payment records/i }))
    fireEvent.click(screen.getByRole("button", { name: /allocate funds/i }))

    // Shared AllocatePaymentDialog renders "Allocate Payment to Invoice"
    expect(await screen.findByText("Allocate Payment to Invoice")).toBeTruthy()
    expect(screen.queryByText("Allocate Cleared Payment Funds")).toBeNull()

    // Over-allocation guard from shared integer-cents dialog
    const amountInput = screen.getByRole("spinbutton")
    fireEvent.change(amountInput, { target: { value: "4000" } })
    expect(
      screen.getByText(/cannot exceed available unallocated funds/i),
    ).toBeTruthy()
  })

  it("delegates Reverse to the shared LedgerReversalDialog", async () => {
    render(<ClientInvoices clientId="client-1" />)

    fireEvent.click(screen.getByRole("tab", { name: /payment records/i }))
    fireEvent.click(screen.getByRole("button", { name: /reverse/i }))

    // Shared LedgerReversalDialog renders "Authorized Ledger Reversal"
    expect(await screen.findByText("Authorized Ledger Reversal")).toBeTruthy()
    expect(screen.queryByText("Authorized Payment Reversal")).toBeNull()

    const reasonInput = screen.getByRole("textbox")
    fireEvent.change(reasonInput, {
      target: { value: "Duplicate MPESA entry" },
    })
    fireEvent.click(screen.getByRole("button", { name: /confirm reversal/i }))

    await waitFor(() => {
      expect(mockReversePaymentMutateAsync).toHaveBeenCalledWith({
        id: "pay-1",
        data: { reversal_reason: "Duplicate MPESA entry" },
      })
    })
  })
})
