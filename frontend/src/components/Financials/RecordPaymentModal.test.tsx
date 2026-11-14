// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecordPaymentModal } from "./RecordPaymentModal"

const mockCreatePayment = vi.fn()
const mockUploadDocument = vi.fn()
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({
    data: {
      data: [{ id: "client-1", name: "Acme Corp" }],
    },
  }),
}))

vi.mock("@/hooks/useFinancials", () => ({
  useInvoices: () => ({
    data: {
      data: [
        {
          id: "inv-1",
          invoice_number: "INV-001",
          balance_due: "1500.00",
        },
      ],
    },
  }),
}))

vi.mock("@/hooks/usePayments", () => ({
  useCreatePaymentRecord: () => ({
    mutateAsync: mockCreatePayment,
    isPending: false,
  }),
  useAllocatePayment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock("@/hooks/useDocuments", () => ({
  useUploadDocument: () => ({
    mutateAsync: mockUploadDocument,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useCustomToast", () => ({
  default: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

describe("RecordPaymentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadDocument.mockResolvedValue({ id: "doc-123" })
    mockCreatePayment.mockResolvedValue({ id: "pay-123" })
  })

  it("uploads proof under Client first and submits PaymentRecord + initial_allocations in one mutation", async () => {
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    render(
      <RecordPaymentModal
        open={true}
        onOpenChange={onOpenChange}
        initialClientId="client-1"
        initialInvoiceId="inv-1"
        initialAmount="1500.00"
        onSuccess={onSuccess}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. QHX472910/i), {
      target: { value: "MPESA123" },
    })

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File(["proof"], "receipt.pdf", { type: "application/pdf" })
    fireEvent.change(fileInput, { target: { files: [file] } })

    fireEvent.submit(document.querySelector("form")!)

    await waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalledWith({
        file,
        entity_type: "Client",
        entity_id: "client-1",
        document_type: "Proof of Payment",
        metadata: {
          method: "mpesa",
          reference: "MPESA123",
        },
      })
    })

    await waitFor(() => {
      expect(mockCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-1",
          amount: "1500.00",
          reference_number: "MPESA123",
          proof_document_id: "doc-123",
          initial_allocations: [
            {
              invoice_id: "inv-1",
              amount: "1500.00",
            },
          ],
        }),
      )
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSuccess).toHaveBeenCalled()
  })
})
