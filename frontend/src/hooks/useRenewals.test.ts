import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvalidateQueries = vi.fn()
const mockUseQuery = vi.fn((options: unknown) => options)
const mockUseMutation = vi.fn((options: unknown) => options)

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

const mockReadRenewals = vi.fn()
const mockReadRenewal = vi.fn()
const mockCreateRenewal = vi.fn()
const mockTransitionRenewal = vi.fn()
const mockUpdateRenewal = vi.fn()

vi.mock("../client", () => ({
  RenewalsService: {
    readRenewals: (...args: unknown[]) => mockReadRenewals(...args),
    readRenewal: (...args: unknown[]) => mockReadRenewal(...args),
    createRenewal: (...args: unknown[]) => mockCreateRenewal(...args),
    transitionRenewal: (...args: unknown[]) => mockTransitionRenewal(...args),
    updateRenewal: (...args: unknown[]) => mockUpdateRenewal(...args),
  },
}))

import {
  useCreateRenewal,
  useRenewal,
  useRenewals,
  useTransitionRenewal,
  useUpdateRenewal,
} from "./useRenewals"

describe("useRenewals domain hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("useRenewals queries RenewalsService.readRenewals and unwraps .data", async () => {
    const payload = { data: [{ id: "r1" }], count: 1 }
    mockReadRenewals.mockResolvedValueOnce({ data: payload })

    const opts = useRenewals("p1", "PENDING" as never, 0, 20) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }
    expect(opts.queryKey).toEqual([
      "renewals",
      { policyId: "p1", status: "PENDING", skip: 0, limit: 20 },
    ])
    await expect(opts.queryFn()).resolves.toEqual(payload)
  })

  it("useRenewal queries by id with enabled guard", async () => {
    mockReadRenewal.mockResolvedValueOnce({ data: { id: "r1" } })
    const opts = useRenewal("r1") as unknown as {
      queryKey: unknown[]
      enabled: boolean
      queryFn: () => Promise<unknown>
    }
    expect(opts.queryKey).toEqual(["renewals", "r1"])
    expect(opts.enabled).toBe(true)
    await expect(opts.queryFn()).resolves.toEqual({ id: "r1" })
  })

  it("renewal mutations invalidate renewals and policies queries", () => {
    const createOpts = useCreateRenewal() as unknown as {
      onSuccess: () => void
    }
    createOpts.onSuccess()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["renewals"],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["policies"],
    })

    const transitionOpts = useTransitionRenewal() as unknown as {
      onSuccess: (_: unknown, v: { id: string }) => void
    }
    transitionOpts.onSuccess(undefined, { id: "r1" })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["renewals", "r1"],
    })

    const updateOpts = useUpdateRenewal() as unknown as {
      onSuccess: (_: unknown, v: { id: string }) => void
    }
    updateOpts.onSuccess(undefined, { id: "r1" })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["renewals", "r1"],
    })
  })
})
