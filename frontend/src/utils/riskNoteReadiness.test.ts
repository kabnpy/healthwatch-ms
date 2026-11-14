import { describe, expect, it } from "vitest"
import type { ClientPublic } from "@/client"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { validateRiskNoteReadiness } from "./riskNoteReadiness"

const baseClient = {
  id: "c1",
  name: "Acme Ltd",
  kra_pin: "P051234567A",
} as ClientPublic

const baseRiskNote = {
  id: "rn1",
  coverage_start: "2026-01-01",
  coverage_end: "2026-12-31",
  cover_snapshot: {},
} as EnhancedRiskNote

const nonMotorPolicy = {
  id: "p1",
  product: { class_of_insurance: "Medical" },
} as EnhancedPolicy

describe("validateRiskNoteReadiness", () => {
  it("returns Risk Note Record missing when riskNote, client, or policy is absent", () => {
    expect(validateRiskNoteReadiness({})).toEqual({
      isValid: false,
      missingFields: ["Risk Note Record"],
    })
  })

  it("validates client name, KRA PIN, and coverage period for non-motor policies", () => {
    expect(
      validateRiskNoteReadiness({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: nonMotorPolicy,
      }),
    ).toEqual({ isValid: true, missingFields: [] })

    expect(
      validateRiskNoteReadiness({
        riskNote: { ...baseRiskNote, coverage_start: "", coverage_end: "" },
        client: { ...baseClient, name: "", kra_pin: "" },
        policy: nonMotorPolicy,
      }),
    ).toEqual({
      isValid: false,
      missingFields: ["Client Name", "KRA PIN", "Coverage Period"],
    })
  })

  it("validates motor registration plate, chassis/VIN, and sum insured", () => {
    const motorPolicy = {
      id: "p2",
      product: { class_of_insurance: "Motor Private" },
    } as EnhancedPolicy

    expect(
      validateRiskNoteReadiness({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: motorPolicy,
      }),
    ).toEqual({
      isValid: false,
      missingFields: [
        "Vehicle Registration Plate",
        "Chassis Number (VIN)",
        "Insured Market Value",
      ],
    })

    expect(
      validateRiskNoteReadiness({
        riskNote: {
          ...baseRiskNote,
          cover_snapshot: {
            vehicle: {
              registration_number: "KDA 123A",
              chassis_number: "VIN123",
              sum_insured: 1500000,
            },
          },
        },
        client: baseClient,
        policy: motorPolicy,
      }),
    ).toEqual({ isValid: true, missingFields: [] })
  })

  it("accepts fallback motor fields from VEHICLE DETAILS, policy.vehicles, and net_premium", () => {
    const motorPolicyWithVehicles = {
      id: "p3",
      product: { class_of_insurance: "Commercial Motor" },
      vehicles: [{ registration_number: "KDB 456B" }],
    } as unknown as EnhancedPolicy

    expect(
      validateRiskNoteReadiness({
        riskNote: {
          ...baseRiskNote,
          net_premium: "45000.00",
          cover_snapshot: {
            "VEHICLE DETAILS": {},
            chassis_number: "VIN999",
          },
        },
        client: baseClient,
        policy: motorPolicyWithVehicles,
      }),
    ).toEqual({ isValid: true, missingFields: [] })
  })
})
