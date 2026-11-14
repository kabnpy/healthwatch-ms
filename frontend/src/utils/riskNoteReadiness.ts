import type { ClientPublic } from "@/client"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"

export interface PresetClause {
  name: string
  snippet: string
}

export const PRESET_CLAUSES: PresetClause[] = [
  {
    name: "Anti-Theft Tracker",
    snippet:
      "**Anti-Theft Tracker Warranty:** Warranted that an approved anti-theft tracking device is fitted and fully functional on the vehicle within 14 days of inception, failing which theft cover is rendered null and void.",
  },
  {
    name: "Valuation Report",
    snippet:
      "**Valuation Warranty:** Warranted that the vehicle is inspected and valued by an approved agency assessor within 7 days from coverage inception date.",
  },
  {
    name: "Territorial Limits",
    snippet:
      "**Territorial Limits:** Restricted to Kenya. Cross-border extension to Uganda/Tanzania requires prior formal agency endorsement and payment of requisite extension premium.",
  },
  {
    name: "Driver Excess Clause",
    snippet:
      "**Driver Excess Clause:** Drivers under 21 years of age or with less than 2 years of driving experience are subject to an additional mandatory excess of KES 25,000.",
  },
  {
    name: "Premium Payment Warranty",
    snippet:
      "**Premium Payment Warranty:** Cover is conditional upon receipt of cleared premium funds within the statutory credit terms.",
  },
]

export const DEFAULT_SPECIAL_CONDITIONS =
  "### Standard Policy Warranties\n- **Anti-Theft Tracker Warranty:** Fitted within 14 days of inception.\n- **Territorial Limits:** Restricted to Kenya unless endorsed.\n- **Use:** Strictly Social, Domestic and Pleasure (SD&P) & business carriage."

export interface RiskNoteReadinessInput {
  riskNote?: EnhancedRiskNote | null
  client?: ClientPublic | null
  policy?: EnhancedPolicy | null
}

export interface RiskNoteReadinessResult {
  isValid: boolean
  missingFields: string[]
}

export function validateRiskNoteReadiness({
  riskNote,
  client,
  policy,
}: RiskNoteReadinessInput): RiskNoteReadinessResult {
  if (!riskNote || !client || !policy) {
    return { isValid: false, missingFields: ["Risk Note Record"] }
  }

  const missing: string[] = []
  const snapshot = riskNote.cover_snapshot || {}
  const isMotor =
    policy.product?.class_of_insurance?.toLowerCase().includes("motor") || false

  if (!client.name) missing.push("Client Name")
  if (!client.kra_pin) missing.push("KRA PIN")
  if (!riskNote.coverage_start || !riskNote.coverage_end) {
    missing.push("Coverage Period")
  }

  if (isMotor) {
    const vehicle =
      (snapshot.vehicle as Record<string, unknown> | undefined) ||
      (snapshot["VEHICLE DETAILS"] as Record<string, unknown> | undefined) ||
      {}
    const policyVehicles = (
      policy as EnhancedPolicy & {
        vehicles?: Array<{ registration_number?: string | null }>
      }
    ).vehicles
    if (
      !vehicle.registration_number &&
      !policyVehicles?.[0]?.registration_number
    ) {
      missing.push("Vehicle Registration Plate")
    }
    if (!vehicle.chassis_number && !snapshot.chassis_number) {
      missing.push("Chassis Number (VIN)")
    }
    if (
      !vehicle.sum_insured &&
      !snapshot.sum_insured &&
      !riskNote.net_premium
    ) {
      missing.push("Insured Market Value")
    }
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  }
}
