import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { useCreatePolicy, useProducts } from "@/hooks/useInsurance"
import { cn } from "@/lib/utils"
import type { EnhancedProduct, WizardState } from "@/types/insurance"
import { injectWizardData } from "@/utils/documentData"
import { StepAsset } from "./StepAsset"
import { StepBlueprint } from "./StepBlueprint"
import { StepFinancials } from "./StepFinancials"
import { StepReview } from "./StepReview"

const steps = ["Identity", "Asset", "Financials", "Review"]

interface NewPolicyWizardProps {
  clientId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function NewPolicyWizard({
  clientId,
  isOpen,
  onClose,
  onSuccess,
}: NewPolicyWizardProps) {
  const [step, setStep] = useState(0)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: productsData } = useProducts()

  const createPolicy = useCreatePolicy()

  const [state, setState] = useState<WizardState>({
    product_id: "",
    policy_number: "",
    sum_insured: 0,
    details: {},
    terms: {
      benefits_and_limits: "",
      excesses: "",
      special_clauses: "",
    },
    financials: {
      rate: 4.5,
      startDate: new Date().toISOString().split("T")[0],
      duration: 12,
    },
    extensions: {
      pvt: false,
      excessProtector: false,
      passengerLiability: false,
      omRescuePlus: false,
    },
  })

  const selectedProduct = useMemo(() => {
    return productsData?.data.find((p) => p.id === state.product_id) as
      | EnhancedProduct
      | undefined
  }, [state.product_id, productsData])

  const handleNext = (data: any) => {
    if (step === 0) {
      setState((prev) => ({ 
        ...prev, 
        product_id: data.product_id,
        policy_number: data.policy_number 
      }))
    } else if (step === 1) {
      // Sync logic: Extract "Value" or "Sum Insured" from details (recursive search)
      // Now using 'sum_insured' as the semantic key
      const findValue = (obj: any): number => {
        if (!obj || typeof obj !== "object") return 0
        for (const [k, v] of Object.entries(obj)) {
          // Look for sum_insured, value, or display aliases
          if (/sum_insured|value|sum insured/i.test(k) && typeof v !== "object") {
            const cleanVal =
              typeof v === "string" ? v.replace(/[^0-9.]/g, "") : v
            return Number(cleanVal) || 0
          }
          if (typeof v === "object") {
            const found = findValue(v)
            if (found !== 0) return found
          }
        }
        return 0
      }

      const extractedValue = findValue(data)

      setState((prev) => ({
        ...prev,
        details: data,
        sum_insured: extractedValue !== 0 ? extractedValue : prev.sum_insured,
        // Pre-populate terms from Product templates if not already set
        terms: {
          benefits_and_limits:
            prev.terms.benefits_and_limits ||
            selectedProduct?.default_benefits_and_limits ||
            "",
          excesses:
            prev.terms.excesses || selectedProduct?.default_excesses || "",
          special_clauses:
            prev.terms.special_clauses ||
            selectedProduct?.default_special_clauses ||
            "",
        },
      }))
    } else {
      setState((prev) => ({ ...prev, ...data }))
    }
    setStep((s) => s + 1)
  }

  const handleBack = () => {
    setStep((s) => s - 1)
  }

  const handleIssuePolicy = async () => {
    try {
      if (!selectedProduct) throw new Error("No product selected")

      const startDate =
        state.financials?.startDate || new Date().toISOString().split("T")[0]
      
      const durationMonths = state.financials?.duration || 12
      const endDateDate = new Date(startDate)
      
      // For standard 12-month terms, we use setFullYear to maintain day consistency 
      // (e.g., Feb 29 logic). For other durations, we use the month-based offset.
      if (durationMonths === 12) {
        endDateDate.setFullYear(endDateDate.getFullYear() + 1)
      } else {
        const targetMonth = endDateDate.getMonth() + durationMonths
        endDateDate.setMonth(targetMonth)
        // If the day of month shifted (e.g. Jan 31 -> March 3), roll back to last day of previous month
        if (endDateDate.getMonth() % 12 !== targetMonth % 12) {
          endDateDate.setDate(0)
        }
      }
      
      const endDate = endDateDate.toISOString().split("T")[0]

      // Structure the risk details using the product blueprint
      const structuredRiskDetails = injectWizardData(
        selectedProduct.product_details,
        state.details,
      )

      // Align with Atomic Snapshot Schema: Sensible Nesting
      // We merge the structured details from the blueprint with the explicit state from the wizard.
      // Note: The blueprint uses "vehicle_details", but the backend expects "vehicle"
      const vehicleData = structuredRiskDetails["vehicle_details"] || structuredRiskDetails["vehicle"] || {}
      const extensionData = structuredRiskDetails["added_benefits"] || structuredRiskDetails["extensions"] || {}

      const coverSnapshot = {
        vehicle: {
          ...vehicleData,
          sum_insured: state.sum_insured,
        },
        extensions: {
          ...extensionData,
          pvt: !!state.extensions?.pvt,
          excess_protector: !!state.extensions?.excessProtector,
          om_rescue_plus: !!state.extensions?.omRescuePlus,
          passenger_liability: !!state.extensions?.passengerLiability,
        },
        // Use the customized terms from the wizard state
        benefits_and_limits: state.terms.benefits_and_limits,
        excesses: state.terms.excesses,
        special_clauses: state.terms.special_clauses,
      }

      // Create Policy atomically
      await createPolicy.mutateAsync({
        policy_number: state.policy_number,
        client_id: clientId,
        product_id: state.product_id,
        status: "Active",
        inception_date: startDate,
        risk_details: coverSnapshot as any, // Pointing to the new structured object
        coverage_start: startDate,
        coverage_end: endDate,
      } as any)

      showSuccessToast("Policy Issued")
      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error("Policy Issuance Error:", err)
      let message = "Failed to issue policy"
      if (err.body?.detail) {
        message =
          typeof err.body.detail === "string"
            ? err.body.detail
            : JSON.stringify(err.body.detail)
      }
      showErrorToast(message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tighter">
            Policy Issuance: {steps[step]}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Progress Bar */}
          <div className="flex justify-between mb-8">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-1 font-bold uppercase tracking-wider",
                    i <= step ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>

          {step === 0 && (
            <StepAsset
              defaultValues={{ 
                product_id: state.product_id,
                policy_number: state.policy_number 
              }}
              onNext={handleNext}
            />
          )}
          {step === 1 && (
            <StepBlueprint
              productId={state.product_id}
              defaultValues={state.details}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {step === 2 && (
            <StepFinancials
              productId={state.product_id || ""}
              sum_insured={state.sum_insured}
              onSumInsuredChange={(val) => setState(prev => ({ ...prev, sum_insured: val }))}
              defaultValues={{
                financials: state.financials,
                extensions: state.extensions,
              }}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {step === 3 && (
            <StepReview
              state={state}
              onIssue={handleIssuePolicy}
              onBack={handleBack}
              isSubmitting={createPolicy.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
