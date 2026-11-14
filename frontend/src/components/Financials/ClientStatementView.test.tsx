// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ClientStatementView } from "./ClientStatementView"

const mockUseClientStatement = vi.fn()

vi.mock("@/hooks/useStatements", () => ({
  useClientStatement: (clientId: string) => mockUseClientStatement(clientId),
}))

describe("ClientStatementView", () => {
  it("renders server-computed aging_buckets and running_balance without client-side math", () => {
    mockUseClientStatement.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        client_id: "client-1",
        client_name: "Acme Health Ltd",
        kra_pin: "P051111111A",
        total_invoiced: "1000.00",
        total_allocated: "250.00",
        net_outstanding_balance: "750.00",
        unallocated_credits: "0.00",
        invoice_count: 1,
        allocation_count: 1,
        aging_buckets: {
          current_0_30: "100.00",
          days_31_60: "200.00",
          days_61_90: "300.00",
          over_90: "150.00",
          total_overdue: "750.00",
        },
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
          {
            date: "2026-05-10",
            type: "PAYMENT_ALLOCATION",
            reference: "PAY-001",
            description: "Payment allocated to Invoice INV-001",
            debit: "0.00",
            credit: "250.00",
            status: "CLEARED",
            running_balance: "750.00",
          },
        ],
      },
    })

    render(<ClientStatementView clientId="client-1" />)

    expect(screen.getByText(/Total Overdue:.*750\.00/)).toBeTruthy()
    expect(screen.getByText(/100\.00/)).toBeTruthy()
    expect(screen.getByText(/200\.00/)).toBeTruthy()
    expect(screen.getByText(/300\.00/)).toBeTruthy()
    expect(screen.getByText(/150\.00/)).toBeTruthy()
    expect(screen.getByText("INV-001")).toBeTruthy()
    expect(screen.getByText("PAY-001")).toBeTruthy()
  })
})
