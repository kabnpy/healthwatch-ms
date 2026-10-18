import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ClientCreate,
  ClientsService,
  type ClientUpdate,
  FinancialsService,
  PoliciesService,
  type PolicyCreateExtended,
  type PolicyUpdate,
  ProductsService,
  type QuoteRequest,
  type RiskNoteCreate,
  RiskNotesService,
  type RiskNoteUpdate,
} from "../client"

// 1. CLIENTS
export const useClients = (skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["clients", { skip, limit }],
    queryFn: async () =>
      (await ClientsService.readClients({ query: { skip, limit } })).data,
  })
}

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () =>
      (await ClientsService.readClient({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ClientCreate) =>
      (await ClientsService.createClient({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}

export const useUpdateClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClientUpdate }) =>
      (await ClientsService.updateClient({ path: { id }, body: data })).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["clients", id] })
    },
  })
}

export const useDeleteClient = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await ClientsService.deleteClient({ path: { id } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}

// 2. POLICIES
export const usePolicies = (clientId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["policies", { clientId, skip, limit }],
    queryFn: async () =>
      (
        await PoliciesService.readPolicies({
          query: { client_id: clientId, skip, limit },
        })
      ).data,
  })
}

export const usePolicy = (id: string) => {
  return useQuery({
    queryKey: ["policies", id],
    queryFn: async () =>
      (await PoliciesService.readPolicy({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreatePolicy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: PolicyCreateExtended) =>
      (await PoliciesService.createPolicy({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] })
    },
  })
}

export const useUpdatePolicy = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PolicyUpdate }) =>
      (await PoliciesService.updatePolicy({ path: { id }, body: data })).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] })
      queryClient.invalidateQueries({ queryKey: ["policies", id] })
    },
  })
}

// 3. RISK NOTES
export const useRiskNotes = (
  policyId?: string,
  skip = 0,
  limit = 100,
  clientId?: string,
  uninvoicedOnly?: boolean,
) => {
  return useQuery({
    queryKey: [
      "risk-notes",
      { policyId, skip, limit, clientId, uninvoicedOnly },
    ],
    queryFn: async () =>
      (
        await RiskNotesService.notesReadRiskNotes({
          query: {
            policy_id: policyId,
            skip,
            limit,
            client_id: clientId,
            uninvoiced_only: uninvoicedOnly,
          },
        })
      ).data,
  })
}

export const useRiskNote = (id: string) => {
  return useQuery({
    queryKey: ["risk-notes", id],
    queryFn: async () =>
      (await RiskNotesService.notesReadRiskNote({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateRiskNote = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: RiskNoteCreate) =>
      (await RiskNotesService.notesCreateRiskNote({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk-notes"] })
      queryClient.invalidateQueries({ queryKey: ["policies"] })
    },
  })
}

export const useUpdateRiskNote = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RiskNoteUpdate }) =>
      (await RiskNotesService.notesUpdateRiskNote({ path: { id }, body: data }))
        .data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["risk-notes"] })
      queryClient.invalidateQueries({ queryKey: ["risk-notes", id] })
    },
  })
}

// 4. PRODUCTS
export const useProducts = (insurerId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["products", { insurerId, skip, limit }],
    queryFn: async () =>
      (
        await ProductsService.readProducts({
          query: { insurer_id: insurerId, skip, limit },
        })
      ).data,
  })
}

// 5. DASHBOARD AGGREGATOR
export const usePolicyDashboard = (policyId: string) => {
  const policyQuery = usePolicy(policyId)
  const riskNotesQuery = useRiskNotes(policyId)

  // The backend now provides the active_note directly in the policy response
  const policy = policyQuery.data
  const latestRiskNote = policy?.active_note || riskNotesQuery.data?.data?.[0]

  // Enhanced Policy for UI backwards compatibility where needed,
  // but pointing to the new atomic locations.
  const enhancedPolicy = policy
    ? {
        ...policy,
        // Legacy field mapping for existing components
        current_risk_details: latestRiskNote?.cover_snapshot || {},
        total_premium: latestRiskNote?.total_amount || 0,
        coverage_start: latestRiskNote?.coverage_start,
        coverage_end: latestRiskNote?.coverage_end,
      }
    : undefined

  return {
    policy: enhancedPolicy,
    latestRiskNote,
    riskNotes: riskNotesQuery.data?.data || [],
    isLoading: policyQuery.isLoading || riskNotesQuery.isLoading,
    error: policyQuery.error || riskNotesQuery.error,
  }
}

// 6. CORRESPONDENCE / DOCUMENTS
export const useCorrespondences = (clientId: string) => {
  return useQuery({
    queryKey: ["correspondences", clientId],
    queryFn: async () =>
      (
        await ClientsService.readClientCorrespondences({
          path: { id: clientId },
        })
      ).data,
    enabled: !!clientId,
  })
}

export const useCreateCorrespondence = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: string; data: any }) =>
      (
        await ClientsService.createClientCorrespondence({
          path: { id: clientId },
          body: data,
        })
      ).data,
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["correspondences", clientId] })
    },
  })
}

// 7. FINANCIALS (Invoices & Receipts)
export const useInvoices = (clientId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["invoices", { clientId, skip, limit }],
    queryFn: async () =>
      (
        await FinancialsService.readInvoices({
          query: { client_id: clientId, skip, limit },
        })
      ).data,
  })
}

export const useReceipts = (clientId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["receipts", { clientId, skip, limit }],
    queryFn: async () =>
      (
        await FinancialsService.readReceipts({
          query: { client_id: clientId, skip, limit },
        })
      ).data,
  })
}

// 8. RATING / QUOTES
export const useQuote = () => {
  return useMutation({
    mutationFn: async (data: QuoteRequest) =>
      (await PoliciesService.getPolicyQuote({ body: data })).data,
  })
}

export const useQuoteQuery = (data: QuoteRequest | null) => {
  return useQuery({
    queryKey: ["quote", data],
    queryFn: async () => {
      if (!data) return Promise.reject("No data")
      return (await PoliciesService.getPolicyQuote({ body: data })).data
    },
    enabled: !!data && !!data.product_id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
