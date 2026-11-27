import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import { extractCoverSummary } from "@/utils/coverSnapshot"
import { getPolicyDisplayName } from "@/utils/insurance"

export interface PolicyInvoiceSummary {
  invoice_number?: string | null
  balance_due?: number | string | null
}

export interface PolicyDetailViewModel {
  expiryDateStr: string | undefined
  daysToExpiry: number
  isMedical: boolean
  isMotor: boolean
  vehicle: Record<string, unknown> | undefined
  displayName: string
  rawSum: number
  invoice: PolicyInvoiceSummary | undefined
  balanceDue: number
  isSettled: boolean
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
    d.setFullYear(d.getFullYear() + 1)
    d.setDate(d.getDate() - 1)
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

/**
 * Derives the Policy detail view model from a policy, its latest risk note,
 * and a deterministic timestamp `now` (epoch ms).
 */
export function derivePolicyDetailViewModel(
  policy: EnhancedPolicy,
  latestRiskNote: EnhancedRiskNote | null | undefined,
  now: number = Date.now(),
): PolicyDetailViewModel {
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

  return {
    expiryDateStr,
    daysToExpiry,
    isMedical,
    isMotor,
    vehicle,
    displayName,
    rawSum,
    invoice,
    balanceDue,
    isSettled,
  }
}
