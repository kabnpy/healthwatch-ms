import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvalidateQueries = vi.fn()
const mockUseQuery = vi.fn((options: unknown) => options)
const mockUseMutation = vi.fn((options: unknown) => options)

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
  useMutation: (options: unknown) => mockUseMutation(options),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

const mockReadPolicies = vi.fn()
const mockReadPolicy = vi.fn()
const mockCreatePolicy = vi.fn()
const mockUpdatePolicy = vi.fn()
const mockGetPolicyQuote = vi.fn()
const mockReadRiskNotes = vi.fn()
const mockReadRiskNote = vi.fn()
const mockCreateRiskNote = vi.fn()
const mockUpdateRiskNote = vi.fn()
const mockReadProducts = vi.fn()
const mockReadActivities = vi.fn()
const mockCreateActivity = vi.fn()

vi.mock("../client", () => ({
  PoliciesService: {
    readPolicies: (...args: unknown[]) => mockReadPolicies(...args),
    readPolicy: (...args: unknown[]) => mockReadPolicy(...args),
    createPolicy: (...args: unknown[]) => mockCreatePolicy(...args),
    updatePolicy: (...args: unknown[]) => mockUpdatePolicy(...args),
    getPolicyQuote: (...args: unknown[]) => mockGetPolicyQuote(...args),
  },
  RiskNotesService: {
    notesReadRiskNotes: (...args: unknown[]) => mockReadRiskNotes(...args),
    notesReadRiskNote: (...args: unknown[]) => mockReadRiskNote(...args),
    notesCreateRiskNote: (...args: unknown[]) => mockCreateRiskNote(...args),
    notesUpdateRiskNote: (...args: unknown[]) => mockUpdateRiskNote(...args),
  },
  ProductsService: {
    readProducts: (...args: unknown[]) => mockReadProducts(...args),
  },
  ActivitiesService: {
    readActivities: (...args: unknown[]) => mockReadActivities(...args),
    createActivity: (...args: unknown[]) => mockCreateActivity(...args),
  },
}))

import * as useInsurance from "./useInsurance"
import {
  useActivities,
  useCreateActivity,
  useCreatePolicy,
  useCreateRiskNote,
  usePolicies,
  usePolicy,
  usePolicyDashboard,
  useProducts,
  useQuote,
  useQuoteQuery,
  useRiskNote,
  useRiskNotes,
  useUpdatePolicy,
  useUpdateRiskNote,
} from "./usePolicies"

describe("usePolicies domain hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("usePolicies and usePolicy query PoliciesService and unwrap .data", async () => {
    const listPayload = { data: [{ id: "p1" }], count: 1 }
    mockReadPolicies.mockResolvedValueOnce({ data: listPayload })

    const listOpts = usePolicies("c1", 0, 50) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }
    expect(listOpts.queryKey).toEqual([
      "policies",
      { clientId: "c1", skip: 0, limit: 50 },
    ])
    await expect(listOpts.queryFn()).resolves.toEqual(listPayload)

    mockReadPolicy.mockResolvedValueOnce({ data: { id: "p1" } })
    const itemOpts = usePolicy("p1") as unknown as {
      queryKey: unknown[]
      enabled: boolean
      queryFn: () => Promise<unknown>
    }
    expect(itemOpts.queryKey).toEqual(["policies", "p1"])
    expect(itemOpts.enabled).toBe(true)
    await expect(itemOpts.queryFn()).resolves.toEqual({ id: "p1" })
  })

  it("useRiskNotes and useCreateRiskNote manage risk notes and invalidate policies", async () => {
    mockReadRiskNotes.mockResolvedValueOnce({ data: { data: [], count: 0 } })
    const listOpts = useRiskNotes("p1", 0, 10, "c1", true) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }
    expect(listOpts.queryKey).toEqual([
      "risk-notes",
      {
        policyId: "p1",
        skip: 0,
        limit: 10,
        clientId: "c1",
        uninvoicedOnly: true,
      },
    ])
    await expect(listOpts.queryFn()).resolves.toEqual({ data: [], count: 0 })

    const createOpts = useCreateRiskNote() as unknown as {
      onSuccess: () => void
    }
    createOpts.onSuccess()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["risk-notes"],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["policies"],
    })
  })

  it("useProducts, useQuote, useQuoteQuery, and useActivities work as expected", async () => {
    mockReadProducts.mockResolvedValueOnce({ data: { data: [], count: 0 } })
    const prodOpts = useProducts("ins1", 0, 20) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }
    expect(prodOpts.queryKey).toEqual([
      "products",
      { insurerId: "ins1", skip: 0, limit: 20 },
    ])
    await expect(prodOpts.queryFn()).resolves.toEqual({ data: [], count: 0 })

    mockGetPolicyQuote.mockResolvedValueOnce({ data: { total: 100 } })
    const quoteOpts = useQuote() as unknown as {
      mutationFn: (d: unknown) => Promise<unknown>
    }
    await expect(quoteOpts.mutationFn({ product_id: "pr1" })).resolves.toEqual({
      total: 100,
    })

    const quoteQueryDisabled = useQuoteQuery(null) as unknown as {
      enabled: boolean
    }
    expect(quoteQueryDisabled.enabled).toBe(false)

    const actCreateOpts = useCreateActivity() as unknown as {
      onSuccess: (_: unknown, v: { client_id?: string }) => void
    }
    actCreateOpts.onSuccess(undefined, { client_id: "c1" })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activities"],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activities", { clientId: "c1" }],
    })
  })

  it("re-exports policy domain hooks from useInsurance.ts", () => {
    expect(useInsurance.usePolicies).toBe(usePolicies)
    expect(useInsurance.usePolicy).toBe(usePolicy)
    expect(useInsurance.useCreatePolicy).toBe(useCreatePolicy)
    expect(useInsurance.useUpdatePolicy).toBe(useUpdatePolicy)
    expect(useInsurance.useRiskNotes).toBe(useRiskNotes)
    expect(useInsurance.useRiskNote).toBe(useRiskNote)
    expect(useInsurance.useCreateRiskNote).toBe(useCreateRiskNote)
    expect(useInsurance.useUpdateRiskNote).toBe(useUpdateRiskNote)
    expect(useInsurance.useProducts).toBe(useProducts)
    expect(useInsurance.usePolicyDashboard).toBe(usePolicyDashboard)
    expect(useInsurance.useQuote).toBe(useQuote)
    expect(useInsurance.useQuoteQuery).toBe(useQuoteQuery)
    expect(useInsurance.useActivities).toBe(useActivities)
    expect(useInsurance.useCreateActivity).toBe(useCreateActivity)
  })
})
