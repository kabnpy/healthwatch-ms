// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockRefetchSummary = vi.fn()
const mockRefetchInvoices = vi.fn()
const mockRefetchPayments = vi.fn()
const mockRefetchAllocations = vi.fn()

const mockUseFinancialSummary = vi.fn()
const mockUseInvoices = vi.fn()
const mockUseClients = vi.fn()
const mockUsePaymentRecords = vi.fn()
const mockUsePaymentAllocations = vi.fn()

vi.mock("@/hooks/useFinancials", () => ({
  useFinancialSummary: () => mockUseFinancialSummary(),
  useInvoices: () => mockUseInvoices(),
}))

vi.mock("@/hooks/useClients", () => ({
  useClients: () => mockUseClients(),
}))

vi.mock("@/hooks/usePayments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/usePayments")>()
  return {
    ...actual,
    usePaymentRecords: () => mockUsePaymentRecords(),
    usePaymentAllocations: () => mockUsePaymentAllocations(),
    useAllocatePayment: () => ({ mutate: vi.fn(), isPending: false }),
    useRecordPayment: () => ({ mutate: vi.fn(), isPending: false }),
    useReversePaymentRecord: () => ({ mutate: vi.fn(), isPending: false }),
    useReverseAllocation: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    Link: ({ children, to, params, ...props }: any) => {
      let href = typeof to === "string" ? to : "#"
      if (params?.clientId) {
        href = href.replace("$clientId", params.clientId)
      }
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    },
  }
})

import { Route } from "./financials.index"

