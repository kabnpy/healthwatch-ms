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
const mockCreateEndorsement = vi.fn()
const mockReadRiskNotes = vi.fn()
const mockReadRiskNote = vi.fn()
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
    createEndorsement: (...args: unknown[]) => mockCreateEndorsement(...args),
  },
  RiskNotesService: {
    notesReadRiskNotes: (...args: unknown[]) => mockReadRiskNotes(...args),
    notesReadRiskNote: (...args: unknown[]) => mockReadRiskNote(...args),
  },
  ProductsService: {
    readProducts: (...args: unknown[]) => mockReadProducts(...args),
  },
  ActivitiesService: {
    readActivities: (...args: unknown[]) => mockReadActivities(...args),
    createActivity: (...args: unknown[]) => mockCreateActivity(...args),
  },
}))

import {
  useCreateActivity,
  useCreateEndorsement,
  usePolicies,
  usePolicy,
  useProducts,
  useQuote,
  useQuoteQuery,
  useRiskNotes,
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

    mockCreateEndorsement.mockResolvedValueOnce({ data: { id: "rn2" } })
    const createOpts = useCreateEndorsement() as unknown as {
      mutationFn: (vars: {
        policyId: string
        data: {
          updated_risk_details: Record<string, unknown>
          change_description: string
        }
      }) => Promise<unknown>
      onSuccess: () => void
    }
    await expect(
      createOpts.mutationFn({
        policyId: "p1",
        data: {
          updated_risk_details: { sum_insured: 1200000 },
          change_description: "Increase sum insured",
        },
      }),
    ).resolves.toEqual({ id: "rn2" })
    expect(mockCreateEndorsement).toHaveBeenCalledWith({
      path: { id: "p1" },
      body: {
        updated_risk_details: { sum_insured: 1200000 },
        change_description: "Increase sum insured",
      },
    })
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
})
