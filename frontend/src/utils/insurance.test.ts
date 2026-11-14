import { describe, expect, it } from "vitest"
import type { PolicyPublic } from "@/client"
import { getPolicyDisplayName } from "./insurance"

function makePolicy(overrides: Record<string, unknown> = {}): PolicyPublic {
  return {
    id: "pol-1",
    policy_number: "POL-001",
    status: "Active",
    product: {
      id: "prod-1",
      name: "Motor Private",
      class_of_insurance: "Motor Private",
    },
    ...overrides,
  } as unknown as PolicyPublic
}

describe("getPolicyDisplayName", () => {
  it("extracts vehicle registration from active_note.cover_snapshot via extractCoverSummary", () => {
    const policy = makePolicy({
      active_note: {
        cover_snapshot: {
          vehicle: { reg_no: "KDA 123A", make: "Toyota", model: "Corolla" },
        },
      },
    })
    expect(getPolicyDisplayName(policy)).toBe("Motor Private - KDA 123A")
  })

  it("extracts vehicle_details['Reg. No'] from active_note.cover_snapshot", () => {
    const policy = makePolicy({
      active_note: {
        cover_snapshot: {
          vehicle_details: { "Reg. No": "KDB 456B" },
        },
      },
    })
    expect(getPolicyDisplayName(policy)).toBe("Motor Private - KDB 456B")
  })

  it("falls back to makeModel when vehicleReg is absent", () => {
    const policy = makePolicy({
      active_note: {
        cover_snapshot: {
          vehicle: { make: "Subaru", model: "Forester" },
        },
      },
    })
    expect(getPolicyDisplayName(policy)).toBe("Motor Private - Subaru Forester")
  })

  it("falls back to policy.vehicles when cover_snapshot has no vehicle info", () => {
    const policy = makePolicy({
      active_note: { cover_snapshot: {} },
      vehicles: [
        { registration_number: "KDC 789C", make: "Mazda", model: "CX-5" },
      ],
    })
    expect(getPolicyDisplayName(policy)).toBe(
      "Motor Private - KDC 789C Mazda CX-5",
    )
  })

  it("returns baseName when no identifying info is present", () => {
    const policy = makePolicy({ active_note: { cover_snapshot: {} } })
    expect(getPolicyDisplayName(policy)).toBe("Motor Private")
  })
})
