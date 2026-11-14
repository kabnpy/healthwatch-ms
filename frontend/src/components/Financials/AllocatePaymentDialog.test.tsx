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
import { AllocatePaymentDialog } from "./AllocatePaymentDialog"

const mockMutateAsync = vi.fn()
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()

vi.mock("@/hooks/usePayments", () => ({
  useAllocatePayment: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

vi.mock("@/hooks/useCustomToast", () => ({
  default: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

const baseRecord: PaymentRecordPublic = {
  id: "pay-1",
  client_id: "client-1",
  amount: "5000.00",
  unallocated_amount: "3000.00",
  payment_method: "MPESA",
  reference_number: "MPESA-XYZ",
  date_received: "2026-01-15",
  status: "CLEARED",
} as unknown as PaymentRecordPublic

const invoices: InvoicePublic[] = [
  {
    id: "inv-1",
    client_id: "client-1",
    invoice_number: "INV-001",
    balance_due: "4500.00",
  } as InvoicePublic,
  {
    id: "inv-2",
    client_id: "client-1",
    invoice_number: "INV-002",
    balance_due: "1200.00",
  } as InvoicePublic,
  {
    id: "inv-paid",
    client_id: "client-1",
    invoice_number: "INV-PAID",
    balance_due: "0.00",
  } as InvoicePublic,
  {
    id: "inv-other",
    client_id: "client-2",
    invoice_number: "INV-OTHER",
    balance_due: "2000.00",
  } as InvoicePublic,
]

describe("AllocatePaymentDialog", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockMutateAsync.mockResolvedValue({})
  })

  it("caps auto-filled amount to min(unallocated, balance_due) and submits allocation", async () => {
    const onOpenChange = vi.fn()
    render(
      <AllocatePaymentDialog
        record={baseRecord}
        invoices={invoices}
        onOpenChange={onOpenChange}
      />,
    )

    expect(screen.getByText("MPESA-XYZ")).toBeTruthy()
    expect(screen.getByText(/KES 3,000/)).toBeTruthy()

    // Select INV-001 (due 4500, available 3000 -> capped to 3000)
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("INV-001"))

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement
    expect(amountInput.value).toBe("3000")

    // Select INV-002 (due 1200, available 3000 -> auto-filled to 1200)
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("INV-002"))
    expect(amountInput.value).toBe("1200")

    fireEvent.click(screen.getByRole("button", { name: "Post Allocation" }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "pay-1",
        data: {
          payment_record_id: "pay-1",
          invoice_id: "inv-2",
          amount: "1200.00",
        },
      })
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      "Payment funds allocated successfully.",
    )
  })

  it("shows empty state when client has no open invoices and disables submission", () => {
    render(
      <AllocatePaymentDialog
        record={baseRecord}
        invoices={invoices.filter((i) => i.client_id !== "client-1")}
        onOpenChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        "No open invoices with balance due found for this client.",
      ),
    ).toBeTruthy()
    const submitBtn = screen.getByRole("button", {
      name: "Post Allocation",
    }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it("validates positive allocation amount before submitting", async () => {
    render(
      <AllocatePaymentDialog
        record={baseRecord}
        invoices={invoices}
        onOpenChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("INV-001"))

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: "0" } })

    const form = amountInput.closest("form")!
    fireEvent.submit(form)

    expect(mockMutateAsync).not.toHaveBeenCalled()
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      "Please enter a valid positive allocation amount.",
    )
  })

  it("displays live remaining unallocated amount and invoice balance due as amount changes", () => {
    render(
      <AllocatePaymentDialog
        record={baseRecord}
        invoices={invoices}
        onOpenChange={vi.fn()}
      />,
    )

    // Select INV-001 (balance_due: 4500.00, unallocated: 3000.00)
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("INV-001"))

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: "1250.25" } })

    // Remaining unallocated: 3000.00 - 1250.25 = 1,749.75
    expect(screen.getByText(/1,749\.75/)).toBeTruthy()
    // Remaining invoice balance: 4500.00 - 1250.25 = 3,249.75
    expect(screen.getByText(/3,249\.75/)).toBeTruthy()
  })

  it("blocks over-allocation when amount exceeds unallocated_amount or invoice.balance_due", () => {
    render(
      <AllocatePaymentDialog
        record={baseRecord}
        invoices={invoices}
        onOpenChange={vi.fn()}
      />,
    )

    // Select INV-001 (balance_due: 4500.00, unallocated: 3000.00)
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("INV-001"))

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement
    const submitBtn = screen.getByRole("button", {
      name: "Post Allocation",
    }) as HTMLButtonElement

    // Exceeds unallocated_amount (3000.00) by 0.01
    fireEvent.change(amountInput, { target: { value: "3000.01" } })
    expect(
      screen.getByText(
        "Allocation amount cannot exceed available unallocated funds.",
      ),
    ).toBeTruthy()
    expect(submitBtn.disabled).toBe(true)

    // Select INV-002 (balance_due: 1200.00, unallocated: 3000.00)
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("INV-002"))

    // Exceeds invoice.balance_due (1200.00) by 0.01
    fireEvent.change(amountInput, { target: { value: "1200.01" } })
    expect(
      screen.getByText("Allocation amount cannot exceed invoice balance due."),
    ).toBeTruthy()
    expect(submitBtn.disabled).toBe(true)

    fireEvent.submit(amountInput.closest("form")!)
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })
})
