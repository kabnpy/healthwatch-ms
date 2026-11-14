// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CalculationsService, ProductsService } from "@/client"
import { AdvisoryRatingCalculator } from "./AdvisoryRatingCalculator"

vi.mock("@/client", async () => {
  const actual = await vi.importActual<typeof import("@/client")>("@/client")
  return {
    ...actual,
    CalculationsService: {
      quotePreview: vi.fn(),
    },
    PoliciesService: {
      getPolicyQuote: vi.fn(),
    },
    ProductsService: {
      readProducts: vi.fn(),
    },
  }
})

function renderWithQuery(ui: React.ReactElement) {
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

describe("AdvisoryRatingCalculator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ProductsService.readProducts).mockResolvedValue({
      data: { data: [], count: 0 },
    } as never)
  })

  it("calls the backend quote endpoint and displays authoritative totals, StatutoryLevy breakdown, and rule_provenance", async () => {
    vi.mocked(CalculationsService.quotePreview).mockResolvedValue({
      data: {
        basic_premium: "90000.00",
        net_premium: "100000.00",
        training_levy: "200.00",
        phcf: "250.00",
        stamp_duty: "40.00",
        total_taxes: "490.00",
        total_premium: "100490.00",
        total_amount: "100490.00",
        calculation_detail: {
          base_premium: "90000.00",
          applied_rate: "4.5",
          benefits: [
            { name: "PVT", amount: "5000.00" },
            { name: "Excess Protector", amount: "5000.00" },
          ],
        },
        rule_provenance: {
          rate_table_version_id: "rtv-123",
          version_label: "v2.1-2026",
          engine_version: "backend-decimal-v2",
        },
      },
    } as never)

    renderWithQuery(
      <AdvisoryRatingCalculator
        isOpen={true}
        onOpenChange={vi.fn()}
        productId="prod-motor-1"
        initialClass="Motor Private"
        initialSumInsured={2000000}
      />,
    )

    await waitFor(() => {
      expect(CalculationsService.quotePreview).toHaveBeenCalledWith({
        body: expect.objectContaining({
          product_id: "prod-motor-1",
          inputs: expect.any(Object),
        }),
      })
    })

    expect(await screen.findByText(/100,490/)).toBeTruthy()
    expect(screen.getByText(/100,000/)).toBeTruthy()
    expect(screen.getByText(/200/)).toBeTruthy()
    expect(screen.getByText(/250/)).toBeTruthy()
    expect(screen.getByText(/40/)).toBeTruthy()
    expect(
      screen.getByText(/v2\.1-2026|rtv-123|backend-decimal-v2/),
    ).toBeTruthy()
  })

  it("renders a Product selector when no productId is pre-selected", async () => {
    vi.mocked(ProductsService.readProducts).mockResolvedValue({
      data: {
        data: [
          {
            id: "prod-1",
            name: "Jubilee Motor Private",
            class_of_insurance: "Motor Private",
          },
        ],
        count: 1,
      },
    } as never)

    renderWithQuery(
      <AdvisoryRatingCalculator isOpen={true} onOpenChange={vi.fn()} />,
    )

    expect(await screen.findByLabelText("Select Product")).toBeTruthy()
    expect(CalculationsService.quotePreview).not.toHaveBeenCalled()
  })

  it("calls onApplyCalculation with the backend CalculationQuoteResponse when Apply to Workflow is clicked", async () => {
    const quotePayload = {
      basic_premium: "90000.00",
      net_premium: "100000.00",
      training_levy: "200.00",
      phcf: "250.00",
      stamp_duty: "40.00",
      total_taxes: "490.00",
      total_premium: "100490.00",
      total_amount: "100490.00",
      calculation_detail: { base_premium: "90000.00" },
      rule_provenance: { rate_table_version_id: "rtv-123" },
    }
    vi.mocked(CalculationsService.quotePreview).mockResolvedValue({
      data: quotePayload,
    } as never)

    const onApplyCalculation = vi.fn()
    renderWithQuery(
      <AdvisoryRatingCalculator
        isOpen={true}
        onOpenChange={vi.fn()}
        productId="prod-motor-1"
        onApplyCalculation={onApplyCalculation}
      />,
    )

    const applyBtn = await screen.findByRole("button", {
      name: /Apply to Workflow/i,
    })
    await waitFor(() => expect(applyBtn.hasAttribute("disabled")).toBe(false))
    fireEvent.click(applyBtn)

    expect(onApplyCalculation).toHaveBeenCalledWith(quotePayload)
  })
})
