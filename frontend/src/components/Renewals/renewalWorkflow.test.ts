import { describe, expect, it } from "vitest"
import type { RenewalHorizonResponse, RenewalPublic } from "@/client"
import {
  buildRenewalFinancialUpdatePayload,
  buildRenewalInitiationPayload,
  buildRenewalTransitionPayload,
  calculateRenewalPremiumDelta,
  computeRenewalPeriodEnd,
  formatAdvisoryRatingNote,
  getRenewalActionLabel,
  getRenewalStageMeta,
  isOptimisticConcurrencyConflict,
  partitionRenewalHorizon,
  RENEWAL_WORKFLOW_STAGES,
} from "./renewalWorkflow"

const makeRenewal = (overrides: Partial<RenewalPublic> = {}): RenewalPublic =>
  ({
    id: "ren-1",
    policy_id: "pol-1",
    status: "awaiting_carrier",
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as RenewalPublic

describe("renewalWorkflow", () => {
  describe("RENEWAL_WORKFLOW_STAGES & metadata", () => {
    it("defines the 6 ordered renewal workflow stages with consistent metadata", () => {
      expect(RENEWAL_WORKFLOW_STAGES.map((s) => s.status)).toEqual([
        "awaiting_carrier",
        "carrier_received",
        "client_invited",
        "changes_requested",
        "paid",
        "completed",
      ])

      for (const stage of RENEWAL_WORKFLOW_STAGES) {
        expect(stage.label.length).toBeGreaterThan(0)
        expect(stage.shortLabel.length).toBeGreaterThan(0)
        expect(stage.color.length).toBeGreaterThan(0)
        expect(stage.icon).toBeDefined()
        expect(getRenewalStageMeta(stage.status).label).toBe(stage.label)
      }
    })

    it("returns next-stage action labels and falls back to Start Renewal", () => {
      expect(getRenewalActionLabel(null)).toBe("Start Renewal")
      expect(getRenewalActionLabel(undefined)).toBe("Start Renewal")
      expect(getRenewalActionLabel("awaiting_carrier")).toBe(
        "Log Insurer Terms",
      )
      expect(getRenewalActionLabel("carrier_received")).toBe(
        "Prepare Invitation",
      )
      expect(getRenewalActionLabel("client_invited")).toBe("Follow Up")
      expect(getRenewalActionLabel("changes_requested")).toBe("Revise Terms")
      expect(getRenewalActionLabel("paid")).toBe("Complete Renewal")
      expect(getRenewalActionLabel("completed")).toBe("Start Renewal")
    })
  })

  describe("partitionRenewalHorizon", () => {
    it("partitions horizon buckets into expiring30, expiring60, expired, inWorkflow, and completedRenewals", () => {
      const horizon: RenewalHorizonResponse = {
        overdue: [
          {
            policy_id: "pol-overdue",
            policy_number: "POL-OVERDUE",
            client_id: "c-1",
            client_name: "Alice",
            coverage_end: "2026-01-01",
            days_left: -5,
            renewal: null,
            policy: {} as never,
          },
        ],
        "0_30": [
          {
            policy_id: "pol-30-unstarted",
            policy_number: "POL-30-1",
            client_id: "c-2",
            client_name: "Bob",
            coverage_end: "2026-02-10",
            days_left: 10,
            renewal: null,
            policy: {} as never,
          },
          {
            policy_id: "pol-30-active",
            policy_number: "POL-30-2",
            client_id: "c-3",
            client_name: "Carol",
            coverage_end: "2026-02-15",
            days_left: 15,
            renewal: {
              id: "r-active",
              status: "client_invited",
            } as never,
            policy: {} as never,
          },
          {
            policy_id: "pol-30-completed",
            policy_number: "POL-30-3",
            client_id: "c-4",
            client_name: "Dave",
            coverage_end: "2026-02-20",
            days_left: 20,
            renewal: {
              id: "r-done",
              status: "completed",
            } as never,
            policy: {} as never,
          },
        ],
        "31_60": [
          {
            policy_id: "pol-60",
            policy_number: "POL-60",
            client_id: "c-5",
            client_name: "Eve",
            coverage_end: "2026-03-10",
            days_left: 40,
            renewal: null,
            policy: {} as never,
          },
        ],
        "61_90": [],
      }

      const extraRenewals: RenewalPublic[] = [
        makeRenewal({
          id: "r-extra",
          policy_id: "pol-extra",
          status: "awaiting_carrier",
        }),
        makeRenewal({
          id: "r-dup",
          policy_id: "pol-30-active",
          status: "client_invited",
        }),
        makeRenewal({
          id: "r-cancelled",
          policy_id: "pol-cancelled",
          status: "cancelled",
        }),
      ]

      const result = partitionRenewalHorizon(horizon, extraRenewals)

      expect(result.expired.map((i) => i.policy_id)).toEqual(["pol-overdue"])
      expect(result.expiring30.map((i) => i.policy_id)).toEqual([
        "pol-30-unstarted",
        "pol-30-completed",
      ])
      expect(result.expiring60.map((i) => i.policy_id)).toEqual(["pol-60"])
      expect(result.completedRenewals.map((i) => i.policy_id)).toEqual([
        "pol-30-completed",
      ])
      expect(result.inWorkflow.map((i) => i.policy_id)).toEqual([
        "pol-30-active",
        "pol-extra",
      ])
    })
  })

  describe("computeRenewalPeriodEnd", () => {
    it("computes calendar-year minus one day including leap years", () => {
      expect(computeRenewalPeriodEnd("2026-01-01")).toBe("2026-12-31")
      expect(computeRenewalPeriodEnd("2023-03-01")).toBe("2024-02-29")
      expect(computeRenewalPeriodEnd("2024-02-29")).toBe("2025-02-28")
      expect(computeRenewalPeriodEnd("2024-03-01")).toBe("2025-02-28")
    })
  })

  describe("payload builders", () => {
    it("builds initiation payload with calendar-year minus one day end date", () => {
      expect(
        buildRenewalInitiationPayload({
          policyId: "pol-1",
          startDate: "2024-02-29",
          previousPremium: 50000,
          proposedPremium: 55000,
          notes: "Initial quote",
        }),
      ).toEqual({
        policy_id: "pol-1",
        renewal_period_start: "2024-02-29",
        renewal_period_end: "2025-02-28",
        previous_premium: "50000",
        proposed_premium: "55000",
        notes: "Initial quote",
      })

      expect(
        buildRenewalInitiationPayload({
          policyId: "pol-1",
          startDate: "2026-01-01",
          previousPremium: 50000,
          proposedPremium: 0,
          notes: "",
        }),
      ).toEqual({
        policy_id: "pol-1",
        renewal_period_start: "2026-01-01",
        renewal_period_end: "2026-12-31",
        previous_premium: "50000",
        proposed_premium: undefined,
        notes: undefined,
      })
    })

    it("builds transition payload with expected_version and optional fields", () => {
      expect(
        buildRenewalTransitionPayload({
          targetStatus: "client_invited",
          expectedVersion: 3,
          agreedPremium: 52000,
          notes: "Sent to client",
        }),
      ).toEqual({
        target_status: "client_invited",
        expected_version: 3,
        agreed_premium: "52000",
        notes: "Sent to client",
      })

      expect(
        buildRenewalTransitionPayload({
          targetStatus: "carrier_received",
          expectedVersion: 1,
          agreedPremium: 0,
          notes: "",
        }),
      ).toEqual({
        target_status: "carrier_received",
        expected_version: 1,
        agreed_premium: undefined,
        notes: undefined,
      })
    })

    it("builds financial update payload with expected_version and optional fields", () => {
      expect(
        buildRenewalFinancialUpdatePayload({
          expectedVersion: 2,
          proposedPremium: 54000,
          agreedPremium: 52000,
          carrierDocumentKey: "doc-123",
          notes: "Updated terms",
        }),
      ).toEqual({
        expected_version: 2,
        proposed_premium: "54000",
        agreed_premium: "52000",
        carrier_document_key: "doc-123",
        notes: "Updated terms",
      })
    })
  })

  describe("isOptimisticConcurrencyConflict", () => {
    it("detects HTTP 409 from direct status or nested response.status", () => {
      expect(isOptimisticConcurrencyConflict({ status: 409 })).toBe(true)
      expect(
        isOptimisticConcurrencyConflict({ response: { status: 409 } }),
      ).toBe(true)
      expect(isOptimisticConcurrencyConflict({ status: 400 })).toBe(false)
      expect(
        isOptimisticConcurrencyConflict({ response: { status: 500 } }),
      ).toBe(false)
      expect(isOptimisticConcurrencyConflict(null)).toBe(false)
      expect(isOptimisticConcurrencyConflict(undefined)).toBe(false)
    })
  })

  describe("formatAdvisoryRatingNote & calculateRenewalPremiumDelta", () => {
    it("formats advisory rating note with trim and fallback", () => {
      expect(formatAdvisoryRatingNote("  Loss ratio 42%  ")).toBe(
        "Loss ratio 42%",
      )
      expect(formatAdvisoryRatingNote("   ")).toBe(
        "No advisory rating note recorded.",
      )
      expect(formatAdvisoryRatingNote(null)).toBe(
        "No advisory rating note recorded.",
      )
    })

    it("calculates premium delta using agreedPremium when positive, else proposedPremium", () => {
      expect(calculateRenewalPremiumDelta(50000, 55000, 52000)).toBe(2000)
      expect(calculateRenewalPremiumDelta(50000, 55000, 0)).toBe(5000)
      expect(calculateRenewalPremiumDelta(50000, 48000, 0)).toBe(-2000)
    })
  })
})
