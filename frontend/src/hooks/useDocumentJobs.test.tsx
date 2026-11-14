// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DocumentJobsService } from "@/client"
import {
  DOCUMENT_JOBS_QUERY_KEY,
  useDocumentHtmlPreview,
  useDocumentPdfExport,
} from "./useDocumentJobs"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock("@/client", () => ({
  DocumentJobsService: {
    jobsPreviewDocumentHtml: vi.fn(),
    jobsPreviewDocumentHtmlDraft: vi.fn(),
    jobsEnqueueDocumentJob: vi.fn(),
    jobsReadDocumentJob: vi.fn(),
    jobsReadDocumentJobs: vi.fn(),
    jobsDownloadDocumentJobArtifact: vi.fn(),
    jobsProcessDocumentJob: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useDocumentJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("useDocumentHtmlPreview", () => {
    it("fetches HTML preview via DocumentJobsService.jobsPreviewDocumentHtml when no draftSnapshot is provided", async () => {
      vi.mocked(DocumentJobsService.jobsPreviewDocumentHtml).mockResolvedValue({
        data: "<html><body>Risk Note</body></html>",
      } as never)

      const { result } = renderHook(
        () =>
          useDocumentHtmlPreview({
            resourceType: "risk_note",
            resourceId: "rn-123",
          }),
        { wrapper: createWrapper() },
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(DocumentJobsService.jobsPreviewDocumentHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            resource_type: "risk_note",
            resource_id: "rn-123",
          },
        }),
      )
      expect(result.current.data).toBe("<html><body>Risk Note</body></html>")
    })

    it("posts draft snapshot via DocumentJobsService.jobsPreviewDocumentHtmlDraft when draftSnapshot is provided", async () => {
      vi.mocked(
        DocumentJobsService.jobsPreviewDocumentHtmlDraft,
      ).mockResolvedValue({
        data: "<html><body>Draft Risk Note</body></html>",
      } as never)

      const draftSnapshot = { show_stamp: false, special_clauses: ["Clause A"] }
      const { result } = renderHook(
        () =>
          useDocumentHtmlPreview({
            resourceType: "risk_note",
            resourceId: "rn-123",
            draftSnapshot,
          }),
        { wrapper: createWrapper() },
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(
        DocumentJobsService.jobsPreviewDocumentHtmlDraft,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            resource_type: "risk_note",
            resource_id: "rn-123",
            snapshot_data: draftSnapshot,
          },
        }),
      )
      expect(result.current.data).toBe(
        "<html><body>Draft Risk Note</body></html>",
      )
    })
  })

  describe("useDocumentPdfExport", () => {
    it("enqueues, polls until succeeded, invalidates cache, and downloads via DocumentJobsService.jobsDownloadDocumentJobArtifact", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
      const originalCreateObjectURL = URL.createObjectURL
      const originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => "blob:http://localhost/pdf-1")
      URL.revokeObjectURL = vi.fn()

      vi.mocked(DocumentJobsService.jobsEnqueueDocumentJob).mockResolvedValue({
        data: { id: "job-1", status: "pending" },
      } as never)
      vi.mocked(DocumentJobsService.jobsReadDocumentJob)
        .mockResolvedValueOnce({
          data: { id: "job-1", status: "processing" },
        } as never)
        .mockResolvedValueOnce({
          data: { id: "job-1", status: "succeeded" },
        } as never)
      vi.mocked(
        DocumentJobsService.jobsDownloadDocumentJobArtifact,
      ).mockResolvedValue({
        data: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      } as never)

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useDocumentPdfExport(), { wrapper })

      await act(async () => {
        await result.current.exportPdf(
          {
            resource_type: "risk_note",
            resource_id: "rn-1",
          },
          { idempotencyKey: "idem-1", pollIntervalMs: 1, maxPolls: 5 },
        )
      })

      expect(DocumentJobsService.jobsEnqueueDocumentJob).toHaveBeenCalledWith({
        body: {
          resource_type: "risk_note",
          resource_id: "rn-1",
        },
        headers: { "Idempotency-Key": "idem-1" },
      })
      expect(DocumentJobsService.jobsReadDocumentJob).toHaveBeenCalledTimes(2)
      expect(
        DocumentJobsService.jobsDownloadDocumentJobArtifact,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: "job-1" },
          responseType: "blob",
        }),
      )
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: DOCUMENT_JOBS_QUERY_KEY,
      })
      expect(openSpy).toHaveBeenCalledWith(
        "blob:http://localhost/pdf-1",
        "_blank",
      )

      openSpy.mockRestore()
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
    })

    it("surfaces backend error_message via toast.error when job fails", async () => {
      vi.mocked(DocumentJobsService.jobsEnqueueDocumentJob).mockResolvedValue({
        data: { id: "job-2", status: "pending" },
      } as never)
      vi.mocked(DocumentJobsService.jobsReadDocumentJob).mockResolvedValue({
        data: {
          id: "job-2",
          status: "failed",
          error_message: "Renderer crashed",
        },
      } as never)

      const { result } = renderHook(() => useDocumentPdfExport(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(
          result.current.exportPdf(
            {
              resource_type: "invoice",
              resource_id: "inv-1",
            },
            { pollIntervalMs: 1, maxPolls: 3 },
          ),
        ).rejects.toThrow("Renderer crashed")
      })

      expect(toast.error).toHaveBeenCalledWith("Renderer crashed")
    })
  })
})
