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
import { RiskNotesService } from "@/client"
import { RiskNotePrintContent } from "./risk-notes.$id"

const mockNavigate = vi.fn()

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/client", () => ({
  RiskNotesService: {
    notesReadRiskNote: vi.fn(),
  },
}))

vi.mock("@/hooks/useDocumentJobs", () => ({
  useDocumentPdfExport: () => ({
    exportPdf: vi.fn(),
    isExporting: false,
  }),
}))

vi.mock("@/components/Documents/CanonicalDocumentViewer", () => ({
  CanonicalDocumentViewer: ({ title }: { title?: string }) => (
    <div data-testid="mock-canonical-viewer">{title}</div>
  ),
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

describe("RiskNotePrintContent (/print/risk-notes/$id)", () => {
  const originalHistoryLength = Object.getOwnPropertyDescriptor(
    window.history,
    "length",
  )

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(RiskNotesService.notesReadRiskNote).mockResolvedValue({
      data: {
        id: "rn-123",
        risk_note_number: "RN-2026-001",
      },
    } as any)
  })

  afterEach(() => {
    cleanup()
    if (originalHistoryLength) {
      Object.defineProperty(window.history, "length", originalHistoryLength)
    }
  })

  it("uses semantic surface tokens on outer wrapper and renders a print:hidden Back action", async () => {
    const { container } = renderWithQueryClient(
      <RiskNotePrintContent id="rn-123" />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mock-canonical-viewer")).toBeTruthy()
    })

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain("bg-background")
    expect(wrapper.className).toContain("text-foreground")
    expect(wrapper.className).toContain("print:bg-white")
    expect(wrapper.className).not.toMatch(/(^|\s)bg-white(\s|$)/)

    const backButton = screen.getByRole("button", { name: /Back/i })
    expect(backButton).toBeTruthy()
    expect(backButton.closest(".print\\:hidden")).toBeTruthy()
  })

  it("calls window.history.back() when history length > 1", async () => {
    Object.defineProperty(window.history, "length", {
      configurable: true,
      value: 2,
    })
    const backSpy = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => {})

    renderWithQueryClient(<RiskNotePrintContent id="rn-123" />)

    const backButton = await screen.findByRole("button", { name: /Back/i })
    fireEvent.click(backButton)

    expect(backSpy).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
    backSpy.mockRestore()
  })

  it("navigates to /policies when history length <= 1", async () => {
    Object.defineProperty(window.history, "length", {
      configurable: true,
      value: 1,
    })

    renderWithQueryClient(<RiskNotePrintContent id="rn-123" />)

    const backButton = await screen.findByRole("button", { name: /Back/i })
    fireEvent.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/policies" })
  })
})
