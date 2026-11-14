import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import {
  type DocumentJobEnqueueRequest,
  type DocumentJobPublic,
  DocumentJobsService,
} from "../client"

export const DOCUMENT_JOBS_QUERY_KEY = ["document-jobs"] as const

export const DEFAULT_DOCUMENT_JOB_POLL_INTERVAL_MS = 1000
export const DEFAULT_DOCUMENT_JOB_MAX_POLLS = 30

export type DocumentPreviewResourceType = "risk_note" | "invoice" | "statement"

export interface UseDocumentHtmlPreviewOptions {
  resourceType: DocumentPreviewResourceType
  resourceId?: string
  draftSnapshot?: Record<string, unknown>
}

export interface ExportPdfOptions {
  idempotencyKey?: string
  pollIntervalMs?: number
  maxPolls?: number
}

export interface PollDocumentJobOptions {
  jobId: string
  initialJob?: DocumentJobPublic
  pollIntervalMs?: number
  maxPolls?: number
  queryClient?: QueryClient
}

export function isTerminalDocumentJobStatus(status?: string | null): boolean {
  return status === "succeeded" || status === "failed"
}

export function isActiveDocumentJobStatus(status?: string | null): boolean {
  return status === "pending" || status === "processing"
}

export function invalidateDocumentJobs(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: DOCUMENT_JOBS_QUERY_KEY })
}

export function formatDocumentJobError(
  job?: Pick<DocumentJobPublic, "status" | "error_message"> | null,
): Error {
  if (job?.status === "failed") {
    return new Error(job.error_message || "Document PDF generation failed")
  }
  return new Error("Document PDF generation timed out")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function downloadDocumentJobArtifact(
  jobId: string,
): Promise<void> {
  const res = await DocumentJobsService.jobsDownloadDocumentJobArtifact({
    path: { id: jobId },
    responseType: "blob",
  })
  const blob =
    res.data instanceof Blob
      ? res.data
      : new Blob([res.data as BlobPart], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function pollDocumentJobUntilTerminal({
  jobId,
  initialJob,
  pollIntervalMs = DEFAULT_DOCUMENT_JOB_POLL_INTERVAL_MS,
  maxPolls = DEFAULT_DOCUMENT_JOB_MAX_POLLS,
  queryClient,
}: PollDocumentJobOptions): Promise<DocumentJobPublic> {
  let current = initialJob
  let polls = 0

  while (!isTerminalDocumentJobStatus(current?.status) && polls < maxPolls) {
    await sleep(pollIntervalMs)
    const pollRes = await DocumentJobsService.jobsReadDocumentJob({
      path: { id: jobId },
    })
    current = pollRes.data
    polls += 1
  }

  if (current?.status !== "succeeded") {
    throw formatDocumentJobError(current)
  }

  if (queryClient) {
    invalidateDocumentJobs(queryClient)
  }

  return current
}

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
        ? await DocumentJobsService.jobsPreviewDocumentHtmlDraft({
            body: {
              resource_type: resourceType,
              resource_id: resourceId,
              snapshot_data: draftSnapshot,
            },
            signal,
          })
        : await DocumentJobsService.jobsPreviewDocumentHtml({
            query: {
              resource_type: resourceType,
              ...(resourceId ? { resource_id: resourceId } : {}),
            },
            signal,
          })

      return typeof res.data === "string" ? res.data : ""
    },
  })
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

        await downloadDocumentJobArtifact(enqueued.id)
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
