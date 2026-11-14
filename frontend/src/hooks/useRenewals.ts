import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type RenewalCreate,
  type RenewalStatus,
  RenewalsService,
  type RenewalTransition,
  type RenewalUpdate,
} from "../client"

export const useRenewals = (
  policyId?: string,
  status?: RenewalStatus,
  skip = 0,
  limit = 100,
) => {
  return useQuery({
    queryKey: ["renewals", { policyId, status, skip, limit }],
    queryFn: async () =>
      (
        await RenewalsService.readRenewals({
          query: { policy_id: policyId, status, skip, limit },
        })
      ).data,
  })
}

export const useRenewal = (id: string) => {
  return useQuery({
    queryKey: ["renewals", id],
    queryFn: async () =>
      (await RenewalsService.readRenewal({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useRenewalsHorizon = () => {
  return useQuery({
    queryKey: ["renewals", "horizon"],
    queryFn: async () => (await RenewalsService.readRenewalsHorizon()).data,
  })
}

export const useCreateRenewal = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: RenewalCreate) =>
      (await RenewalsService.createRenewal({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["renewals"] })
      queryClient.invalidateQueries({ queryKey: ["policies"] })
    },
  })
}

export const useTransitionRenewal = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RenewalTransition }) =>
      (
        await RenewalsService.transitionRenewal({
          path: { id },
          body: data,
        })
      ).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["renewals"] })
      queryClient.invalidateQueries({ queryKey: ["renewals", id] })
    },
  })
}

export const useUpdateRenewal = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RenewalUpdate }) =>
      (
        await RenewalsService.updateRenewal({
          path: { id },
          body: data,
        })
      ).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["renewals"] })
      queryClient.invalidateQueries({ queryKey: ["renewals", id] })
    },
  })
}
