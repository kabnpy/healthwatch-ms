import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { type DocumentJobEnqueueRequest, DocumentJobsService } from "@/client"

export interface ExportPdfOptions {
  idempotencyKey?: string
  pollIntervalMs?: number
  maxPolls?: number
}

const DEFAULT_POLL_INTERVAL_MS = 1000
const DEFAULT_MAX_POLLS = 30

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
      const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
      const maxPolls = options?.maxPolls ?? DEFAULT_MAX_POLLS

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

        queryClient.invalidateQueries({ queryKey: ["document-jobs"] })

        let current = enqueued
        let polls = 0
        while (
          current.status !== "succeeded" &&
          current.status !== "failed" &&
          polls < maxPolls
        ) {
          await sleep(pollIntervalMs)
          const pollRes = await DocumentJobsService.jobsReadDocumentJob({
            path: { id: enqueued.id },
          })
          current = pollRes.data
          polls += 1
        }

        if (current.status === "failed") {
          throw new Error(
            current.error_message || "Document PDF generation failed",
          )
        }

        if (current.status !== "succeeded") {
          throw new Error("Document PDF generation timed out")
        }

        queryClient.invalidateQueries({ queryKey: ["document-jobs"] })
        window.open(`/api/v1/document-jobs/${enqueued.id}/download`, "_blank")
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
