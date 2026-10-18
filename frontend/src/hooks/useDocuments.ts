import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { DocumentsService } from "../client"

export const useDocuments = (entityId?: string, entityType?: string) => {
  return useQuery({
    queryKey: ["documents", { entityId, entityType }],
    queryFn: async () =>
      (
        await DocumentsService.readDocuments({
          query: {
            entity_id: entityId ?? null,
            entity_type: entityType ?? null,
          },
        })
      ).data,
    enabled: !!entityId,
  })
}

export const useUploadDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      file: File
      entity_type: string
      entity_id: string
      document_type: string
      metadata?: Record<string, any>
    }) => {
      return (
        await DocumentsService.uploadDocument({
          body: {
            file: data.file,
            entity_type: data.entity_type,
            entity_id: data.entity_id,
            document_type: data.document_type,
            metadata_json: data.metadata ? JSON.stringify(data.metadata) : "",
          },
        })
      ).data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["documents", { entityId: data.entity_id }],
      })
      toast.success("File uploaded successfully")
    },
    onError: (error: any) => {
      toast.error(`Upload failed: ${error.message || "Unknown error"}`)
    },
  })
}

export const useDeleteDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) =>
      (await DocumentsService.removeDocument({ path: { id } })).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["documents", { entityId: data.entity_id }],
      })
      toast.success("Document deleted")
    },
  })
}
