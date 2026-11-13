// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { client } from "@/client"
import { useDocumentHtmlPreview } from "./useDocumentHtmlPreview"

vi.mock("@/client", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useDocumentHtmlPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches saved HTML preview via client.get with AbortSignal", async () => {
    vi.mocked(client.get).mockResolvedValueOnce({
      data: "<html><body>Saved</body></html>",
    } as any)

    const { result } = renderHook(
      () =>
        useDocumentHtmlPreview({
          resourceType: "risk_note",
          resourceId: "rn-1",
        }),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe("<html><body>Saved</body></html>")
    expect(client.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/document-jobs/preview/html",
        query: {
          resource_type: "risk_note",
          resource_id: "rn-1",
        },
        responseType: "text",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("fetches draft HTML preview via client.post when draftSnapshot is provided", async () => {
    vi.mocked(client.post).mockResolvedValueOnce({
      data: "<html><body>Draft</body></html>",
    } as any)

    const { result } = renderHook(
      () =>
        useDocumentHtmlPreview({
          resourceType: "risk_note",
          resourceId: "rn-1",
          draftSnapshot: { include_digital_stamp: false },
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe("<html><body>Draft</body></html>")
    expect(client.post).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/document-jobs/preview/html",
        body: {
          resource_type: "risk_note",
          resource_id: "rn-1",
          snapshot_data: { include_digital_stamp: false },
        },
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "text",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("exposes error state and recovers on refetch", async () => {
    vi.mocked(client.get)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        data: "<html><body>Recovered</body></html>",
      } as any)

    const { result } = renderHook(
      () =>
        useDocumentHtmlPreview({
          resourceType: "invoice",
          resourceId: "inv-1",
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe("Network error")

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.data).toBe("<html><body>Recovered</body></html>")
    })
    expect(result.current.isError).toBe(false)
  })
})
