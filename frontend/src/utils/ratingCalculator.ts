import type { CalculationQuoteResponse } from "@/client"
import { formatCurrency } from "@/utils"

export type AdvisoryClass = "Motor Private" | "Domestic Package" | "Medical"

export interface QuoteBenefitLine {
  name?: string
  label?: string
  amount?: number | string
  is_complimentary?: boolean
  rate_description?: string
}

export interface ParsedQuoteBreakdown {
  basePremium: number
  netPremium: number
  itl: number
  phcf: number
  stampDuty: number
  totalAmount: number
  appliedRate: number | null
  minimumFloor: number | null
  benefitLines: QuoteBenefitLine[]
  provenanceLabel: string
  isStampDutyExempt: boolean
}

export interface MotorQuoteInput {
  sumInsured: number
  pvt: boolean
  excessProtector: boolean
  passengerLiability: boolean
  roadRescue: boolean
  courtesyCar: boolean
}

export interface DomesticQuoteInput {
  buildings: number
  contents: number
  allRisks: number
  servants: number
  ownersLiability: boolean
}

export interface MedicalQuoteInput {
  tierLimit: "1000000" | "2000000" | "5000000" | "10000000"
  familySize: "M" | "M+1" | "M+2" | "M+3" | "M+4"
  outpatient: boolean
  dental: boolean
  optical: boolean
  maternity: boolean
}

export interface AdvisoryQuoteParams {
  selectedClass: string
  motor: MotorQuoteInput
  domestic: DomesticQuoteInput
  medical: MedicalQuoteInput
}

export function buildAdvisoryQuoteInputs(
  params: AdvisoryQuoteParams,
): Record<string, unknown> {
  if (params.selectedClass === "Motor Private") {
    return {
      sum_insured: params.motor.sumInsured,
      extensions: {
        pvt: params.motor.pvt,
        excess_protector: params.motor.excessProtector,
        passenger_liability: params.motor.passengerLiability,
        road_rescue: params.motor.roadRescue,
        courtesy_car: params.motor.courtesyCar,
      },
    }
  }

  if (params.selectedClass === "Domestic Package") {
    return {
      buildings_sum_insured: params.domestic.buildings,
      contents_sum_insured: params.domestic.contents,
      all_risks_sum_insured: params.domestic.allRisks,
      number_of_servants: params.domestic.servants,
      include_owners_liability: params.domestic.ownersLiability,
    }
  }

  return {
    tier_limit: params.medical.tierLimit,
    family_size: params.medical.familySize,
    riders: {
      outpatient: params.medical.outpatient,
      dental: params.medical.dental,
      optical: params.medical.optical,
      maternity: params.medical.maternity,
    },
  }
}

export function parseQuoteBreakdown(
  quoteResponse: CalculationQuoteResponse | null | undefined,
  selectedClass: string,
): ParsedQuoteBreakdown {
  const calcDetail = quoteResponse?.calculation_detail ?? {}
  const provenance = quoteResponse?.rule_provenance ?? {}

  const basePremium = Number(
    calcDetail.base_premium ?? quoteResponse?.basic_premium ?? 0,
  )
  const netPremium = Number(quoteResponse?.net_premium ?? 0)
  const itl = Number(quoteResponse?.training_levy ?? 0)
  const phcf = Number(quoteResponse?.phcf ?? 0)
  const stampDuty = Number(quoteResponse?.stamp_duty ?? 0)
  const totalAmount = Number(quoteResponse?.total_amount ?? 0)
  const appliedRate =
    calcDetail.applied_rate !== undefined
      ? Number(calcDetail.applied_rate)
      : null
  const minimumFloor =
    calcDetail.minimum_premium_floor !== undefined
      ? Number(calcDetail.minimum_premium_floor)
      : null
  const benefitLines = Array.isArray(calcDetail.benefits)
    ? (calcDetail.benefits as QuoteBenefitLine[])
    : []
  const provenanceLabel = String(
    provenance.version_label ||
      provenance.engine_version ||
      provenance.rate_table_version_id ||
      "backend-decimal",
  )
  const isStampDutyExempt = selectedClass === "Medical" || stampDuty === 0

  return {
    basePremium,
    netPremium,
    itl,
    phcf,
    stampDuty,
    totalAmount,
    appliedRate,
    minimumFloor,
    benefitLines,
    provenanceLabel,
    isStampDutyExempt,
  }
}

export function formatQuoteBreakdownText(
  selectedClass: string,
  breakdown: ParsedQuoteBreakdown,
): string {
  const textLines = [
    `HEALTHWATCH ADVISORY RATING BREAKDOWN`,
    `Class of Insurance: ${selectedClass}`,
    `Base Premium: ${formatCurrency(breakdown.basePremium)}`,
    ...breakdown.benefitLines.map(
      (b) =>
        `  - ${b.name || b.label}: ${b.is_complimentary ? "COMPLIMENTARY" : formatCurrency(Number(b.amount ?? 0))} (${b.rate_description || ""})`,
    ),
    `Net Premium: ${formatCurrency(breakdown.netPremium)}`,
    `Statutory Levies:`,
    `  - Training Levy (0.20%): ${formatCurrency(breakdown.itl)}`,
    `  - PHCF Levy (0.25%): ${formatCurrency(breakdown.phcf)}`,
    `  - Stamp Duty: ${breakdown.isStampDutyExempt ? "EXEMPT (KES 0.00)" : formatCurrency(breakdown.stampDuty)}`,
    `Total Premium: ${formatCurrency(breakdown.totalAmount)}`,
    `Provenance: ${breakdown.provenanceLabel}`,
  ]
  return textLines.join("\n")
}
