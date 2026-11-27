import { describe, expect, it } from "vitest"
import type { RenewalHorizonResponse, RenewalPublic } from "@/client"
import {
  getRenewalActionLabel,
  getRenewalStageMeta,
  partitionRenewalHorizon,
  RENEWAL_WORKFLOW_STAGES,
} from "./renewalWorkflow"

const makeRenewal = (
  overrides: Partial<RenewalPublic> = {},
): RenewalPublic =>
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
})
