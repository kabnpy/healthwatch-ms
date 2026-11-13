// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { client } from "@/client"
import { CanonicalDocumentViewer } from "./CanonicalDocumentViewer"

vi.mock("@/client", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe("CanonicalDocumentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("loads HTML preview via generated client.get without raw fetch or localStorage token reads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem")

    vi.mocked(client.get).mockResolvedValueOnce({
      data: "<html><body><h1>Risk Note Preview</h1></body></html>",
    } as any)

    renderWithQueryClient(
      <CanonicalDocumentViewer
        resourceType="risk_note"
        resourceId="rn-1"
        title="Risk Note"
      />,
    )

    expect(
      screen.getByText("Compiling authoritative document layout..."),
    ).toBeTruthy()

    await waitFor(() => {
      const iframe = document.querySelector("iframe")
      expect(iframe?.getAttribute("srcdoc")).toContain("Risk Note Preview")
    })

    expect(client.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/document-jobs/preview/html",
        query: {
          resource_type: "risk_note",
          resource_id: "rn-1",
        },
        responseType: "text",
      }),
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalledWith("access_token")

    fetchSpy.mockRestore()
    getItemSpy.mockRestore()
  })

  it("loads draft HTML preview via generated client.post when draftSnapshot is provided", async () => {
    vi.mocked(client.post).mockResolvedValueOnce({
      data: "<html><body><h1>Draft Preview</h1></body></html>",
    } as any)

    renderWithQueryClient(
      <CanonicalDocumentViewer
        resourceType="risk_note"
        resourceId="rn-1"
        draftSnapshot={{ include_digital_stamp: false }}
        title="Draft Risk Note"
      />,
    )

    await waitFor(() => {
      const iframe = document.querySelector("iframe")
      expect(iframe?.getAttribute("srcdoc")).toContain("Draft Preview")
    })

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
      }),
    )
  })

  it("renders error state and retries when Retry is clicked", async () => {
    vi.mocked(client.get)
      .mockRejectedValueOnce(new Error("Preview service unavailable"))
      .mockResolvedValueOnce({
        data: "<html><body><h1>Recovered Preview</h1></body></html>",
      } as any)

    renderWithQueryClient(
      <CanonicalDocumentViewer
        resourceType="invoice"
        resourceId="inv-1"
        title="Invoice"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Preview Error")).toBeTruthy()
      expect(screen.getByText("Preview service unavailable")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      const iframe = document.querySelector("iframe")
      expect(iframe?.getAttribute("srcdoc")).toContain("Recovered Preview")
    })
  })
})
