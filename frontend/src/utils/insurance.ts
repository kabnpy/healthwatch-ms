import type { PolicyPublic } from "@/client"
import { extractCoverSummary } from "./coverSnapshot"

/**
 * Derives a display name for a policy based on its product and latest snapshot.
 */
export function getPolicyDisplayName(policy: PolicyPublic): string {
  if (!policy) return "Policy"
  if (!policy.product) {
    return policy.policy_number || "Policy"
  }

  const baseName = policy.product.class_of_insurance || policy.product.name
  const rawSnapshot = (policy as any).active_note?.cover_snapshot as
    | Record<string, unknown>
    | null
    | undefined

  const { vehicleReg, makeModel } = extractCoverSummary(rawSnapshot)
  if (vehicleReg) {
    return `${baseName} - ${vehicleReg}`
  }
  if (makeModel) {
    return `${baseName} - ${makeModel}`
  }

  // Look for non-vehicle identification keys in the snapshot
  function findIdValue(obj: any): string | null {
    if (!obj || typeof obj !== "object") return null

    const priorityKeys = ["serial_number", "id_number", "name"]
    for (const k of priorityKeys) {
      if (obj[k] && typeof obj[k] === "string") return obj[k]
    }

    for (const v of Object.values(obj)) {
      const res = findIdValue(v)
      if (res) return res
    }
    return null
  }

  const idVal = findIdValue(rawSnapshot || {})
  if (idVal) {
    return `${baseName} - ${idVal}`
  }

  // Also check policy.vehicles if available
  if (policy.vehicles && policy.vehicles.length > 0) {
    const v = policy.vehicles[0]
    const details = [v.registration_number, v.make, v.model]
      .filter(Boolean)
      .join(" ")
    if (details) {
      return `${baseName} - ${details}`
    }
  }

  return baseName
}
