import { useQuery } from "@tanstack/react-query"
import { client } from "@/client"

export type DocumentPreviewResourceType = "risk_note" | "invoice" | "statement"

interface UseDocumentHtmlPreviewOptions {
  resourceType: DocumentPreviewResourceType
  resourceId?: string
  draftSnapshot?: Record<string, unknown>
}

export function useDocumentHtmlPreview({
  resourceType,
  resourceId,
  draftSnapshot,
}: UseDocumentHtmlPreviewOptions) {
  const hasDraftSnapshot = Boolean(
    draftSnapshot && Object.keys(draftSnapshot).length > 0,
  )

  return useQuery({
    queryKey: [
      "document-html-preview",
      resourceType,
      resourceId ?? null,
      hasDraftSnapshot ? draftSnapshot : null,
    ],
    queryFn: async ({ signal }) => {
      const res = hasDraftSnapshot
        ? await client.post<string>({
            url: "/api/v1/document-jobs/preview/html",
            body: {
              resource_type: resourceType,
              resource_id: resourceId,
              snapshot_data: draftSnapshot,
            },
            headers: {
              "Content-Type": "application/json",
            },
            responseType: "text",
            signal,
          })
        : await client.get<string>({
            url: "/api/v1/document-jobs/preview/html",
            query: {
              resource_type: resourceType,
              ...(resourceId ? { resource_id: resourceId } : {}),
            },
            responseType: "text",
            signal,
          })

      return typeof res.data === "string" ? res.data : ""
    },
  })
}
