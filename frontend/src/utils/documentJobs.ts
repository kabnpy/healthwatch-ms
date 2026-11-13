import type { QueryClient } from "@tanstack/react-query"
import { type DocumentJobPublic, DocumentJobsService } from "@/client"

export const DOCUMENT_JOBS_QUERY_KEY = ["document-jobs"] as const

export const DEFAULT_DOCUMENT_JOB_POLL_INTERVAL_MS = 1000
export const DEFAULT_DOCUMENT_JOB_MAX_POLLS = 30

export function isTerminalDocumentJobStatus(status?: string | null): boolean {
  return status === "succeeded" || status === "failed"
}

export function isActiveDocumentJobStatus(status?: string | null): boolean {
  return status === "pending" || status === "processing"
}

export function invalidateDocumentJobs(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: DOCUMENT_JOBS_QUERY_KEY })
}

export function getDocumentJobDownloadUrl(jobId: string): string {
  return `/api/v1/document-jobs/${jobId}/download`
}

export function openDocumentJobDownload(jobId: string): void {
  window.open(getDocumentJobDownloadUrl(jobId), "_blank")
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

export interface PollDocumentJobOptions {
  jobId: string
  initialJob?: DocumentJobPublic
  pollIntervalMs?: number
  maxPolls?: number
  queryClient?: QueryClient
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
