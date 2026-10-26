import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type DocumentJobEnqueueRequest,
  type DocumentJobPublic,
  DocumentJobsService,
} from "../client"

export const useDocumentJobs = (skip = 0, limit = 50) => {
  return useQuery({
    queryKey: ["document-jobs", { skip, limit }],
    queryFn: async () =>
      (
        await DocumentJobsService.jobsReadDocumentJobs({
          query: { skip, limit },
        })
      ).data,
    refetchInterval: 4000,
  })
}

export const useDocumentJob = (id: string) => {
  return useQuery({
    queryKey: ["document-jobs", id],
    queryFn: async () =>
      (await DocumentJobsService.jobsReadDocumentJob({ path: { id } })).data,
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as DocumentJobPublic | undefined
      if (data?.status === "pending" || data?.status === "processing") {
        return 2000
      }
      return false
    },
  })
}

export const useEnqueueDocumentJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: DocumentJobEnqueueRequest) =>
      (await DocumentJobsService.jobsEnqueueDocumentJob({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-jobs"] })
    },
  })
}

export const useProcessDocumentJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await DocumentJobsService.jobsProcessDocumentJob({ path: { id } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-jobs"] })
    },
  })
}
