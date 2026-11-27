import { describe, expect, it } from "vitest"
import {
  buildPolicyIssuancePayload,
  calculateCoverageEndDate,
  classifyProduct,
  deriveQuoteFinancials,
  filterReviewAssetEntries,
} from "./policyWizard"

describe("calculateCoverageEndDate", () => {
  it("adds 1 full year for standard 12-month duration", () => {
    expect(calculateCoverageEndDate("2025-03-15", 12)).toBe("2026-03-15")
    expect(calculateCoverageEndDate("2024-02-29", 12)).toBe("2025-03-01")
  })

  it("handles month-end and leap-year rollover for non-12-month durations", () => {
    expect(calculateCoverageEndDate("2024-01-31", 1)).toBe("2024-02-29")
    expect(calculateCoverageEndDate("2025-01-31", 1)).toBe("2025-02-28")
    expect(calculateCoverageEndDate("2025-03-31", 1)).toBe("2025-04-30")
    expect(calculateCoverageEndDate("2025-06-15", 6)).toBe("2025-12-15")
  })
})

describe("classifyProduct", () => {
  it("classifies Motor Private, Motor Commercial, Personal Accident, and Manual products", () => {
    expect(
      classifyProduct({
        class_of_insurance: "Motor Private",
        pricing_strategy: "Percentage",
      }),
    ).toEqual({
      isPA: false,
      isMotor: true,
      isMotorPrivate: true,
      isManual: false,
    })

    expect(
      classifyProduct({
        class_of_insurance: "Motor Commercial",
        pricing_strategy: "Manual",
      }),
    ).toEqual({
      isPA: false,
      isMotor: true,
      isMotorPrivate: false,
      isManual: true,
    })

    expect(
      classifyProduct({
        class_of_insurance: "Personal Accident",
        pricing_strategy: "Percentage",
      }),
    ).toEqual({
      isPA: true,
      isMotor: false,
      isMotorPrivate: false,
      isManual: false,
    })

    expect(classifyProduct(undefined)).toEqual({
      isPA: false,
      isMotor: false,
      isMotorPrivate: false,
      isManual: false,
    })
  })
})

describe("deriveQuoteFinancials", () => {
  it("derives effectiveRate, basicRate, and isHighEnd from Motor Private quote breakdown", () => {
    const result = deriveQuoteFinancials({
      breakdown: {
        basic_premium: "90000",
        net_premium: "95000",
        training_levy: "190",
        phcf: "237.50",
        stamp_duty: "40",
        total_taxes: "467.50",
        total_premium: "95467.50",
        total_amount: "95467.50",
        calculation_detail: {
          basic_rate: 0.045,
          is_high_end: true,
        },
        rule_provenance: {},
      },
      sumInsured: 2000000,
      currentRate: 4.0,
      isMotorPrivate: true,
    })

    expect(result).toEqual({
      effectiveRate: 4.75,
      basicRate: 4.5,
      isHighEnd: true,
    })
  })

  it("omits effectiveRate when within tolerance or non-Motor-Private", () => {
    const result = deriveQuoteFinancials({
      breakdown: {
        basic_premium: "90000",
        net_premium: "90000",
        training_levy: "180",
        phcf: "225",
        stamp_duty: "40",
        total_taxes: "445",
        total_premium: "90445",
        total_amount: "90445",
        calculation_detail: {
          basic_rate: 0.045,
          is_high_end: false,
        },
        rule_provenance: {},
      },
      sumInsured: 2000000,
      currentRate: 4.5,
      isMotorPrivate: false,
    })

    expect(result).toEqual({
      effectiveRate: undefined,
      basicRate: 4.5,
      isHighEnd: false,
    })
  })
})

describe("filterReviewAssetEntries", () => {
  it("keeps only essential asset keys and formats labels", () => {
    expect(
      filterReviewAssetEntries({
        registration_number: "KDA 123A",
        make: "Toyota",
        year_of_manufacture: 2020,
        chassis_number: "CHASSIS-999",
        sum_insured: 2500000,
      }),
    ).toEqual([
      {
        key: "registration_number",
        label: "registration number",
        value: "KDA 123A",
      },
      { key: "make", label: "make", value: "Toyota" },
      {
        key: "year_of_manufacture",
        label: "year of manufacture",
        value: "2020",
      },
    ])

    expect(filterReviewAssetEntries(undefined)).toEqual([])
  })
})

describe("buildPolicyIssuancePayload", () => {
  it("assembles the policy issuance payload with cover snapshot and coverage dates", () => {
    const payload = buildPolicyIssuancePayload({
      clientId: "client-123",
      state: {
        product_id: "prod-1",
        policy_number: "POL-2025-001",
        sum_insured: 2500000,
        details: { registration_number: "KDA 123A", make: "Toyota" },
        terms: {
          benefits_and_limits: "Comprehensive",
          excesses: "Standard",
          special_clauses: "",
        },
        financials: {
          rate: 4.5,
          startDate: "2025-03-15",
          duration: 12,
        },
        extensions: {
          pvt: true,
          excessProtector: false,
          passengerLiability: false,
          omRescuePlus: false,
        },
      },
      selectedProduct: {
        id: "prod-1",
        name: "Motor Private",
        insurer_id: "ins-1",
        class_of_insurance: "Motor Private",
        pricing_strategy: "Percentage",
        product_details: {
          cover_type: "Comprehensive",
        },
      } as any,
    })

    expect(payload).toMatchObject({
      policy_number: "POL-2025-001",
      client_id: "client-123",
      product_id: "prod-1",
      status: "Active",
      inception_date: "2025-03-15",
      coverage_start: "2025-03-15",
      coverage_end: "2026-03-15",
    })
    expect(payload.risk_details).toBeDefined()
    expect((payload.risk_details as any).extensions).toMatchObject({
      pvt: true,
    })
  })
})
