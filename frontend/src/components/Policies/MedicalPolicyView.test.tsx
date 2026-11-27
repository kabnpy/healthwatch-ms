// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ClientPublic } from "@/client"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { MedicalPolicyView } from "./MedicalPolicyView"

const baseClient = {
  id: "cli-1",
  name: "Jane Doe",
  email: "jane@example.com",
} as unknown as ClientPublic

const basePolicy = {
  id: "pol-med-1",
  policy_number: "MED-001",
  inception_date: "2026-01-01",
  product: {
    id: "prod-1",
    name: "Medical Family Plan",
    class_of_insurance: "Medical",
    insurer: { name: "Jubilee Health" },
  },
} as unknown as EnhancedPolicy

describe("MedicalPolicyView", () => {
  it("renders authoritative tax breakdown and 0 stamp duty from view model", () => {
    const riskNote = {
      id: "rn-1",
      net_premium: "100000.00",
      total_amount: "100450.00",
      financial_breakdown: {
        taxes: {
          training_levy: 200,
          phcf: 250,
          stamp_duty: 0,
        },
      },
    } as unknown as EnhancedRiskNote

    render(
      <MedicalPolicyView
        policy={basePolicy}
        client={baseClient}
        latestRiskNote={riskNote}
        onEndorseCensus={vi.fn()}
      />,
    )

    expect(screen.getAllByText(/100,000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/200/)).toBeTruthy()
    expect(screen.getByText(/250/)).toBeTruthy()
    expect(screen.getByText(/100,450/)).toBeTruthy()
    expect(screen.getByText(/KES 0\.00/)).toBeTruthy()
  })

  it("renders pending state '—' when calculation data is absent instead of hardcoded 94,000", () => {
    render(
      <MedicalPolicyView
        policy={basePolicy}
        client={baseClient}
        latestRiskNote={null}
        onEndorseCensus={vi.fn()}
      />,
    )

    expect(screen.queryByText(/94,000/)).toBeNull()
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4)
  })
})
