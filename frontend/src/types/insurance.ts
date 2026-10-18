import type React from "react"
import type {
  ClientPublic,
  InsurerPublic,
  PolicyPublic,
  ProductPublic,
  RiskNotePublic,
} from "@/client"

/**
 * Enhanced versions of the auto-generated types with better metadata and relationships
 */

export interface EnhancedProduct extends ProductPublic {
  insurer?: InsurerPublic
}

export interface EnhancedPolicy extends PolicyPublic {
  product?: EnhancedProduct
  client?: ClientPublic
}

export interface EnhancedRiskNote extends RiskNotePublic {
  policy?: EnhancedPolicy
}

/**
 * Types for the Document Rendering Engine
 */

export type RiskNoteContentValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | React.ReactNode
  | RiskNoteContentValue[]
  | { [key: string]: RiskNoteContentValue }

export interface RiskNoteSection {
  name: string
  content: RiskNoteContentValue
}

/**
 * Wizard State Types
 */

export interface WizardFinancials {
  rate: number
  basicRate?: number
  isHighEnd?: boolean
  startDate: string
  duration: number
}

export interface WizardExtensions {
  pvt: boolean
  excessProtector: boolean
  passengerLiability: boolean
  omRescuePlus: boolean
}

export interface WizardState {
  product_id: string
  policy_number: string
  sum_insured: number
  details: Record<string, any>
  terms: {
    benefits_and_limits: string
    excesses: string
    special_clauses: string
  }
  financials: WizardFinancials
  extensions: WizardExtensions
}
