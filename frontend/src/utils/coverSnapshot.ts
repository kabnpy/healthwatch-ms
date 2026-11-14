/**
 * Pure in-process helpers for shaping quote inputs, building persisted
 * RiskNote.cover_snapshot payloads, and extracting cover summaries.
 */
import { injectWizardData } from "./documentData"

export interface CoverExtensionsInput {
  pvt?: boolean
  excessProtector?: boolean
  omRescuePlus?: boolean
  passengerLiability?: boolean
}

export interface CoverTermsInput {
  benefits_and_limits: string
  excesses: string
  special_clauses: string
}

export function extractSumInsured(details: unknown): number {
  if (!details || typeof details !== "object") return 0
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (/sum_insured|value|sum insured/i.test(k) && typeof v !== "object") {
      const cleanVal = typeof v === "string" ? v.replace(/[^0-9.]/g, "") : v
      return Number(cleanVal) || 0
    }
    if (typeof v === "object" && v !== null) {
      const found = extractSumInsured(v)
      if (found !== 0) return found
    }
  }
  return 0
}

export function buildQuoteRiskDetails(params: {
  sumInsured: number
  rate?: number
  extensions?: CoverExtensionsInput
}): Record<string, unknown> {
  return {
    vehicle: {
      sum_insured: params.sumInsured,
    },
    ...(params.rate !== undefined ? { financials: { rate: params.rate } } : {}),
    extensions: {
      pvt: !!params.extensions?.pvt,
      excess_protector: !!params.extensions?.excessProtector,
      om_rescue_plus: !!params.extensions?.omRescuePlus,
      passenger_liability: !!params.extensions?.passengerLiability,
    },
  }
}

function stripEmptySentinels(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(stripEmptySentinels)
      .filter((item) => item !== "[ EMPTY ]")
  }
  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === "[ EMPTY ]") continue
      cleaned[k] = stripEmptySentinels(v)
    }
    return cleaned
  }
  return value
}

export function buildCoverSnapshot(params: {
  blueprint: unknown
  details: Record<string, unknown>
  sumInsured: number
  extensions?: CoverExtensionsInput
  terms: CoverTermsInput
}): Record<string, unknown> {
  const injected = injectWizardData(params.blueprint, params.details)
  const structuredRiskDetails = (stripEmptySentinels(injected) ?? {}) as Record<
    string,
    unknown
  >

  const rawVehicleData =
    structuredRiskDetails.vehicle_details ?? structuredRiskDetails.vehicle
  const isMotor = rawVehicleData !== undefined
  const extensionData =
    (structuredRiskDetails.added_benefits as Record<string, unknown>) ??
    (structuredRiskDetails.extensions as Record<string, unknown>) ??
    {}

  const extensions = {
    ...extensionData,
    pvt: !!params.extensions?.pvt,
    excess_protector: !!params.extensions?.excessProtector,
    om_rescue_plus: !!params.extensions?.omRescuePlus,
    passenger_liability: !!params.extensions?.passengerLiability,
  }

  if (isMotor) {
    return {
      vehicle: {
        ...((rawVehicleData as Record<string, unknown>) ?? {}),
        sum_insured: params.sumInsured,
      },
      extensions,
      benefits_and_limits: params.terms.benefits_and_limits,
      excesses: params.terms.excesses,
      special_clauses: params.terms.special_clauses,
    }
  }

  const {
    added_benefits: _ab,
    extensions: _ext,
    ...restSections
  } = structuredRiskDetails

  return {
    ...restSections,
    extensions,
    benefits_and_limits: params.terms.benefits_and_limits,
    excesses: params.terms.excesses,
    special_clauses: params.terms.special_clauses,
  }
}

export interface CoverSummary {
  sumInsured: number
  vehicleReg: string | undefined
  makeModel: string | undefined
  extensions: string[]
}

export function extractCoverSummary(
  coverSnapshot: Record<string, unknown> | null | undefined,
): CoverSummary {
  if (!coverSnapshot || typeof coverSnapshot !== "object") {
    return {
      sumInsured: 0,
      vehicleReg: undefined,
      makeModel: undefined,
      extensions: [],
    }
  }

  const vehicle = (coverSnapshot.vehicle ??
    coverSnapshot.vehicle_details ??
    {}) as Record<string, unknown>

  const sumInsured =
    vehicle.sum_insured !== undefined
      ? Number(vehicle.sum_insured) || 0
      : extractSumInsured(coverSnapshot)

  const rawReg =
    vehicle.reg_no ??
    vehicle["Reg. No"] ??
    vehicle.registration_number ??
    vehicle.registration
  const vehicleReg =
    typeof rawReg === "string" && rawReg.trim() !== "" ? rawReg : undefined

  const make = typeof vehicle.make === "string" ? vehicle.make.trim() : ""
  const model = typeof vehicle.model === "string" ? vehicle.model.trim() : ""
  const makeModelStr = [make, model].filter(Boolean).join(" ")
  const makeModel = makeModelStr !== "" ? makeModelStr : undefined

  const extObj = (coverSnapshot.extensions ?? {}) as Record<string, unknown>
  const extensions = Object.entries(extObj)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k)

  return {
    sumInsured,
    vehicleReg,
    makeModel,
    extensions,
  }
}
