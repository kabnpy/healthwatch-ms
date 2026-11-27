import { describe, expect, it } from "vitest"
import { buildEndorsementPayload } from "./endorsementPayload"

describe("buildEndorsementPayload", () => {
  it("builds a valid EndorsementCreate payload with trimmed description, effective_date, and updated_risk_details", () => {
    const payload = buildEndorsementPayload({
      effective_date: "2026-12-01",
      change_description: "  Updated vehicle registration and sum insured  ",
      updated_risk_details: {
        registration_number: "KDA 123A",
        sum_insured: 2500000,
      },
    })

    expect(payload).toEqual({
      effective_date: "2026-12-01",
      change_description: "Updated vehicle registration and sum insured",
      updated_risk_details: {
        registration_number: "KDA 123A",
        sum_insured: 2500000,
      },
    })
  })

  it("normalizes blank effective_date to null and strips NaN values from updated_risk_details", () => {
    const payload = buildEndorsementPayload({
      effective_date: "   ",
      change_description: "Removed optional excess",
      updated_risk_details: {
        sum_insured: 1800000,
        excess_amount: Number.NaN,
      },
    })

    expect(payload).toEqual({
      effective_date: null,
      change_description: "Removed optional excess",
      updated_risk_details: {
        sum_insured: 1800000,
      },
    })
  })
})
