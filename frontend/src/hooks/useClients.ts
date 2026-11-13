import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ClientCreate, ClientsService, type ClientUpdate } from "../client"

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
