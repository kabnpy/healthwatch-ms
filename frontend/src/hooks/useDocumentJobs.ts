import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DOCUMENT_JOBS_QUERY_KEY,
  invalidateDocumentJobs,
  isActiveDocumentJobStatus,
} from "@/utils/documentJobs"
import {
  type DocumentJobEnqueueRequest,
  type DocumentJobPublic,
  DocumentJobsService,
} from "../client"

export const useDocumentJobs = (skip = 0, limit = 50) => {
  return useQuery({
    queryKey: [...DOCUMENT_JOBS_QUERY_KEY, { skip, limit }],
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
    queryKey: [...DOCUMENT_JOBS_QUERY_KEY, id],
    queryFn: async () =>
      (await DocumentJobsService.jobsReadDocumentJob({ path: { id } })).data,
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as DocumentJobPublic | undefined
      if (isActiveDocumentJobStatus(data?.status)) {
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
      invalidateDocumentJobs(queryClient)
    },
  })
}

export const useProcessDocumentJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await DocumentJobsService.jobsProcessDocumentJob({ path: { id } })).data,
    onSuccess: () => {
      invalidateDocumentJobs(queryClient)
    },
  })
}
