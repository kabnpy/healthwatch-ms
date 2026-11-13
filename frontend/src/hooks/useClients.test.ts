import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvalidateQueries = vi.fn()
const mockUseQuery = vi.fn((options: unknown) => options)
const mockUseMutation = vi.fn((options: unknown) => options)

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

const mockReadClients = vi.fn()
const mockReadClient = vi.fn()
const mockCreateClient = vi.fn()
const mockUpdateClient = vi.fn()
const mockDeleteClient = vi.fn()
const mockReadClientCorrespondences = vi.fn()
const mockCreateClientCorrespondence = vi.fn()

vi.mock("../client", () => ({
  ClientsService: {
    readClients: (...args: unknown[]) => mockReadClients(...args),
    readClient: (...args: unknown[]) => mockReadClient(...args),
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    updateClient: (...args: unknown[]) => mockUpdateClient(...args),
    deleteClient: (...args: unknown[]) => mockDeleteClient(...args),
    readClientCorrespondences: (...args: unknown[]) =>
      mockReadClientCorrespondences(...args),
    createClientCorrespondence: (...args: unknown[]) =>
      mockCreateClientCorrespondence(...args),
  },
}))

import {
  useClient,
  useClients,
  useCorrespondences,
  useCreateClient,
  useCreateCorrespondence,
  useDeleteClient,
  useUpdateClient,
} from "./useClients"

describe("useClients domain hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("useClients queries ClientsService.readClients and unwraps .data", async () => {
    const payload = { data: [{ id: "c1" }], count: 1 }
    mockReadClients.mockResolvedValueOnce({ data: payload })

    const opts = useClients(10, 25) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }
    expect(opts.queryKey).toEqual(["clients", { skip: 10, limit: 25 }])
    await expect(opts.queryFn()).resolves.toEqual(payload)
    expect(mockReadClients).toHaveBeenCalledWith({
      query: { skip: 10, limit: 25 },
    })
  })

  it("useClient queries by id with enabled guard", async () => {
    mockReadClient.mockResolvedValueOnce({ data: { id: "c1" } })

    const opts = useClient("c1") as unknown as {
      queryKey: unknown[]
      enabled: boolean
      queryFn: () => Promise<unknown>
    }
    expect(opts.queryKey).toEqual(["clients", "c1"])
    expect(opts.enabled).toBe(true)
    await expect(opts.queryFn()).resolves.toEqual({ id: "c1" })

    const disabled = useClient("") as unknown as { enabled: boolean }
    expect(disabled.enabled).toBe(false)
  })

  it("useCreateClient, useUpdateClient, useDeleteClient invalidate client queries", async () => {
    mockCreateClient.mockResolvedValueOnce({ data: { id: "c1" } })
    const createOpts = useCreateClient() as unknown as {
      mutationFn: (d: unknown) => Promise<unknown>
      onSuccess: () => void
    }
    await expect(createOpts.mutationFn({ name: "Acme" })).resolves.toEqual({
      id: "c1",
    })
    createOpts.onSuccess()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["clients"],
    })

    mockUpdateClient.mockResolvedValueOnce({ data: { id: "c1" } })
    const updateOpts = useUpdateClient() as unknown as {
      mutationFn: (v: { id: string; data: unknown }) => Promise<unknown>
      onSuccess: (_: unknown, v: { id: string }) => void
    }
    await expect(
      updateOpts.mutationFn({ id: "c1", data: { name: "Beta" } }),
    ).resolves.toEqual({ id: "c1" })
    updateOpts.onSuccess(undefined, { id: "c1" })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["clients", "c1"],
    })

    mockDeleteClient.mockResolvedValueOnce({ data: { ok: true } })
    const deleteOpts = useDeleteClient() as unknown as {
      mutationFn: (id: string) => Promise<unknown>
      onSuccess: () => void
    }
    await expect(deleteOpts.mutationFn("c1")).resolves.toEqual({ ok: true })
    deleteOpts.onSuccess()
  })

  it("useCorrespondences and useCreateCorrespondence manage client correspondences", async () => {
    mockReadClientCorrespondences.mockResolvedValueOnce({ data: [] })
    const listOpts = useCorrespondences("c1") as unknown as {
      queryKey: unknown[]
      enabled: boolean
      queryFn: () => Promise<unknown>
    }
    expect(listOpts.queryKey).toEqual(["correspondences", "c1"])
    expect(listOpts.enabled).toBe(true)
    await expect(listOpts.queryFn()).resolves.toEqual([])

    mockCreateClientCorrespondence.mockResolvedValueOnce({ data: { id: "m1" } })
    const createOpts = useCreateCorrespondence() as unknown as {
      mutationFn: (v: { clientId: string; data: unknown }) => Promise<unknown>
      onSuccess: (_: unknown, v: { clientId: string }) => void
    }
    await expect(
      createOpts.mutationFn({ clientId: "c1", data: { subject: "Hi" } }),
    ).resolves.toEqual({ id: "m1" })
    createOpts.onSuccess(undefined, { clientId: "c1" })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["correspondences", "c1"],
    })
  })
})
