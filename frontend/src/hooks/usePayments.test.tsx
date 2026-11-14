// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PaymentAllocationsService, PaymentRecordsService } from "../client"
import {
  useAllocatePayment,
  useCreatePaymentRecord,
  useReversePaymentAllocation,
  useReversePaymentRecord,
} from "./usePayments"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("../client", () => ({
  PaymentRecordsService: {
    recordsCreatePaymentRecord: vi.fn(),
    recordsAllocatePaymentToInvoice: vi.fn(),
    recordsReversePaymentRecord: vi.fn(),
  },
  PaymentAllocationsService: {
    allocationsReversePaymentAllocation: vi.fn(),
  },
}))

const EXPECTED_LEDGER_KEYS = [
  ["payment-records"],
  ["payment-allocations"],
  ["invoices"],
  ["client-statement"],
  ["financial-summary"],
]

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { wrapper, invalidateSpy }
}

describe("usePayments ledger cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("useCreatePaymentRecord invalidates all ledger query keys", async () => {
    vi.mocked(
      PaymentRecordsService.recordsCreatePaymentRecord,
    ).mockResolvedValue({
      data: { id: "pay-1" },
    } as never)

    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useCreatePaymentRecord(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        client_id: "client-1",
        amount: "1000.00",
        payment_method: "MPESA",
      } as never)
    })

    for (const queryKey of EXPECTED_LEDGER_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    }
  })

  it("useAllocatePayment invalidates all ledger query keys and the specific payment record", async () => {
    vi.mocked(
      PaymentRecordsService.recordsAllocatePaymentToInvoice,
    ).mockResolvedValue({
      data: { id: "alloc-1" },
    } as never)

    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useAllocatePayment(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "pay-1",
        data: { invoice_id: "inv-1", amount: "500.00" } as never,
      })
    })

    for (const queryKey of EXPECTED_LEDGER_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    }
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["payment-records", "pay-1"],
    })
  })

  it("useReversePaymentRecord invalidates all ledger query keys", async () => {
    vi.mocked(
      PaymentRecordsService.recordsReversePaymentRecord,
    ).mockResolvedValue({
      data: { id: "pay-1" },
    } as never)

    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useReversePaymentRecord(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "pay-1",
        data: { reason: "Duplicate" } as never,
      })
    })

    for (const queryKey of EXPECTED_LEDGER_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    }
  })

  it("useReversePaymentAllocation invalidates all ledger query keys", async () => {
    vi.mocked(
      PaymentAllocationsService.allocationsReversePaymentAllocation,
    ).mockResolvedValue({
      data: { id: "alloc-1" },
    } as never)

    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useReversePaymentAllocation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: "alloc-1",
        data: { reason: "Wrong invoice" } as never,
      })
    })

    for (const queryKey of EXPECTED_LEDGER_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey })
    }
  })
})
