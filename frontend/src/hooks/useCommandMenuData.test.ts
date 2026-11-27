// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ClientsService,
  DashboardService,
  FinancialsService,
  PaymentRecordsService,
  PoliciesService,
} from "@/client"
import { useCommandMenuData } from "./useCommandMenuData"

vi.mock("@/client", () => ({
  ClientsService: { readClients: vi.fn() },
  PoliciesService: { readPolicies: vi.fn() },
  FinancialsService: { readInvoices: vi.fn() },
  PaymentRecordsService: { recordsReadPaymentRecords: vi.fn() },
  DashboardService: { readDashboardSummary: vi.fn() },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useCommandMenuData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not fire any queries while closed", () => {
    const { result } = renderHook(() => useCommandMenuData(false), {
      wrapper: createWrapper(),
    })

    expect(result.current.clients).toEqual([])
    expect(result.current.policies).toEqual([])
    expect(result.current.invoices).toEqual([])
    expect(result.current.payments).toEqual([])
    expect(result.current.expiringPolicies).toEqual([])

    expect(ClientsService.readClients).not.toHaveBeenCalled()
    expect(PoliciesService.readPolicies).not.toHaveBeenCalled()
    expect(FinancialsService.readInvoices).not.toHaveBeenCalled()
    expect(
      PaymentRecordsService.recordsReadPaymentRecords,
    ).not.toHaveBeenCalled()
    expect(DashboardService.readDashboardSummary).not.toHaveBeenCalled()
  })

  it("populates expiringPolicies from dashboard summary and loads lists when opened", async () => {
    const expiringItem = {
      policy: {
        id: "pol-1",
        client_id: "cli-1",
        policy_number: "POL-2026-001",
      },
      days_left: 7,
      client_name: "Acme Ltd",
    }

    vi.mocked(ClientsService.readClients).mockResolvedValue({
      data: { data: [{ id: "cli-1", name: "Acme Ltd" }] },
    } as never)
    vi.mocked(PoliciesService.readPolicies).mockResolvedValue({
      data: { data: [{ id: "pol-1", policy_number: "POL-2026-001" }] },
    } as never)
    vi.mocked(FinancialsService.readInvoices).mockResolvedValue({
      data: { data: [{ id: "inv-1", invoice_number: "INV-001" }] },
    } as never)
    vi.mocked(
      PaymentRecordsService.recordsReadPaymentRecords,
    ).mockResolvedValue({
      data: { data: [{ id: "pay-1", receipt_number: "RCPT-001" }] },
    } as never)
    vi.mocked(DashboardService.readDashboardSummary).mockResolvedValue({
      data: {
        active_count: 1,
        expiring_30_count: 1,
        expiring_30: [expiringItem],
        in_flight_renewals_count: 0,
        in_flight_renewals: [],
      },
    } as never)

    const { result } = renderHook(() => useCommandMenuData(true), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.expiringPolicies).toEqual([expiringItem])
    })

    expect(result.current.clients).toHaveLength(1)
    expect(result.current.policies).toHaveLength(1)
    expect(result.current.invoices).toHaveLength(1)
    expect(result.current.payments).toHaveLength(1)
    expect(DashboardService.readDashboardSummary).toHaveBeenCalledTimes(1)
  })
})
