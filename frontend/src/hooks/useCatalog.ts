import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type InsurerCreate,
  InsurersService,
  type InsurerUpdate,
  type ProductCreate,
  ProductsService,
  type ProductUpdate,
} from "../client"

// 1. INSURERS
export const useInsurers = (skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["insurers", { skip, limit }],
    queryFn: async () =>
      (await InsurersService.readInsurers({ query: { skip, limit } })).data,
  })
}

export const useInsurer = (id: string) => {
  return useQuery({
    queryKey: ["insurers", id],
    queryFn: async () =>
      (await InsurersService.readInsurer({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateInsurer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: InsurerCreate) =>
      (await InsurersService.createInsurer({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurers"] })
    },
  })
}

export const useUpdateInsurer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsurerUpdate }) =>
      (await InsurersService.updateInsurer({ path: { id }, body: data })).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["insurers"] })
      queryClient.invalidateQueries({ queryKey: ["insurers", id] })
    },
  })
}

export const useDeleteInsurer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await InsurersService.deleteInsurer({ path: { id } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurers"] })
    },
  })
}

// 2. PRODUCTS
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

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () =>
      (await ProductsService.readProduct({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ProductCreate) =>
      (await ProductsService.createProduct({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductUpdate }) =>
      (await ProductsService.updateProduct({ path: { id }, body: data })).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["products", id] })
    },
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await ProductsService.deleteProduct({ path: { id } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
