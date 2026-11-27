import { useQuery } from "@tanstack/react-query"
import {
  type RateBenefitPublic,
  type RateBracketPublic,
  RateTablesService,
  type RateTableVersionPublic,
} from "../client"

export interface MedicalTierItem {
  id: string
  inpatient_limit: string | number
  family_size?: string
  m_premium?: string | number
  m1_premium?: string | number
  m2_premium?: string | number
  m3_premium?: string | number
  m4_premium?: string | number
  annual_premium?: string | number
}

export type RateTableVersionDetail = RateTableVersionPublic & {
  brackets?: RateBracketPublic[]
  benefits?: RateBenefitPublic[]
  medical_tiers?: MedicalTierItem[]
}

export interface UsePublishedRateTableParams {
  insurerId?: string | null
  classOfInsurance: string
}

/**
 * Fetches the active published RateTableVersion and its full detail
 * (brackets, benefits, medical tiers) for an insurer and class of insurance.
 */
export function usePublishedRateTable({
  insurerId,
  classOfInsurance,
}: UsePublishedRateTableParams) {
  return useQuery<RateTableVersionDetail | null>({
    queryKey: ["rate-tables", "published", insurerId ?? null, classOfInsurance],
    queryFn: async () => {
      const listRes = await RateTablesService.tablesReadRateTables({
        query: {
          insurer_id: insurerId ?? null,
          class_of_insurance: classOfInsurance,
          status: "published",
          limit: 1,
        },
      })
      const published = listRes.data?.data?.[0]
      if (!published) return null
      const detailRes = await RateTablesService.tablesReadRateTable({
        path: { id: published.id },
      })
      return detailRes.data ?? published
    },
  })
}
