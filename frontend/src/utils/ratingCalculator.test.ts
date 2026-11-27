import { describe, expect, it } from "vitest"
import type { CalculationQuoteResponse } from "@/client"
import {
  buildAdvisoryQuoteInputs,
  formatQuoteBreakdownText,
  parseQuoteBreakdown,
} from "./ratingCalculator"

describe("buildAdvisoryQuoteInputs", () => {
  it("builds Motor Private quote payload with sum_insured and extensions", () => {
    const result = buildAdvisoryQuoteInputs({
      selectedClass: "Motor Private",
      motor: {
        sumInsured: 2000000,
        pvt: true,
        excessProtector: true,
        passengerLiability: false,
        roadRescue: true,
        courtesyCar: false,
      },
      domestic: {
        buildings: 15000000,
        contents: 3000000,
        allRisks: 500000,
        servants: 2,
        ownersLiability: true,
      },
      medical: {
        tierLimit: "2000000",
        familySize: "M+2",
        outpatient: true,
        dental: false,
        optical: false,
        maternity: false,
      },
    })

    expect(result).toEqual({
      sum_insured: 2000000,
      extensions: {
        pvt: true,
        excess_protector: true,
        passenger_liability: false,
        road_rescue: true,
        courtesy_car: false,
      },
    })
  })

  it("builds Domestic Package quote payload", () => {
    const result = buildAdvisoryQuoteInputs({
      selectedClass: "Domestic Package",
      motor: {
        sumInsured: 2000000,
        pvt: true,
        excessProtector: true,
        passengerLiability: false,
        roadRescue: true,
        courtesyCar: false,
      },
      domestic: {
        buildings: 15000000,
        contents: 3000000,
        allRisks: 500000,
        servants: 2,
        ownersLiability: true,
      },
      medical: {
        tierLimit: "2000000",
        familySize: "M+2",
        outpatient: true,
        dental: false,
        optical: false,
        maternity: false,
      },
    })

    expect(result).toEqual({
      buildings_sum_insured: 15000000,
      contents_sum_insured: 3000000,
      all_risks_sum_insured: 500000,
      number_of_servants: 2,
      include_owners_liability: true,
    })
  })

  it("builds Medical quote payload with tier_limit, family_size, and riders", () => {
    const result = buildAdvisoryQuoteInputs({
      selectedClass: "Medical",
      motor: {
        sumInsured: 2000000,
        pvt: true,
        excessProtector: true,
        passengerLiability: false,
        roadRescue: true,
        courtesyCar: false,
      },
      domestic: {
        buildings: 15000000,
        contents: 3000000,
        allRisks: 500000,
        servants: 2,
        ownersLiability: true,
      },
      medical: {
        tierLimit: "5000000",
        familySize: "M+3",
        outpatient: true,
        dental: true,
        optical: false,
        maternity: true,
      },
    })

    expect(result).toEqual({
      tier_limit: "5000000",
      family_size: "M+3",
      riders: {
        outpatient: true,
        dental: true,
        optical: false,
        maternity: true,
      },
    })
  })
})

describe("parseQuoteBreakdown", () => {
  it("parses CalculationQuoteResponse into typed breakdown fields with defaults", () => {
    const response: CalculationQuoteResponse = {
      basic_premium: "50000.00",
      net_premium: "55000.00",
      training_levy: "110.00",
      phcf: "137.50",
      stamp_duty: "40.00",
      total_amount: "55287.50",
      calculation_detail: {
        base_premium: 50000,
        applied_rate: 2.5,
        minimum_premium_floor: 35000,
        benefits: [
          {
            name: "PVT",
            amount: 5000,
            is_complimentary: false,
            rate_description: "0.25%",
          },
        ],
      },
      rule_provenance: {
        version_label: "v2.1.0",
      },
    }

    const parsed = parseQuoteBreakdown(response, "Motor Private")

    expect(parsed).toEqual({
      basePremium: 50000,
      netPremium: 55000,
      itl: 110,
      phcf: 137.5,
      stampDuty: 40,
      totalAmount: 55287.5,
      appliedRate: 2.5,
      minimumFloor: 35000,
      benefitLines: [
        {
          name: "PVT",
          amount: 5000,
          is_complimentary: false,
          rate_description: "0.25%",
        },
      ],
      provenanceLabel: "v2.1.0",
      isStampDutyExempt: false,
    })
  })

  it("marks Medical class as stamp duty exempt even when stamp_duty is present", () => {
    const response: CalculationQuoteResponse = {
      basic_premium: "40000",
      net_premium: "40000",
      training_levy: "80",
      phcf: "100",
      stamp_duty: "40",
      total_amount: "40180",
      calculation_detail: {},
      rule_provenance: {},
    }

    const parsed = parseQuoteBreakdown(response, "Medical")
    expect(parsed.isStampDutyExempt).toBe(true)
    expect(parsed.provenanceLabel).toBe("backend-decimal")
  })
})

describe("formatQuoteBreakdownText", () => {
  it("formats breakdown summary for clipboard with benefits and statutory levies", () => {
    const text = formatQuoteBreakdownText("Motor Private", {
      basePremium: 50000,
      netPremium: 55000,
      itl: 110,
      phcf: 137.5,
      stampDuty: 40,
      totalAmount: 55287.5,
      appliedRate: 2.5,
      minimumFloor: 35000,
      benefitLines: [
        {
          name: "PVT",
          amount: 5000,
          is_complimentary: false,
          rate_description: "0.25%",
        },
        {
          label: "Road Rescue",
          amount: 0,
          is_complimentary: true,
          rate_description: "Free",
        },
      ],
      provenanceLabel: "v2.1.0",
      isStampDutyExempt: false,
    })

    expect(text).toContain("HEALTHWATCH ADVISORY RATING BREAKDOWN")
    expect(text).toContain("Class of Insurance: Motor Private")
    expect(text).toContain("Base Premium: KES 50,000.00")
    expect(text).toContain("  - PVT: KES 5,000.00 (0.25%)")
    expect(text).toContain("  - Road Rescue: COMPLIMENTARY (Free)")
    expect(text).toContain("Net Premium: KES 55,000.00")
    expect(text).toContain("  - Training Levy (0.20%): KES 110.00")
    expect(text).toContain("  - PHCF Levy (0.25%): KES 137.50")
    expect(text).toContain("  - Stamp Duty: KES 40.00")
    expect(text).toContain("Total Premium: KES 55,287.50")
    expect(text).toContain("Provenance: v2.1.0")
  })
})
