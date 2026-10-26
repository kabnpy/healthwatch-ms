import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ClaimCreate, ClaimsService, type ClaimUpdate } from "../client"

export interface PolicyClaimsAdvocacySummary {
  policy_id: string
  total_earned_premium: string
  total_settled_claims: string
  total_open_reserves: string
  total_incurred_claims: string
  loss_ratio_percent: string
  active_claims_count: number
  settled_claims_count: number
  claim_experience_tier: "FAVORABLE" | "ELEVATED" | "POOR"
}

export const useClaims = (policyId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["claims", { policyId, skip, limit }],
    queryFn: async () =>
      (
        await ClaimsService.readClaims({
          query: { policy_id: policyId, skip, limit },
        })
      ).data,
  })
}

export const useClaim = (id: string) => {
  return useQuery({
    queryKey: ["claims", id],
    queryFn: async () => (await ClaimsService.readClaim({ path: { id } })).data,
    enabled: !!id,
  })
}

export const usePolicyClaimsAdvocacySummary = (policyId?: string) => {
  return useQuery({
    queryKey: ["claims-advocacy-summary", policyId],
    queryFn: async () => {
      const res = await ClaimsService.getPolicyClaimsAdvocacySummary({
        path: { policy_id: policyId! },
      })
      return res.data as PolicyClaimsAdvocacySummary
    },
    enabled: !!policyId,
  })
}

export const useCreateClaim = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ClaimCreate) =>
      (await ClaimsService.createClaim({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] })
      queryClient.invalidateQueries({ queryKey: ["claims-advocacy-summary"] })
    },
  })
}

export const useUpdateClaim = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClaimUpdate }) =>
      (await ClaimsService.updateClaim({ path: { id }, body: data })).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["claims"] })
      queryClient.invalidateQueries({ queryKey: ["claims", id] })
      queryClient.invalidateQueries({ queryKey: ["claims-advocacy-summary"] })
    },
  })
}
