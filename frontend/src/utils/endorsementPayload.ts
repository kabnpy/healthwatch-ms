import type { EndorsementCreate } from "@/client"

export interface EndorsementFormValues {
  effective_date?: string | null
  change_description: string
  updated_risk_details: Record<string, unknown>
}

export function buildEndorsementPayload(
  values: EndorsementFormValues,
): EndorsementCreate {
  const sanitizedDetails: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values.updated_risk_details)) {
    if (typeof value === "number" && Number.isNaN(value)) {
      continue
    }
    if (value !== undefined) {
      sanitizedDetails[key] = value
    }
  }

  const trimmedDate = values.effective_date?.trim()

  return {
    effective_date: trimmedDate ? trimmedDate : null,
    change_description: values.change_description.trim(),
    updated_risk_details: sanitizedDetails,
  }
}
