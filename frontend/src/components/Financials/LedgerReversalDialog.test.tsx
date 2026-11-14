// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LedgerReversalDialog } from "./LedgerReversalDialog"

const mockReversePayment = vi.fn()
const mockReverseAllocation = vi.fn()
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()

vi.mock("@/hooks/usePayments", () => ({
  useReversePaymentRecord: () => ({
    mutateAsync: mockReversePayment,
    isPending: false,
  }),
  useReversePaymentAllocation: () => ({
    mutateAsync: mockReverseAllocation,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useCustomToast", () => ({
  default: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

describe("LedgerReversalDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReversePayment.mockResolvedValue({})
    mockReverseAllocation.mockResolvedValue({})
  })

  it("requires a non-blank justification reason and submits payment reversal", async () => {
    const onOpenChange = vi.fn()
    render(
      <LedgerReversalDialog
        target={{ type: "payment", id: "pay-1", title: "Payment MPESA-XYZ" }}
        onOpenChange={onOpenChange}
      />,
    )

    expect(screen.getByText("Payment MPESA-XYZ")).toBeTruthy()
    const submitBtn = screen.getByRole("button", {
      name: "Confirm Reversal",
    }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)

    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "   " } })
    expect(submitBtn.disabled).toBe(true)

    fireEvent.change(textarea, { target: { value: "  Duplicate deposit  " } })
    expect(submitBtn.disabled).toBe(false)

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockReversePayment).toHaveBeenCalledWith({
        id: "pay-1",
        data: { reversal_reason: "Duplicate deposit" },
      })
    })
    expect(mockReverseAllocation).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      "Reversal successfully recorded in audit ledger.",
    )
  })

  it("submits allocation reversal when target type is allocation", async () => {
    const onOpenChange = vi.fn()
    render(
      <LedgerReversalDialog
        target={{ type: "allocation", id: "alloc-1", title: "Allocation abc" }}
        onOpenChange={onOpenChange}
      />,
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Wrong invoice" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Confirm Reversal" }))

    await waitFor(() => {
      expect(mockReverseAllocation).toHaveBeenCalledWith({
        id: "alloc-1",
        data: { reversal_reason: "Wrong invoice" },
      })
    })
    expect(mockReversePayment).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
