import React, { useMemo } from "react"
import { ArrowLeft } from "lucide-react"
import type { MotorFinancialBreakdown } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingButton } from "@/components/ui/loading-button"
import { useProducts, useQuoteQuery } from "@/hooks/useInsurance"
import type { EnhancedProduct, WizardState } from "@/types/insurance"

interface StepReviewProps {
  state: WizardState
  onIssue: () => void
  onBack: () => void
  isSubmitting?: boolean
}

export function StepReview({
  state,
  onIssue,
  onBack,
  isSubmitting,
}: StepReviewProps) {
  const { data: productsData } = useProducts()

  const selectedProduct = useMemo(() => {
    return productsData?.data.find((p) => p.id === state.product_id) as
      | EnhancedProduct
      | undefined
  }, [state.product_id, productsData])

  const isMotorPrivate = selectedProduct?.class_of_insurance
    ?.toLowerCase()
    .includes("motor private")

  const quoteRequest = useMemo(() => {
    if (!state.product_id || !isMotorPrivate) return null
    return {
      product_id: state.product_id,
      risk_details: {
        vehicle: {
          sum_insured: state.sum_insured,
        },
        extensions: {
          pvt: !!state.extensions?.pvt,
          excess_protector: !!state.extensions?.excessProtector,
          om_rescue_plus: !!state.extensions?.omRescuePlus,
          passenger_liability: !!state.extensions?.passengerLiability,
        },
      },
    }
  }, [
    state.product_id,
    state.sum_insured,
    state.extensions,
    isMotorPrivate,
  ])

  const { data: quoteData } = useQuoteQuery(quoteRequest as any)

  const breakdown =
    isMotorPrivate && quoteData?.breakdown
      ? (quoteData.breakdown as MotorFinancialBreakdown)
      : null

  const isPA = selectedProduct?.class_of_insurance
    ?.toLowerCase()
    .includes("personal accident")

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {/* Identity & Asset Summary */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="pb-3 bg-muted/10">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Identity & Asset
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Policy Number:</span>
              <span className="font-mono font-bold text-sm">{state.policy_number}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Insurance Product:</span>
              <span className="font-bold text-sm text-right">{selectedProduct?.name}</span>
            </div>
            <div className="border-t pt-3 mt-3 space-y-2">
              {(() => {
                const renderEntries = (
                  obj: any,
                  prefix = "",
                ): React.ReactNode => {
                  return Object.entries(obj || {}).map(([key, value]) => {
                    const label = prefix ? `${prefix} > ${key}` : key
                    // Filter for only the essential keys we show in the wizard
                    const essentialKeys = ["registration_number", "make", "year_of_manufacture"]
                    const lastKey = key.toLowerCase()
                    
                    if (!essentialKeys.includes(lastKey)) return null

                    return (
                      <div key={label} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-semibold uppercase tracking-tighter">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className="font-mono">{String(value)}</span>
                      </div>
                    )
                  })
                }
                const entries = renderEntries(state.details)
                return Object.keys(state.details || {}).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No manual inputs required.
                  </p>
                ) : (
                  entries
                )
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="pb-3 bg-muted/10">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between">
              <span>Financial Summary</span>
              {breakdown && (
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                  AUTHORITATIVE
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {!isPA && (
              <div className="flex justify-between text-sm items-baseline">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Sum Insured:</span>
                <span className="font-mono font-bold">
                  KES {(Number(state.sum_insured) || 0).toLocaleString()}
                </span>
              </div>
            )}

            {breakdown ? (
              <div className="space-y-2 border-y py-3 my-2 bg-muted/5 rounded px-2">
                <div className="flex justify-between text-xs items-baseline">
                  <span className="text-muted-foreground uppercase tracking-tighter font-semibold">Net Premium:</span>
                  <span className="font-mono font-bold">
                    {Number(breakdown.net_premium).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {breakdown.benefits?.map((benefit) => (
                  <div
                    key={benefit.name}
                    className="flex justify-between text-[10px] pl-4 italic"
                  >
                    <span className="text-muted-foreground uppercase tracking-tighter">
                      {benefit.name}:
                    </span>
                    <span className="font-mono text-slate-600">
                      {Number(benefit.amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
                {breakdown.taxes && Object.entries(breakdown.taxes).map(([name, amount]) => (
                  <div key={name} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground uppercase tracking-tighter">
                      {name.replace(/_/g, " ")}:
                    </span>
                    <span className="font-mono text-slate-600">
                      {Number(amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex justify-between pt-1 items-baseline">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Total Payable:</span>
              <span className="font-black text-xl text-emerald-600 font-mono tracking-tighter">
                KES{" "}
                {(breakdown
                  ? Number(breakdown.total_amount)
                  : 0
                ).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-xs items-baseline">
              <span className="text-muted-foreground uppercase tracking-tight font-medium">Coverage Start Date:</span>
              <span className="font-bold font-mono">{state.financials?.startDate}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-[11px] text-slate-600 leading-relaxed italic">
        Confirmation: The final Risk Note document will be generated by
        combining the above data with standard product terms and regulatory requirements.
      </div>

      <div className="flex justify-between pt-4 border-t gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="h-11 px-6"
        >
          <ArrowLeft className="size-4 mr-2" /> Back: Financials
        </Button>
        <LoadingButton
          onClick={onIssue}
          loading={isSubmitting}
          className="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-10 font-black uppercase tracking-widest text-xs"
        >
          Issue Policy
        </LoadingButton>
      </div>
    </div>
  )
}
