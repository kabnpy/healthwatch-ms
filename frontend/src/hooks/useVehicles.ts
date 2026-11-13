import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type VehicleCreate,
  VehiclesService,
  type VehicleUpdate,
} from "../client"

export const useVehicles = (policyId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["vehicles", { policyId, skip, limit }],
    queryFn: async () =>
      (
        await VehiclesService.readVehicles({
          query: { policy_id: policyId, skip, limit },
        })
      ).data,
  })
}

export const useVehicle = (id: string) => {
  return useQuery({
    queryKey: ["vehicles", id],
    queryFn: async () =>
      (await VehiclesService.readVehicle({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateVehicle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: VehicleCreate) =>
      (await VehiclesService.createVehicle({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      queryClient.invalidateQueries({ queryKey: ["policies"] })
    },
  })
}

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VehicleUpdate }) =>
      (
        await VehiclesService.updateVehicle({
          path: { id },
          body: data,
        })
      ).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      queryClient.invalidateQueries({ queryKey: ["vehicles", id] })
    },
  })
}

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await VehiclesService.deleteVehicle({ path: { id } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      queryClient.invalidateQueries({ queryKey: ["policies"] })
    },
  })
}
