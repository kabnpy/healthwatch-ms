import { ArrowLeft } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingButton } from "@/components/ui/loading-button"
import { useProducts, useQuoteQuery } from "@/hooks/usePolicies"
import type { EnhancedProduct, WizardState } from "@/types/insurance"
import { buildQuoteRiskDetails } from "@/utils/coverSnapshot"
import { classifyProduct, filterReviewAssetEntries } from "./policyWizard"

interface StepReviewProps {
  state: WizardState
  onIssue: () => void
  onBack: () => void
  onJumpToStep?: (step: number) => void
  isSubmitting?: boolean
}

export function StepReview({
  state,
  onIssue,
  onBack,
  onJumpToStep,
  isSubmitting,
}: StepReviewProps) {
  const { data: productsData } = useProducts()

  const selectedProduct = useMemo(() => {
    return productsData?.data.find((p) => p.id === state.product_id) as
      | EnhancedProduct
      | undefined
  }, [state.product_id, productsData])

  const { isMotorPrivate, isPA } = classifyProduct(selectedProduct)

  const quoteRequest = useMemo(() => {
    if (!state.product_id || !isMotorPrivate) return null
    return {
      product_id: state.product_id,
      inputs: buildQuoteRiskDetails({
        sumInsured: state.sum_insured,
        extensions: state.extensions,
      }),
    }
  }, [state.product_id, state.sum_insured, state.extensions, isMotorPrivate])

  const { data: quoteData } = useQuoteQuery(quoteRequest)

  const breakdown = isMotorPrivate && quoteData ? quoteData : null
  const benefits = Array.isArray(quoteData?.calculation_detail?.benefits)
    ? (quoteData.calculation_detail.benefits as Array<{
        name: string
        amount: number | string
      }>)
    : []

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {/* Identity & Asset Summary */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="pb-3 bg-muted/10 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Identity & Asset
            </CardTitle>
            {onJumpToStep && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs font-semibold"
                  onClick={() => onJumpToStep(0)}
                >
                  Change<span className="sr-only"> Identity</span>
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs font-semibold"
                  onClick={() => onJumpToStep(1)}
                >
                  Change<span className="sr-only"> Asset</span>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">
                Policy Number:
              </span>
              <span className="font-mono font-bold text-sm">
                {state.policy_number}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">
                Insurance Product:
              </span>
              <span className="font-bold text-sm text-right">
                {selectedProduct?.name}
              </span>
            </div>
            <div className="border-t pt-3 mt-3 space-y-2">
              {Object.keys(state.details || {}).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No manual inputs required.
                </p>
              ) : (
                filterReviewAssetEntries(state.details).map((entry) => (
                  <div
                    key={entry.key}
                    className="flex justify-between text-[11px]"
                  >
                    <span className="text-muted-foreground font-semibold uppercase tracking-tighter">
                      {entry.label}:
                    </span>
                    <span className="font-mono">{entry.value}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="pb-3 bg-muted/10">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between items-center">
              <span>Financial Summary</span>
              <div className="flex items-center gap-3">
                {breakdown && (
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                    AUTHORITATIVE
                  </span>
                )}
                {onJumpToStep && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-semibold"
                    onClick={() => onJumpToStep(2)}
                  >
                    Change<span className="sr-only"> Financials</span>
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {!isPA && (
              <div className="flex justify-between text-sm items-baseline">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">
                  Sum Insured:
                </span>
                <span className="font-mono font-bold">
                  KES {(Number(state.sum_insured) || 0).toLocaleString()}
                </span>
              </div>
            )}

            {breakdown ? (
              <div className="space-y-2 border-y py-3 my-2 bg-muted/5 rounded px-2">
                <div className="flex justify-between text-xs items-baseline">
                  <span className="text-muted-foreground uppercase tracking-tighter font-semibold">
                    Net Premium:
                  </span>
                  <span className="font-mono font-bold">
                    {Number(breakdown.net_premium).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {benefits.map((benefit) => (
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
                {breakdown.taxes &&
                  Object.entries(breakdown.taxes).map(([name, amount]) => (
                    <div
                      key={name}
                      className="flex justify-between text-[10px]"
                    >
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
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">
                Total Payable:
              </span>
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
              <span className="text-muted-foreground uppercase tracking-tight font-medium">
                Coverage Start Date:
              </span>
              <span className="font-bold font-mono">
                {state.financials?.startDate}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-[11px] text-slate-600 leading-relaxed italic">
        Confirmation: The final Risk Note document will be generated by
        combining the above data with standard product terms and regulatory
        requirements.
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
