/**
 * Deterministic Advisory Rating Engine for HealthWatch MS
 * Synchronized with:
 * - docs/07_reference_catalog_and_seeding.md
 * - docs/insurance_agency_system_documentation.md (§4.14, §4.15)
 * - Insurance Act (Cap 487) Kenya statutory levies
 */

export interface RatingBreakdownLine {
  label: string
  rateDescription?: string
  amount: number
  isComplimentary?: boolean
  complimentaryReason?: string
}

export interface AdvisoryRatingResult {
  classOfInsurance: string
  pricingMethod:
    | "bracketed_percentage"
    | "multi_component"
    | "fixed_tier"
    | "flat_tariff"
    | "payroll_percentage"
  basePremium: number
  appliedRatePercent?: number
  minimumPremiumFloor?: number
  benefitLines: RatingBreakdownLine[]
  netPremium: number
  taxesAndLevies: {
    trainingLevy: number // 0.20% (Insurance Training Levy)
    phcfLevy: number // 0.25% (Policyholders Compensation Fund)
    stampDuty: number // KES 40.00 (0 for Medical)
    totalLevies: number
  }
  grossTotal: number
  ruleProvenance: {
    engineVersion: string
    underwriter?: string
    isMedicalStampDutyExempt: boolean
  }
}

// Fixed-Point Decimal Rounding (ROUND_HALF_UP to 2 decimal places)
export function roundToCents(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

// Statutory Levies
export const STATUTORY_RATES = {
  TRAINING_LEVY_PERCENT: 0.002, // 0.20%
  PHCF_LEVY_PERCENT: 0.0025, // 0.25%
  STAMP_DUTY_STANDARD: 40.0, // KES 40.00
}

/**
 * 1. MOTOR PRIVATE COMPREHENSIVE RATING
 */
export interface MotorRatingInputs {
  sumInsured: number
  extensions: {
    pvt?: boolean // Political Violence & Terrorism (0.25%)
    excessProtector?: boolean // Excess Protector (0.25%)
    passengerLiability?: boolean // KES 500
    roadRescue?: boolean // KES 1,000
    courtesyCar?: boolean // KES 3,000
  }
  highEndThreshold?: number // Default 3,000,000
}

export const MOTOR_PRIVATE_DEFAULT_TIERS = [
  {
    max: 1500000,
    rate: 0.05,
    min: 60000,
    label: "Up to KES 1.5M (5.00%, min KES 60K)",
  },
  {
    max: 2500000,
    rate: 0.04,
    min: 75000,
    label: "KES 1.5M – 2.5M (4.00%, min KES 75K)",
  },
  {
    max: 3000000,
    rate: 0.035,
    min: 100000,
    label: "KES 2.5M – 3.0M (3.50%, min KES 100K)",
  },
  { max: 5000000, rate: 0.0325, min: 0, label: "KES 3.0M – 5.0M (3.25%)" },
  { max: Infinity, rate: 0.03, min: 0, label: "Above KES 5.0M (3.00%)" },
]

export function calculateMotorPrivateRating(
  inputs: MotorRatingInputs,
): AdvisoryRatingResult {
  const value = Math.max(0, inputs.sumInsured || 0)
  const highEndThreshold = inputs.highEndThreshold || 3000000
  const isHighEnd = value >= highEndThreshold

  const tier =
    MOTOR_PRIVATE_DEFAULT_TIERS.find((t) => value <= t.max) ||
    MOTOR_PRIVATE_DEFAULT_TIERS[MOTOR_PRIVATE_DEFAULT_TIERS.length - 1]
  const calculatedBase = value * tier.rate
  const basePremium = roundToCents(Math.max(tier.min, calculatedBase))

  const benefitLines: RatingBreakdownLine[] = []
  let netPremium = basePremium

  // PVT Rider
  if (inputs.extensions.pvt) {
    if (isHighEnd) {
      benefitLines.push({
        label: "Political Violence & Terrorism (PVT)",
        rateDescription: "Complimentary (Sum Insured ≥ KES 3.0M)",
        amount: 0,
        isComplimentary: true,
        complimentaryReason: "High-end vehicle complimentary benefit",
      })
    } else {
      const pvtAmt = roundToCents(value * 0.0025)
      benefitLines.push({
        label: "Political Violence & Terrorism (PVT)",
        rateDescription: "0.25% of Sum Insured",
        amount: pvtAmt,
      })
      netPremium += pvtAmt
    }
  }

  // Excess Protector Rider
  if (inputs.extensions.excessProtector) {
    if (isHighEnd) {
      benefitLines.push({
        label: "Excess Protector (Own Damage)",
        rateDescription: "Complimentary (Sum Insured ≥ KES 3.0M)",
        amount: 0,
        isComplimentary: true,
        complimentaryReason: "High-end vehicle complimentary benefit",
      })
    } else {
      const epAmt = roundToCents(value * 0.0025)
      benefitLines.push({
        label: "Excess Protector (Own Damage)",
        rateDescription: "0.25% of Sum Insured",
        amount: epAmt,
      })
      netPremium += epAmt
    }
  }

  // Passenger Liability
  if (inputs.extensions.passengerLiability) {
    const plAmt = 500.0
    benefitLines.push({
      label: "Passenger Legal Liability",
      rateDescription: "Statutory flat rider",
      amount: plAmt,
    })
    netPremium += plAmt
  }

  // Road Rescue
  if (inputs.extensions.roadRescue) {
    const rescueAmt = 1000.0
    benefitLines.push({
      label: "24/7 Road Rescue Assistance",
      rateDescription: "Carrier rescue tariff",
      amount: rescueAmt,
    })
    netPremium += rescueAmt
  }

  // Courtesy Car
  if (inputs.extensions.courtesyCar) {
    const ccAmt = 3000.0
    benefitLines.push({
      label: "Courtesy Car Replacement (10 Days)",
      rateDescription: "Fixed option tariff",
      amount: ccAmt,
    })
    netPremium += ccAmt
  }

  netPremium = roundToCents(netPremium)
  const trainingLevy = roundToCents(
    netPremium * STATUTORY_RATES.TRAINING_LEVY_PERCENT,
  )
  const phcfLevy = roundToCents(netPremium * STATUTORY_RATES.PHCF_LEVY_PERCENT)
  const stampDuty = STATUTORY_RATES.STAMP_DUTY_STANDARD
  const totalLevies = roundToCents(trainingLevy + phcfLevy + stampDuty)
  const grossTotal = roundToCents(netPremium + totalLevies)

  return {
    classOfInsurance: "Motor Private",
    pricingMethod: "bracketed_percentage",
    basePremium,
    appliedRatePercent: tier.rate * 100,
    minimumPremiumFloor: tier.min,
    benefitLines,
    netPremium,
    taxesAndLevies: {
      trainingLevy,
      phcfLevy,
      stampDuty,
      totalLevies,
    },
    grossTotal,
    ruleProvenance: {
      engineVersion: "v2.14.0-ke-actuarial",
      isMedicalStampDutyExempt: false,
    },
  }
}

/**
 * 2. DOMESTIC PACKAGE RATING
 */
export interface DomesticRatingInputs {
  buildingsSumInsured: number
  contentsSumInsured: number
  allRisksSumInsured: number
  numberOfServants: number
  includeOwnersLiability?: boolean
}

export function calculateDomesticRating(
  inputs: DomesticRatingInputs,
): AdvisoryRatingResult {
  const bldgRate = 0.0012 // 0.12%
  const contRate = 0.0085 // 0.85%
  const allRisksRate = 0.0175 // 1.75%
  const servantCost = 1200.0 // KES 1,200/servant

  const bldgPremium = roundToCents((inputs.buildingsSumInsured || 0) * bldgRate)
  const contPremium = roundToCents((inputs.contentsSumInsured || 0) * contRate)
  const basePremium = roundToCents(bldgPremium + contPremium)

  const benefitLines: RatingBreakdownLine[] = []
  let netPremium = basePremium

  if (inputs.allRisksSumInsured > 0) {
    const arAmt = roundToCents(inputs.allRisksSumInsured * allRisksRate)
    benefitLines.push({
      label: "Section C: All Risks Valuables",
      rateDescription: "1.75% of declared schedule",
      amount: arAmt,
    })
    netPremium += arAmt
  }

  if (inputs.numberOfServants > 0) {
    const wibaAmt = roundToCents(inputs.numberOfServants * servantCost)
    benefitLines.push({
      label: `Section D: WIBA Domestic Servants (${inputs.numberOfServants})`,
      rateDescription: `KES 1,200 per indoor servant`,
      amount: wibaAmt,
    })
    netPremium += wibaAmt
  }

  if (inputs.includeOwnersLiability) {
    const liabAmt = 1500.0
    benefitLines.push({
      label: "Section E: Owners & Occupiers Legal Liability",
      rateDescription: "Limit of Indemnity KES 5,000,000",
      amount: liabAmt,
    })
    netPremium += liabAmt
  }

  netPremium = roundToCents(netPremium)
  const trainingLevy = roundToCents(
    netPremium * STATUTORY_RATES.TRAINING_LEVY_PERCENT,
  )
  const phcfLevy = roundToCents(netPremium * STATUTORY_RATES.PHCF_LEVY_PERCENT)
  const stampDuty = STATUTORY_RATES.STAMP_DUTY_STANDARD
  const totalLevies = roundToCents(trainingLevy + phcfLevy + stampDuty)
  const grossTotal = roundToCents(netPremium + totalLevies)

  return {
    classOfInsurance: "Domestic Package",
    pricingMethod: "multi_component",
    basePremium,
    benefitLines,
    netPremium,
    taxesAndLevies: {
      trainingLevy,
      phcfLevy,
      stampDuty,
      totalLevies,
    },
    grossTotal,
    ruleProvenance: {
      engineVersion: "v2.14.0-ke-actuarial",
      isMedicalStampDutyExempt: false,
    },
  }
}

/**
 * 3. MEDICAL / HEALTHCARE DEMOGRAPHIC TIER RATING
 */
export interface MedicalRatingInputs {
  tierLimit: "1000000" | "2000000" | "5000000" | "10000000"
  familySize: "M" | "M+1" | "M+2" | "M+3" | "M+4"
  riders: {
    outpatient?: boolean // KES 15,000/person
    dental?: boolean // KES 4,500/person
    optical?: boolean // KES 4,500/person
    maternity?: boolean // KES 12,000 flat
  }
}

export const MEDICAL_TIER_MATRIX: Record<string, Record<string, number>> = {
  "1000000": {
    M: 28000,
    "M+1": 44000,
    "M+2": 58000,
    "M+3": 70000,
    "M+4": 82000,
  },
  "2000000": {
    M: 38000,
    "M+1": 60000,
    "M+2": 78000,
    "M+3": 94000,
    "M+4": 110000,
  },
  "5000000": {
    M: 55000,
    "M+1": 88000,
    "M+2": 115000,
    "M+3": 138000,
    "M+4": 162000,
  },
  "10000000": {
    M: 75000,
    "M+1": 120000,
    "M+2": 155000,
    "M+3": 185000,
    "M+4": 215000,
  },
}

export function calculateMedicalRating(
  inputs: MedicalRatingInputs,
): AdvisoryRatingResult {
  const memberCountMap: Record<string, number> = {
    M: 1,
    "M+1": 2,
    "M+2": 3,
    "M+3": 4,
    "M+4": 5,
  }
  const members = memberCountMap[inputs.familySize] || 1
  const tierMatrix =
    MEDICAL_TIER_MATRIX[inputs.tierLimit] || MEDICAL_TIER_MATRIX["2000000"]
  const basePremium = tierMatrix[inputs.familySize] || 38000

  const benefitLines: RatingBreakdownLine[] = []
  let netPremium = basePremium

  if (inputs.riders.outpatient) {
    const opAmt = 15000 * members
    benefitLines.push({
      label: `Outpatient Cover (${members} Lives)`,
      rateDescription: `KES 15,000/person (Limit KES 100K)`,
      amount: opAmt,
    })
    netPremium += opAmt
  }

  if (inputs.riders.dental) {
    const dentalAmt = 4500 * members
    benefitLines.push({
      label: `Dental Care (${members} Lives)`,
      rateDescription: `KES 4,500/person (Limit KES 30K)`,
      amount: dentalAmt,
    })
    netPremium += dentalAmt
  }

  if (inputs.riders.optical) {
    const optAmt = 4500 * members
    benefitLines.push({
      label: `Optical Care (${members} Lives)`,
      rateDescription: `KES 4,500/person (Limit KES 30K)`,
      amount: optAmt,
    })
    netPremium += optAmt
  }

  if (inputs.riders.maternity) {
    const matAmt = 12000
    benefitLines.push({
      label: "Maternity Option",
      rateDescription: "Flat tariff (Limit KES 150K)",
      amount: matAmt,
    })
    netPremium += matAmt
  }

  netPremium = roundToCents(netPremium)
  const trainingLevy = roundToCents(
    netPremium * STATUTORY_RATES.TRAINING_LEVY_PERCENT,
  )
  const phcfLevy = roundToCents(netPremium * STATUTORY_RATES.PHCF_LEVY_PERCENT)
  const stampDuty = 0.0 // Statutory exemption for Medical policies under Kenya Stamp Duty Act
  const totalLevies = roundToCents(trainingLevy + phcfLevy + stampDuty)
  const grossTotal = roundToCents(netPremium + totalLevies)

  return {
    classOfInsurance: "Medical / Healthcare",
    pricingMethod: "fixed_tier",
    basePremium,
    benefitLines,
    netPremium,
    taxesAndLevies: {
      trainingLevy,
      phcfLevy,
      stampDuty,
      totalLevies,
    },
    grossTotal,
    ruleProvenance: {
      engineVersion: "v2.14.0-ke-actuarial",
      isMedicalStampDutyExempt: true,
    },
  }
}
