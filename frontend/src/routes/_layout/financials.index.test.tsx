// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mockRefetchSummary = vi.fn()
const mockRefetchInvoices = vi.fn()
const mockRefetchPayments = vi.fn()
const mockRefetchAllocations = vi.fn()

vi.mock("@/hooks/useFinancials", () => ({
  useFinancialSummary: () => ({
    summary: undefined,
    isLoading: false,
    isError: true,
    refetch: mockRefetchSummary,
  }),
  useInvoices: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetchInvoices,
  }),
}))

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock("@/hooks/usePayments", () => ({
  usePaymentRecords: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetchPayments,
  }),
  usePaymentAllocations: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetchAllocations,
  }),
}))

import { Route } from "./financials.index"

afterEach(() => {
  cleanup()
  mockRefetchSummary.mockClear()
  mockRefetchInvoices.mockClear()
  mockRefetchPayments.mockClear()
  mockRefetchAllocations.mockClear()
})

describe("FinancialsHub error handling", () => {
  it("renders QueryErrorBanner on query failure and retries failed queries on click", () => {
    const Component = Route.options.component!
    render(<Component />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load financial data")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetchSummary).toHaveBeenCalledTimes(1)
  })
})
