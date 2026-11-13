import { useQuery } from "@tanstack/react-query"
import { DocumentsService } from "@/client"

interface UseFileDocumentOptions {
  id?: string
  receiptId?: string
}

/**
 * Fetches document metadata by document ID or receipt ID, unwrapping `.data`
 * from the generated OpenAPI client responses.
 */
export function useFileDocument({ id, receiptId }: UseFileDocumentOptions) {
  return useQuery({
    queryKey: ["document-metadata", id, receiptId],
    queryFn: async () => {
      if (id) {
        return (await DocumentsService.readDocumentById({ path: { id } })).data
      }
      if (receiptId) {
        const docs = (
          await DocumentsService.readDocuments({
            query: {
              entity_id: receiptId,
              entity_type: "Receipt",
            },
          })
        ).data
        return docs.data[0] || null
      }
      return null
    },
  })
}
