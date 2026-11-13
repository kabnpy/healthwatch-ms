// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
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

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
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

  it("propagates failed job error_message, shows toast, and resets isExporting", async () => {
    vi.mocked(DocumentJobsService.jobsEnqueueDocumentJob).mockResolvedValue({
      data: { id: "job-2", status: "pending" },
    } as any)

    vi.mocked(DocumentJobsService.jobsReadDocumentJob).mockResolvedValueOnce({
      data: {
        id: "job-2",
        status: "failed",
        error_message: "Renderer crashed",
      },
    } as any)

    const { result } = renderHook(() => useDocumentPdfExport(), {
      wrapper: createWrapper(),
    })

    let caughtError: unknown
    await act(async () => {
      try {
        await result.current.exportPdf(
          { resource_type: "invoice" as any, resource_id: "inv-1" },
          { idempotencyKey: "idem-fail", pollIntervalMs: 1 },
        )
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toBe("Renderer crashed")
    expect(toast.error).toHaveBeenCalledWith("Renderer crashed")
    expect(result.current.isExporting).toBe(false)
  })

  it("throws timeout error when maxPolls is exhausted without terminal status", async () => {
    vi.mocked(DocumentJobsService.jobsEnqueueDocumentJob).mockResolvedValue({
      data: { id: "job-3", status: "pending" },
    } as any)

    vi.mocked(DocumentJobsService.jobsReadDocumentJob).mockResolvedValue({
      data: { id: "job-3", status: "processing" },
    } as any)

    const { result } = renderHook(() => useDocumentPdfExport(), {
      wrapper: createWrapper(),
    })

    let caughtError: unknown
    await act(async () => {
      try {
        await result.current.exportPdf(
          { resource_type: "risk_note" as any, resource_id: "rn-2" },
          { idempotencyKey: "idem-timeout", pollIntervalMs: 1, maxPolls: 2 },
        )
      } catch (err) {
        caughtError = err
      }
    })

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toBe(
      "Document PDF generation timed out",
    )
    expect(DocumentJobsService.jobsReadDocumentJob).toHaveBeenCalledTimes(2)
    expect(toast.error).toHaveBeenCalledWith("Document PDF generation timed out")
    expect(result.current.isExporting).toBe(false)
  })

  it("invalidates document-jobs queries on enqueue and completion", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    vi.mocked(DocumentJobsService.jobsEnqueueDocumentJob).mockResolvedValue({
      data: { id: "job-4", status: "pending" },
    } as any)
    vi.mocked(DocumentJobsService.jobsReadDocumentJob).mockResolvedValueOnce({
      data: { id: "job-4", status: "succeeded" },
    } as any)

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)

    const { result } = renderHook(() => useDocumentPdfExport(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.exportPdf(
        { resource_type: "risk_note" as any, resource_id: "rn-3" },
        { idempotencyKey: "idem-cache", pollIntervalMs: 1 },
      )
    })

    expect(invalidateSpy).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
      queryKey: ["document-jobs"],
    })
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      queryKey: ["document-jobs"],
    })

    openSpy.mockRestore()
  })
})
