import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { type DocumentJobEnqueueRequest, DocumentJobsService } from "@/client"
import {
  invalidateDocumentJobs,
  openDocumentJobDownload,
  pollDocumentJobUntilTerminal,
} from "@/utils/documentJobs"

export interface ExportPdfOptions {
  idempotencyKey?: string
  pollIntervalMs?: number
  maxPolls?: number
}

export function useDocumentPdfExport() {
  const queryClient = useQueryClient()
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = useCallback(
    async (
      request: DocumentJobEnqueueRequest,
      options?: ExportPdfOptions,
    ): Promise<void> => {
      const idempotencyKey = options?.idempotencyKey ?? crypto.randomUUID()

      setIsExporting(true)
      try {
        const enqueueRes = await DocumentJobsService.jobsEnqueueDocumentJob({
          body: request,
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
        })
        const enqueued = enqueueRes.data
        if (!enqueued?.id) {
          throw new Error("Document job enqueue did not return a job ID")
        }

        invalidateDocumentJobs(queryClient)

        await pollDocumentJobUntilTerminal({
          jobId: enqueued.id,
          initialJob: enqueued,
          pollIntervalMs: options?.pollIntervalMs,
          maxPolls: options?.maxPolls,
          queryClient,
        })

        openDocumentJobDownload(enqueued.id)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate official PDF"
        toast.error(message)
        throw err
      } finally {
        setIsExporting(false)
      }
    },
    [queryClient],
  )

  return {
    exportPdf,
    isExporting,
  }
}
