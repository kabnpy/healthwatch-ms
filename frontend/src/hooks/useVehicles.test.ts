import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvalidateQueries = vi.fn()
const mockUseQuery = vi.fn((options: unknown) => options)
const mockUseMutation = vi.fn((options: unknown) => options)

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

const mockReadVehicles = vi.fn()
const mockReadVehicle = vi.fn()
const mockCreateVehicle = vi.fn()
const mockUpdateVehicle = vi.fn()
const mockDeleteVehicle = vi.fn()

vi.mock("../client", () => ({
  VehiclesService: {
    readVehicles: (...args: unknown[]) => mockReadVehicles(...args),
    readVehicle: (...args: unknown[]) => mockReadVehicle(...args),
    createVehicle: (...args: unknown[]) => mockCreateVehicle(...args),
    updateVehicle: (...args: unknown[]) => mockUpdateVehicle(...args),
    deleteVehicle: (...args: unknown[]) => mockDeleteVehicle(...args),
  },
}))

import * as useInsurance from "./useInsurance"
import {
  useCreateVehicle,
  useDeleteVehicle,
  useUpdateVehicle,
  useVehicle,
  useVehicles,
} from "./useVehicles"

describe("useVehicles domain hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("useVehicles queries VehiclesService.readVehicles and unwraps .data", async () => {
    const payload = { data: [{ id: "v1" }], count: 1 }
    mockReadVehicles.mockResolvedValueOnce({ data: payload })

    const opts = useVehicles("p1", 0, 50) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }
    expect(opts.queryKey).toEqual([
      "vehicles",
      { policyId: "p1", skip: 0, limit: 50 },
    ])
    await expect(opts.queryFn()).resolves.toEqual(payload)
    expect(mockReadVehicles).toHaveBeenCalledWith({
      query: { policy_id: "p1", skip: 0, limit: 50 },
    })
  })

  it("useVehicle queries by id with enabled guard", async () => {
    mockReadVehicle.mockResolvedValueOnce({ data: { id: "v1" } })
    const opts = useVehicle("v1") as unknown as {
      queryKey: unknown[]
      enabled: boolean
      queryFn: () => Promise<unknown>
    }
    expect(opts.queryKey).toEqual(["vehicles", "v1"])
    expect(opts.enabled).toBe(true)
    await expect(opts.queryFn()).resolves.toEqual({ id: "v1" })
  })

  it("vehicle mutations invalidate vehicles and policies queries", () => {
    const createOpts = useCreateVehicle() as unknown as {
      onSuccess: () => void
    }
    createOpts.onSuccess()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["vehicles"],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["policies"],
    })

    const updateOpts = useUpdateVehicle() as unknown as {
      onSuccess: (_: unknown, v: { id: string }) => void
    }
    updateOpts.onSuccess(undefined, { id: "v1" })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["vehicles", "v1"],
    })

    const deleteOpts = useDeleteVehicle() as unknown as {
      onSuccess: () => void
    }
    deleteOpts.onSuccess()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["policies"],
    })
  })

  it("re-exports vehicle hooks from useInsurance.ts", () => {
    expect(useInsurance.useVehicles).toBe(useVehicles)
    expect(useInsurance.useVehicle).toBe(useVehicle)
    expect(useInsurance.useCreateVehicle).toBe(useCreateVehicle)
    expect(useInsurance.useUpdateVehicle).toBe(useUpdateVehicle)
    expect(useInsurance.useDeleteVehicle).toBe(useDeleteVehicle)
  })
})
