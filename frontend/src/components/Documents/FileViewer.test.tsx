// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DocumentsService } from "@/client"
import { FileViewer } from "./FileViewer"

vi.mock("@/client", () => ({
  client: {
    getConfig: vi.fn(() => ({ baseURL: "http://localhost:8000" })),
  },
  DocumentsService: {
    readDocumentById: vi.fn(),
    readDocuments: vi.fn(),
  },
}))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe("FileViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders an uploaded image document with download action", async () => {
    vi.mocked(DocumentsService.readDocumentById).mockResolvedValueOnce({
      data: {
        id: "doc-1",
        document_type: "National ID",
        mime_type: "image/png",
      },
    } as any)

    renderWithQuery(<FileViewer id="doc-1" />)

    await waitFor(() => {
      const img = screen.getByRole("img", { name: "National ID" })
      expect(img.getAttribute("src")).toBe(
        "http://localhost:8000/api/v1/documents/doc-1/download",
      )
    })

    expect(screen.getByRole("button", { name: /pop out/i })).toBeTruthy()
  })

  it("renders an uploaded PDF document in an iframe and opens download URL on Pop Out", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    vi.mocked(DocumentsService.readDocumentById).mockResolvedValueOnce({
      data: {
        id: "doc-pdf-1",
        document_type: "KRA PIN",
        mime_type: "application/pdf",
      },
    } as any)

    renderWithQuery(<FileViewer id="doc-pdf-1" />)

    await waitFor(() => {
      const iframe = screen.getByTitle("KRA PIN")
      expect(iframe.getAttribute("src")).toBe(
        "http://localhost:8000/api/v1/documents/doc-pdf-1/download",
      )
    })

    screen.getByRole("button", { name: /pop out/i }).click()
    expect(openSpy).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/documents/doc-pdf-1/download",
      "_blank",
    )
    openSpy.mockRestore()
  })

  it("renders an error fallback state when the document fails to load", async () => {
    vi.mocked(DocumentsService.readDocumentById).mockRejectedValueOnce(
      new Error("Not found"),
    )

    renderWithQuery(<FileViewer id="missing-doc" />)

    await waitFor(() => {
      expect(screen.getByText("Unable to load document")).toBeTruthy()
      expect(screen.getByText(/missing-doc/)).toBeTruthy()
    })
  })

  it("loads receipt proof-of-payment document by receiptId", async () => {
    vi.mocked(DocumentsService.readDocuments).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "doc-rcp-1",
            document_type: "Proof of Payment",
            mime_type: "application/pdf",
          },
        ],
      },
    } as any)

    renderWithQuery(<FileViewer receiptId="rcp-1" />)

    await waitFor(() => {
      expect(screen.getByTitle("Proof of Payment")).toBeTruthy()
    })

    expect(DocumentsService.readDocuments).toHaveBeenCalledWith({
      query: {
        entity_id: "rcp-1",
        entity_type: "Receipt",
      },
    })
  })
})
