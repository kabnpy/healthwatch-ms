import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { extractCoverSummary } from "@/utils/coverSnapshot"
import { getPolicyDisplayName } from "@/utils/insurance"

export interface PolicyInvoiceSummary {
  invoice_number?: string | null
  balance_due?: number | string | null
}

export interface PolicyTaxSummary {
  netPremium: number | null
  trainingLevy: number | null
  phcf: number | null
  stampDuty: number | null
  totalAmount: number | null
  hasAuthoritativeCalculation: boolean
}

export interface PolicyDetailViewModel {
  expiryDateStr: string | undefined
  coverageStart: string | undefined
  coverageEnd: string | undefined
  daysToExpiry: number
  isMedical: boolean
  isMotor: boolean
  vehicle: Record<string, unknown> | undefined
  displayName: string
  rawSum: number
  invoice: PolicyInvoiceSummary | undefined
  balanceDue: number
  isSettled: boolean
  taxes: PolicyTaxSummary
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function resolveExpiryDate(
  policy: EnhancedPolicy,
  latestRiskNote: EnhancedRiskNote | null | undefined,
): string | undefined {
  if (latestRiskNote?.coverage_end) {
    return latestRiskNote.coverage_end
  }
  if (policy.inception_date) {
    const d = new Date(policy.inception_date)
    d.setUTCFullYear(d.getUTCFullYear() + 1)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().split("T")[0]
  }
  return undefined
}

function resolveVehicle(
  policy: EnhancedPolicy,
  latestRiskNote: EnhancedRiskNote | null | undefined,
): Record<string, unknown> | undefined {
  const snapshotVehicle = (
    latestRiskNote?.cover_snapshot as Record<string, unknown> | null | undefined
  )?.vehicle as Record<string, unknown> | undefined

  const policyWithVehicle = policy as EnhancedPolicy & {
    vehicles?: Array<Record<string, unknown>>
    vehicle?: Record<string, unknown>
  }

  return (
    policyWithVehicle.vehicles?.[0] ||
    snapshotVehicle ||
    policyWithVehicle.vehicle
  )
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function resolveTaxes(
  latestRiskNote: EnhancedRiskNote | null | undefined,
): PolicyTaxSummary {
  if (!latestRiskNote) {
    return {
      netPremium: null,
      trainingLevy: null,
      phcf: null,
      stampDuty: null,
      totalAmount: null,
      hasAuthoritativeCalculation: false,
    }
  }

  const breakdown =
    (latestRiskNote.financial_breakdown as
      | Record<string, unknown>
      | null
      | undefined) ?? {}
  const breakdownTaxes =
    (breakdown.taxes as Record<string, unknown> | null | undefined) ?? {}
  const snapshot =
    (latestRiskNote.cover_snapshot as
      | Record<string, unknown>
      | null
      | undefined) ?? {}
  const advisory =
    (snapshot.advisory_calculation as
      | Record<string, unknown>
      | null
      | undefined) ?? {}

  const netPremium = toFiniteNumber(
    latestRiskNote.net_premium ?? advisory.net_premium,
  )
  const trainingLevy = toFiniteNumber(
    breakdownTaxes.training_levy ??
      breakdownTaxes.insurance_training_levy ??
      advisory.training_levy,
  )
  const phcf = toFiniteNumber(
    breakdownTaxes.phcf ??
      breakdownTaxes.pcf_levy ??
      breakdownTaxes.policyholders_compensation_fund ??
      advisory.phcf,
  )
  const stampDuty = toFiniteNumber(
    breakdownTaxes.stamp_duty ?? advisory.stamp_duty,
  )
  const totalAmount = toFiniteNumber(
    latestRiskNote.total_amount ?? advisory.total_amount,
  )

  const hasAuthoritativeCalculation =
    netPremium !== null && totalAmount !== null

  return {
    netPremium,
    trainingLevy,
    phcf,
    stampDuty,
    totalAmount,
    hasAuthoritativeCalculation,
  }
}

/**
 * Derives the Policy detail view model from a policy, its latest risk note,
 * and a deterministic timestamp `now` (epoch ms).
 */
export function derivePolicyDetailViewModel(
  policy: EnhancedPolicy,
  latestRiskNote: EnhancedRiskNote | null | undefined,
  now: number = Date.now(),
): PolicyDetailViewModel {
  const coverageStart =
    latestRiskNote?.coverage_start || policy.inception_date || undefined
  const expiryDateStr = resolveExpiryDate(policy, latestRiskNote)
  const daysToExpiry = expiryDateStr
    ? Math.ceil((new Date(expiryDateStr).getTime() - now) / MS_PER_DAY)
    : 0

  const classOfInsurance =
    policy.product?.class_of_insurance?.toLowerCase() ?? ""
  const productName = policy.product?.name?.toLowerCase() ?? ""

  const isMedical =
    classOfInsurance.includes("medical") ||
    productName.includes("medical") ||
    productName.includes("health")

  const isMotor = classOfInsurance.includes("motor")

  const vehicle = resolveVehicle(policy, latestRiskNote)
  const displayName = getPolicyDisplayName(policy)

  const summary = extractCoverSummary(latestRiskNote?.cover_snapshot)
  const rawSum = Number(
    summary.sumInsured ||
      vehicle?.insured_value ||
      vehicle?.sum_insured ||
      (isMedical ? 2_000_000 : Number(latestRiskNote?.net_premium || 0) * 20),
  )

  const firstLineItem = latestRiskNote?.invoice_line_items?.[0] as
    | { invoice?: PolicyInvoiceSummary }
    | undefined
  const invoice = firstLineItem?.invoice
  const balanceDue = Number(invoice?.balance_due ?? 0)
  const isSettled = invoice ? balanceDue === 0 : false

  const taxes = resolveTaxes(latestRiskNote)

  return {
    expiryDateStr,
    coverageStart,
    coverageEnd: expiryDateStr,
    daysToExpiry,
    isMedical,
    isMotor,
    vehicle,
    displayName,
    rawSum,
    invoice,
    balanceDue,
    isSettled,
    taxes,
  }
}
