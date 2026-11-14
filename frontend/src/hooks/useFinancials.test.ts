// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FinancialsService } from "../client"
import { useFinancialSummary } from "./useFinancials"

vi.mock("../client", () => ({
  FinancialsService: {
    readInvoices: vi.fn(),
    readInvoice: vi.fn(),
    createBulkInvoice: vi.fn(),
    readFinancialSummary: vi.fn(),
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useFinancialSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches server-side LedgerSummary and exposes numeric KPIs", async () => {
    vi.mocked(FinancialsService.readFinancialSummary).mockResolvedValue({
      data: {
        total_invoiced: "125000.50",
        total_paid: "80000.25",
        total_due: "45000.25",
        total_unallocated: "15000.00",
      },
    } as never)

    const { result } = renderHook(() => useFinancialSummary("client-123"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(FinancialsService.readFinancialSummary).toHaveBeenCalledWith({
      query: { client_id: "client-123" },
    })
    expect(result.current.summary).toEqual({
      totalInvoiced: 125000.5,
      totalPaid: 80000.25,
      totalDue: 45000.25,
      totalUnallocated: 15000,
    })
  })
})
