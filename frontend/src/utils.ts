import { AxiosError } from "axios"
import type { ApiError } from "./client"

function extractErrorMessage(err: Error): string {
  if (err instanceof AxiosError) {
    const errDetail = (err.response?.data as any)?.detail
    if (Array.isArray(errDetail) && errDetail.length > 0) {
      return errDetail[0].msg
    }
    if (typeof errDetail === "string") {
      return errDetail
    }
    return err.message
  }
  return (err as any)?.message || "Something went wrong."
}

export const handleError = function (
  this: (msg: string) => void,
  err: Error | ApiError,
) {
  const errorMessage = extractErrorMessage(err)
  this(errorMessage)
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // Replace spaces with _
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

/**
 * Deeply searches an object for a value matching any of the provided keys.
 */
export const recursiveSearch = (obj: any, targetKeys: string[]): any => {
  if (!obj || typeof obj !== "object") return null

  // 1. Try immediate keys (case-insensitive)
  for (const [key, value] of Object.entries(obj)) {
    if (
      targetKeys.some((tk) => tk.toLowerCase() === key.toLowerCase().trim())
    ) {
      if (value && typeof value === "string" && !value.includes("<<")) {
        return value
      }
    }
  }

  // 2. Recurse into children
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      const found = recursiveSearch(value, targetKeys)
      if (found) return found
    }
  }

  return null
}

export const getPolicyDisplayName = (riskNote: any): string => {
  const policySnapshot = riskNote?.policy_snapshot || {}
  const riskDetails =
    policySnapshot?.risk_details || riskNote?.policy?.risk_details || {}

  // 1. Determine Base Class Name
  const className =
    policySnapshot?.product?.class_of_insurance ||
    riskNote?.policy?.product?.class_of_insurance ||
    policySnapshot?.product?.name ||
    riskNote?.policy?.product?.name ||
    "Insurance Policy"

  const trimmedClass = className.trim()

  // 2. Robust Extraction for Motor Private
  if (trimmedClass.toLowerCase().includes("motor private")) {
    const regNo = recursiveSearch(riskDetails, [
      "reg_no",
      "Reg No",
      "Reg. No",
      "Registration",
    ])
    if (regNo) {
      return `${trimmedClass} - ${regNo.trim()}`
    }
  }

  // 3. General Redundancy Check for Description
  const description =
    policySnapshot?.description || riskNote?.policy?.description
  if (description) {
    const trimmedDesc = description.trim()
    if (
      trimmedDesc &&
      trimmedDesc.toLowerCase() !== trimmedClass.toLowerCase()
    ) {
      return `${trimmedClass} - ${trimmedDesc}`
    }
  }

  return trimmedClass
}

export const formatCurrency = (
  amount: number | string | undefined | null,
): string => {
  if (amount === undefined || amount === null) return "Kshs. 0.00"
  const numericAmount =
    typeof amount === "string" ? Number.parseFloat(amount) : amount
  if (Number.isNaN(numericAmount)) return "Kshs. 0.00"

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  })
    .format(numericAmount)
    .replace("KES", "Kshs.")
}
