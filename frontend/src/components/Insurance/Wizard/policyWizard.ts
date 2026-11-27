import type { CalculationQuoteResponse } from "@/client"
import type { EnhancedProduct, WizardState } from "@/types/insurance"
import { buildCoverSnapshot } from "@/utils/coverSnapshot"

/**
 * Calculate the coverage end date (YYYY-MM-DD) from a start date and duration in months.
 */
export function calculateCoverageEndDate(
  startDate: string,
  durationMonths = 12,
): string {
  const endDate = new Date(startDate)

  // For standard 12-month terms, use setUTCFullYear to maintain day consistency.
  // For other durations, use month-based offset with month-end rollover protection.
  if (durationMonths === 12) {
    endDate.setUTCFullYear(endDate.getUTCFullYear() + 1)
  } else {
    const targetMonth = endDate.getUTCMonth() + durationMonths
    endDate.setUTCMonth(targetMonth)
    if (endDate.getUTCMonth() % 12 !== targetMonth % 12) {
      endDate.setUTCDate(0)
    }
  }

  return endDate.toISOString().split("T")[0]
}

export interface ProductClassification {
  isPA: boolean
  isMotor: boolean
  isMotorPrivate: boolean
  isManual: boolean
}

/**
 * Classify a product's insurance line and pricing strategy for wizard steps.
 */
export function classifyProduct(
  product?: Pick<
    EnhancedProduct,
    "class_of_insurance" | "pricing_strategy"
  > | null,
): ProductClassification {
  const insuranceClass = product?.class_of_insurance?.toLowerCase() ?? ""
  return {
    isPA: insuranceClass.includes("personal accident"),
    isMotor: insuranceClass.includes("motor"),
    isMotorPrivate: insuranceClass.includes("motor private"),
    isManual: product?.pricing_strategy === "Manual",
  }
}

export interface QuoteFinancialsDerivation {
  effectiveRate?: number
  basicRate?: number
  isHighEnd?: boolean
}

/**
 * Derive form financial fields from an authoritative backend quote response.
 */
export function deriveQuoteFinancials({
  breakdown,
  sumInsured,
  currentRate,
  isMotorPrivate,
}: {
  breakdown: CalculationQuoteResponse
  sumInsured: number
  currentRate: number
  isMotorPrivate: boolean
}): QuoteFinancialsDerivation {
  const calcDetail = (breakdown.calculation_detail ?? {}) as Record<
    string,
    unknown
  >

  let effectiveRate: number | undefined
  if (isMotorPrivate && Number(breakdown.net_premium) > 0) {
    const siNum = Number(sumInsured) || 1
    const computedRate = (Number(breakdown.net_premium) / siNum) * 100
    if (Math.abs(computedRate - currentRate) > 0.001) {
      effectiveRate = Number(computedRate.toFixed(3))
    }
  }

  return {
    effectiveRate,
    basicRate:
      calcDetail.basic_rate !== undefined
        ? Number(calcDetail.basic_rate) * 100
        : undefined,
    isHighEnd:
      calcDetail.is_high_end !== undefined
        ? Boolean(calcDetail.is_high_end)
        : undefined,
  }
}

const REVIEW_ESSENTIAL_ASSET_KEYS = [
  "registration_number",
  "make",
  "year_of_manufacture",
] as const

export interface ReviewAssetEntry {
  key: string
  label: string
  value: string
}

/**
 * Filter wizard asset details to the essential entries displayed on the review step.
 */
export function filterReviewAssetEntries(
  details: Record<string, unknown> | undefined,
): ReviewAssetEntry[] {
  return Object.entries(details || {})
    .filter(([key]) =>
      REVIEW_ESSENTIAL_ASSET_KEYS.includes(
        key.toLowerCase() as (typeof REVIEW_ESSENTIAL_ASSET_KEYS)[number],
      ),
    )
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " "),
      value: String(value),
    }))
}

/**
 * Assemble the atomic Policy creation payload from wizard state and selected product.
 */
export function buildPolicyIssuancePayload({
  clientId,
  state,
  selectedProduct,
  today = new Date().toISOString().split("T")[0],
}: {
  clientId: string
  state: WizardState
  selectedProduct: EnhancedProduct
  today?: string
}) {
  const startDate = state.financials?.startDate || today
  const durationMonths = state.financials?.duration || 12
  const endDate = calculateCoverageEndDate(startDate, durationMonths)

  const coverSnapshot = buildCoverSnapshot({
    blueprint: selectedProduct.product_details,
    details: state.details,
    sumInsured: state.sum_insured,
    extensions: state.extensions,
    terms: state.terms,
  })

  return {
    policy_number: state.policy_number,
    client_id: clientId,
    product_id: state.product_id,
    status: "Active" as const,
    inception_date: startDate,
    risk_details: coverSnapshot,
    coverage_start: startDate,
    coverage_end: endDate,
  }
}
