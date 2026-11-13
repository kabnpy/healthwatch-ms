// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DocumentJobsService } from "@/client"
import { useDocumentPdfExport } from "./useDocumentPdfExport"

vi.mock("@/client", () => ({
  DocumentJobsService: {
    jobsEnqueueDocumentJob: vi.fn(),
    jobsReadDocumentJob: vi.fn(),
    jobsProcessDocumentJob: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useDocumentPdfExport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("enqueues with Idempotency-Key, polls until completed, opens download URL, and never calls process endpoint", async () => {
    vi.mocked(DocumentJobsService.jobsEnqueueDocumentJob).mockResolvedValue({
      data: { id: "job-1", status: "pending" },
    } as any)

    vi.mocked(DocumentJobsService.jobsReadDocumentJob)
      .mockResolvedValueOnce({
        data: { id: "job-1", status: "processing" },
      } as any)
      .mockResolvedValueOnce({
        data: { id: "job-1", status: "succeeded" },
      } as any)

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)

    const { result } = renderHook(() => useDocumentPdfExport(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.exportPdf(
        {
          resource_type: "risk_note" as any,
          resource_id: "rn-1",
        },
        { idempotencyKey: "idem-key-123", pollIntervalMs: 1 },
      )
    })

    expect(DocumentJobsService.jobsEnqueueDocumentJob).toHaveBeenCalledWith({
      body: {
        resource_type: "risk_note",
        resource_id: "rn-1",
      },
      headers: {
        "Idempotency-Key": "idem-key-123",
      },
    })
    expect(DocumentJobsService.jobsReadDocumentJob).toHaveBeenCalledTimes(2)
    expect(DocumentJobsService.jobsProcessDocumentJob).not.toHaveBeenCalled()
    expect(openSpy).toHaveBeenCalledWith(
      "/api/v1/document-jobs/job-1/download",
      "_blank",
    )
    expect(result.current.isExporting).toBe(false)

    openSpy.mockRestore()
  })
})
