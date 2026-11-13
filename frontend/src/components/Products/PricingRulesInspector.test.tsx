// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RateTablesService } from "@/client"
import { PricingRulesInspector } from "./PricingRulesInspector"

vi.mock("@/client", async () => {
  const actual = await vi.importActual<typeof import("@/client")>("@/client")
  return {
    ...actual,
    RateTablesService: {
      tablesReadRateTables: vi.fn(),
      tablesReadRateTable: vi.fn(),
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

const motorProduct = {
  id: "prod-1",
  name: "Motor Private Comprehensive",
  class_of_insurance: "Motor Private",
  insurer_id: "ins-1",
  insurer: { name: "Jubilee Insurance" },
}

describe("PricingRulesInspector", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders a clear empty state when no published rate table schedule exists", async () => {
    vi.mocked(RateTablesService.tablesReadRateTables).mockResolvedValue({
      data: { data: [], count: 0 },
    } as any)

    renderWithQuery(<PricingRulesInspector product={motorProduct} />)

    expect(
      await screen.findByText(/no published rate table schedule/i),
    ).toBeTruthy()
  })

  it("renders motor brackets and benefits from live published RateTableVersion", async () => {
    vi.mocked(RateTablesService.tablesReadRateTables).mockResolvedValue({
      data: {
        data: [
          {
            id: "rt-1",
            insurer_id: "ins-1",
            class_of_insurance: "Motor Private",
            status: "published",
            source_reference: "Jubilee 2026 Motor Tariff",
          },
        ],
        count: 1,
      },
    } as any)

    vi.mocked(RateTablesService.tablesReadRateTable).mockResolvedValue({
      data: {
        id: "rt-1",
        insurer_id: "ins-1",
        class_of_insurance: "Motor Private",
        status: "published",
        source_reference: "Jubilee 2026 Motor Tariff",
        brackets: [
          {
            id: "b-1",
            rate_table_version_id: "rt-1",
            min_value: "0",
            max_value: "1500000",
            rate_percent: "0.045",
            minimum_premium: "37500",
            display_label: "Up to KES 1,500,000",
          },
        ],
        benefits: [
          {
            id: "ben-1",
            rate_table_version_id: "rt-1",
            name: "Political Violence & Terrorism",
            calculation_type: "percentage",
            rate_value: "0.0025",
            is_mandatory: false,
          },
        ],
        medical_tiers: [],
      },
    } as any)

    renderWithQuery(<PricingRulesInspector product={motorProduct} />)

    expect(await screen.findByText("Up to KES 1,500,000")).toBeTruthy()
    expect(screen.getByText("4.50%")).toBeTruthy()
    expect(screen.getByText("Political Violence & Terrorism")).toBeTruthy()
    expect(screen.getAllByText("0.25%").length).toBeGreaterThanOrEqual(1)
  })

  it("renders medical tiers from live published RateTableVersion", async () => {
    const medicalProduct = {
      id: "prod-2",
      name: "Afya Bora Medical",
      class_of_insurance: "Medical",
      insurer_id: "ins-1",
      insurer: { name: "Jubilee Insurance" },
    }

    vi.mocked(RateTablesService.tablesReadRateTables).mockResolvedValue({
      data: {
        data: [
          {
            id: "rt-2",
            insurer_id: "ins-1",
            class_of_insurance: "Medical",
            status: "published",
            source_reference: "Jubilee 2026 Medical Tariff",
          },
        ],
        count: 1,
      },
    } as any)

    vi.mocked(RateTablesService.tablesReadRateTable).mockResolvedValue({
      data: {
        id: "rt-2",
        insurer_id: "ins-1",
        class_of_insurance: "Medical",
        status: "published",
        source_reference: "Jubilee 2026 Medical Tariff",
        brackets: [],
        benefits: [],
        medical_tiers: [
          {
            id: "mt-1",
            inpatient_limit: "1000000",
            m_premium: "42000",
            m1_premium: "68000",
            m2_premium: "89000",
            m3_premium: "105000",
            m4_premium: "120000",
          },
        ],
      },
    } as any)

    renderWithQuery(<PricingRulesInspector product={medicalProduct} />)

    expect(await screen.findByText(/1,000,000/)).toBeTruthy()
    expect(screen.getByText(/42,000/)).toBeTruthy()
  })
})
