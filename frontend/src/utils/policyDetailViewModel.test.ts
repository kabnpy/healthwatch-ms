import { describe, expect, it } from "vitest"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { derivePolicyDetailViewModel } from "./policyDetailViewModel"

const NOW = new Date("2026-06-01T00:00:00.000Z").getTime()

describe("derivePolicyDetailViewModel", () => {
  it("derives motor policy details with explicit coverage_end, vehicle, and unsettled invoice", () => {
    const policy = {
      id: "pol-1",
      policy_number: "MOT-001",
      inception_date: "2026-01-01",
      product: {
        id: "prod-1",
        name: "Private Motor Comprehensive",
        class_of_insurance: "Motor Private",
      },
      vehicles: [
        {
          id: "veh-1",
          registration_number: "KDA 123A",
          insured_value: 1_500_000,
        },
      ],
    } as unknown as EnhancedPolicy

    const latestRiskNote = {
      id: "rn-1",
      coverage_end: "2026-06-11",
      net_premium: 45_000,
      cover_snapshot: { sum_insured: 1_500_000 },
      invoice_line_items: [
        {
          invoice: {
            invoice_number: "INV-100",
            balance_due: 25_000,
          },
        },
      ],
    } as unknown as EnhancedRiskNote

    const vm = derivePolicyDetailViewModel(policy, latestRiskNote, NOW)

    expect(vm.isMotor).toBe(true)
    expect(vm.isMedical).toBe(false)
    expect(vm.expiryDateStr).toBe("2026-06-11")
    expect(vm.daysToExpiry).toBe(10)
    expect(vm.vehicle).toMatchObject({ registration_number: "KDA 123A" })
    expect(vm.rawSum).toBe(1_500_000)
    expect(vm.invoice).toMatchObject({ invoice_number: "INV-100" })
    expect(vm.balanceDue).toBe(25_000)
    expect(vm.isSettled).toBe(false)
  })

  it("derives medical policy defaults with 2,000,000 fallback sum insured and settled invoice", () => {
    const policy = {
      id: "pol-2",
      policy_number: "MED-001",
      inception_date: "2026-01-01",
      product: {
        id: "prod-2",
        name: "Family Health Cover",
        class_of_insurance: "General",
      },
    } as unknown as EnhancedPolicy

    const latestRiskNote = {
      id: "rn-2",
      net_premium: 30_000,
      invoice_line_items: [
        {
          invoice: {
            invoice_number: "INV-200",
            balance_due: 0,
          },
        },
      ],
    } as unknown as EnhancedRiskNote

    const vm = derivePolicyDetailViewModel(policy, latestRiskNote, NOW)

    expect(vm.isMedical).toBe(true)
    expect(vm.isMotor).toBe(false)
    expect(vm.expiryDateStr).toBe("2026-12-31")
    expect(vm.daysToExpiry).toBe(213)
    expect(vm.rawSum).toBe(2_000_000)
    expect(vm.balanceDue).toBe(0)
    expect(vm.isSettled).toBe(true)
  })

  it("falls back to net_premium * 20 and cover_snapshot.vehicle when policy.vehicles is absent", () => {
    const policy = {
      id: "pol-3",
      policy_number: "MOT-002",
      product: {
        id: "prod-3",
        name: "Commercial Motor",
        class_of_insurance: "Motor Commercial",
      },
    } as unknown as EnhancedPolicy

    const latestRiskNote = {
      id: "rn-3",
      net_premium: 50_000,
      cover_snapshot: {
        vehicle: {
          registration_number: "KDB 456B",
        },
      },
    } as unknown as EnhancedRiskNote

    const vm = derivePolicyDetailViewModel(policy, latestRiskNote, NOW)

    expect(vm.isMotor).toBe(true)
    expect(vm.expiryDateStr).toBeUndefined()
    expect(vm.daysToExpiry).toBe(0)
    expect(vm.vehicle).toMatchObject({ registration_number: "KDB 456B" })
    expect(vm.rawSum).toBe(1_000_000)
    expect(vm.invoice).toBeUndefined()
    expect(vm.isSettled).toBe(false)
  })
})