beforeEach(() => {
  mockUseFinancialSummary.mockReturnValue({
    summary: {
      totalInvoiced: 1612000,
      totalPaid: 1612000,
      totalDue: 0,
    },
    isLoading: false,
    isError: false,
    refetch: mockRefetchSummary,
  })
  mockUseInvoices.mockReturnValue({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: mockRefetchInvoices,
  })
  mockUseClients.mockReturnValue({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
  mockUsePaymentRecords.mockReturnValue({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: mockRefetchPayments,
  })
  mockUsePaymentAllocations.mockReturnValue({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: mockRefetchAllocations,
  })
})

afterEach(() => {
  cleanup()
  mockRefetchSummary.mockClear()
  mockRefetchInvoices.mockClear()
  mockRefetchPayments.mockClear()
  mockRefetchAllocations.mockClear()
})

describe("FinancialsHub error handling", () => {
  it("renders QueryErrorBanner on query failure and retries failed queries on click", () => {
    mockUseFinancialSummary.mockReturnValue({
      summary: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetchSummary,
    })
    const Component = Route.options.component!
    render(<Component />)

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Failed to load financial data")

    const retryButton = screen.getByRole("button", { name: /retry/i })
    fireEvent.click(retryButton)
    expect(mockRefetchSummary).toHaveBeenCalledTimes(1)
  })
})

describe("FinancialsHub UX & formatting (#168)", () => {
  const renderWithQuery = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const Component = Route.options.component!
    return render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>,
    )
  }

  it("renders only one search input on Payment Records, Invoices, and Allocations tabs", () => {
    renderWithQuery()

    // Payment Records tab (default)
    expect(screen.getAllByPlaceholderText(/search/i)).toHaveLength(1)

    // Switch to Invoices tab
    fireEvent.click(screen.getByRole("tab", { name: /invoices/i }))
    expect(screen.getAllByPlaceholderText(/search/i)).toHaveLength(1)

    // Switch to Allocations tab
    fireEvent.click(screen.getByRole("tab", { name: /allocations/i }))
    expect(screen.getAllByPlaceholderText(/search/i)).toHaveLength(1)
  })

  it("formats all KES amounts in KPI cards and tables to 2 decimal places with tabular-nums", () => {
    mockUsePaymentRecords.mockReturnValue({
      data: {
        data: [
          {
            id: "pay-1",
            client_id: "c-1",
            payment_method: "BANK_TRANSFER",
            reference_number: "REF-001",
            payment_date: "2026-01-15",
            amount: "50000",
            unallocated_amount: "0",
            status: "active",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchPayments,
    })
    mockUseInvoices.mockReturnValue({
      data: {
        data: [
          {
            id: "inv-1",
            client_id: "c-1",
            invoice_number: "INV-001",
            issue_date: "2026-01-10",
            due_date: "2026-02-10",
            total_amount: "100000",
            balance_due: "25000",
            status: "partial",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchInvoices,
    })
    mockUsePaymentAllocations.mockReturnValue({
      data: {
        data: [
          {
            id: "alloc-1",
            payment_record_id: "pay-1",
            invoice_id: "inv-1",
            amount: "50000",
            allocated_at: "2026-01-15T10:00:00Z",
            status: "active",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchAllocations,
    })

    renderWithQuery()

    // KPI cards
    const kpiValues = screen.getAllByText(/1,612,000\.00/)
    expect(kpiValues.length).toBeGreaterThanOrEqual(2)
    for (const el of kpiValues) {
      expect(el.className).toContain("tabular-nums")
    }
    const zeroKpis = screen.getAllByText(/0\.00/)
    expect(zeroKpis.length).toBeGreaterThanOrEqual(2)

    // Payment Records table
    const payAmounts = screen.getAllByText(/50,000\.00/)
    expect(payAmounts[0].className).toContain("tabular-nums")

    // Invoices table
    fireEvent.click(screen.getByRole("tab", { name: /invoices/i }))
    expect(screen.getAllByText(/100,000\.00/)[0].className).toContain(
      "tabular-nums",
    )
    expect(
      screen.getAllByText(/25,000\.00/)[0].closest("[class*='tabular-nums']"),
    ).not.toBeNull()

    // Allocations table
    fireEvent.click(screen.getByRole("tab", { name: /allocations/i }))
    expect(screen.getAllByText(/^\+.*50,000\.00$/)[0].className).toContain(
      "tabular-nums",
    )
  })

  it("formats payment channel badges and title-cases status badges without raw enum strings", () => {
    mockUsePaymentRecords.mockReturnValue({
      data: {
        data: [
          {
            id: "pay-1",
            client_id: "c-1",
            payment_method: "BANK_TRANSFER",
            reference_number: "REF-001",
            payment_date: "2026-01-15",
            amount: "50000",
            unallocated_amount: "0",
            status: "active",
          },
          {
            id: "pay-2",
            client_id: "c-1",
            payment_method: "MPESA",
            reference_number: "REF-002",
            payment_date: "2026-01-16",
            amount: "10000",
            unallocated_amount: "0",
            status: "reversed",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchPayments,
    })

    renderWithQuery()

    expect(screen.getAllByText("Bank Transfer").length).toBeGreaterThan(0)
    expect(screen.getAllByText("M-Pesa").length).toBeGreaterThan(0)
    expect(screen.queryByText("BANK_TRANSFER")).toBeNull()
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Reversed").length).toBeGreaterThan(0)
    expect(screen.queryByText("active")).toBeNull()
  })

  it("renders 0-value KPI cards in neutral styling, standard primary Record Payment button, and GLOSSARY copy", () => {
    renderWithQuery()

    // Outstanding Balance at 0 -> neutral styling (no rose- classes)
    const outstandingTitle = screen.getByText("Outstanding Balance")
    expect(outstandingTitle.className).not.toContain("rose-")
    const outstandingCard = outstandingTitle.closest("[data-slot='card']")!
    expect(outstandingCard.className).not.toContain("rose-")

    // Unallocated Funds at 0 -> neutral styling (no amber- classes)
    const unallocTitle = screen.getByText("Unallocated Funds")
    const unallocCard = unallocTitle.closest("[data-slot='card']")!
    expect(unallocCard.innerHTML).not.toContain("amber-")

    // Standard primary button for Record Payment
    const recordBtn = screen.getByRole("button", { name: /record payment/i })
    expect(recordBtn.className).not.toContain("bg-emerald-600")

    // GLOSSARY.md copy
    expect(screen.getByText(/bank & M-Pesa/i)).toBeTruthy()
    expect(screen.queryByText(/agency accounts/i)).toBeNull()
  })

  it("links client names in Payment Records and Invoices to /clients/$clientId/policies", () => {
    mockUseClients.mockReturnValue({
      data: { data: [{ id: "c-1", name: "Acme Corp" }], count: 1 },
    })
    mockUsePaymentRecords.mockReturnValue({
      data: {
        data: [
          {
            id: "p-1",
            client_id: "c-1",
            amount: 50000,
            unallocated_amount: 10000,
            payment_method: "MPESA",
            payment_date: "2026-04-01",
            status: "active",
            reference_number: "MP123",
          },
        ],
        count: 1,
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchPayments,
    })

    renderWithQuery()

    const clientLinks = screen.getAllByRole("link", { name: "Acme Corp" })
    expect(clientLinks.length).toBeGreaterThan(0)
    for (const link of clientLinks) {
      expect(link.getAttribute("href")).toBe("/clients/c-1/policies")
    }
  })

  it("keeps Allocate directly accessible and moves Reverse into a ... row actions menu", () => {
    mockUseClients.mockReturnValue({
      data: { data: [{ id: "c-1", name: "Acme Corp" }], count: 1 },
    })
    mockUsePaymentRecords.mockReturnValue({
      data: {
        data: [
          {
            id: "p-1",
            client_id: "c-1",
            amount: 50000,
            unallocated_amount: 10000,
            payment_method: "MPESA",
            payment_date: "2026-04-01",
            status: "active",
            reference_number: "MP123",
          },
        ],
        count: 1,
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetchPayments,
    })

    renderWithQuery()

    // Allocate is directly accessible
    expect(
      screen.getAllByRole("button", { name: /^allocate$/i }).length,
    ).toBeGreaterThan(0)
    // Reverse is NOT exposed as a bare button
    expect(screen.queryByRole("button", { name: /^reverse$/i })).toBeNull()
    // ... row actions menu trigger is present
    expect(
      screen.getAllByRole("button", { name: /row actions/i }).length,
    ).toBeGreaterThan(0)
  })
})

describe("FinancialsHub lazy per-tab querying (#214)", () => {
  it("fires only the active tab ledger query on mount and fetches other tabs lazily on switch", () => {
    mockUseFinancialSummary.mockClear()
    mockUseClients.mockClear()
    mockUsePaymentRecords.mockClear()
    mockUseInvoices.mockClear()
    mockUsePaymentAllocations.mockClear()

    const Component = Route.options.component!
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={qc}>
        <Component />
      </QueryClientProvider>,
    )

    expect(mockUseFinancialSummary).toHaveBeenCalled()
    expect(mockUseClients).toHaveBeenCalled()
    expect(mockUsePaymentRecords).toHaveBeenCalled()
    expect(mockUseInvoices).not.toHaveBeenCalled()
    expect(mockUsePaymentAllocations).not.toHaveBeenCalled()

    // Switch to Invoices tab
    fireEvent.click(screen.getByRole("tab", { name: /invoices/i }))
    expect(mockUseInvoices).toHaveBeenCalled()
    expect(mockUsePaymentAllocations).not.toHaveBeenCalled()

    // Switch to Allocations tab
    fireEvent.click(screen.getByRole("tab", { name: /allocations/i }))
    expect(mockUsePaymentAllocations).toHaveBeenCalled()
  })
})
