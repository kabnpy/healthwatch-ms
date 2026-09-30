import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { MotorFinancialBreakdown } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useProducts, useQuote } from "@/hooks/useInsurance"
import type {
  EnhancedProduct,
  WizardExtensions,
  WizardFinancials,
} from "@/types/insurance"

const financialsSchema = z.object({
  financials: z.object({
    rate: z.coerce.number().min(0),
    basicRate: z.coerce.number().optional(),
    isHighEnd: z.boolean().optional(),
    startDate: z.string(),
    duration: z.coerce.number().default(12),
  }),
  extensions: z.object({
    pvt: z.boolean().default(false),
    excessProtector: z.boolean().default(false),
    passengerLiability: z.boolean().default(false),
    omRescuePlus: z.boolean().default(false),
  }),
})

interface StepFinancialsProps {
  defaultValues: {
    financials: WizardFinancials
    extensions: WizardExtensions
  }
  onNext: (data: any) => void
  onBack: () => void
  onSumInsuredChange?: (value: number) => void
  productId: string
  sum_insured: number
}

export function StepFinancials({
  defaultValues,
  onNext,
  onBack,
  onSumInsuredChange,
  productId,
  sum_insured,
}: StepFinancialsProps) {
  const { data: productsData } = useProducts()
  const quoteMutation = useQuote()

  const handleSumInsuredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "")
    const num = Number(raw) || 0
    onSumInsuredChange?.(num)
  }

  const selectedProduct = useMemo(() => {
    return productsData?.data.find((p) => p.id === productId) as
      | EnhancedProduct
      | undefined
  }, [productId, productsData])

  const form = useForm({
    resolver: zodResolver(financialsSchema),
    defaultValues: {
      financials: {
        rate: defaultValues.financials?.rate || 0,
        basicRate: defaultValues.financials?.basicRate || 0,
        isHighEnd: defaultValues.financials?.isHighEnd || false,
        startDate:
          defaultValues.financials?.startDate ||
          new Date().toISOString().split("T")[0],
        duration: defaultValues.financials?.duration || 12,
      },
      extensions: {
        pvt: defaultValues.extensions?.pvt || false,
        excessProtector: defaultValues.extensions?.excessProtector || false,
        passengerLiability:
          defaultValues.extensions?.passengerLiability || false,
        omRescuePlus: defaultValues.extensions?.omRescuePlus || false,
      },
    },
  })

  const watchedValues = form.watch() as any
  const financials = watchedValues.financials || {}
  const extensions = watchedValues.extensions || {}

  const isPA = selectedProduct?.class_of_insurance
    ?.toLowerCase()
    .includes("personal accident")

  const isMotor = selectedProduct?.class_of_insurance
    ?.toLowerCase()
    .includes("motor")

  const isMotorPrivate = selectedProduct?.class_of_insurance
    ?.toLowerCase()
    .includes("motor private")

  const isManual = selectedProduct?.pricing_strategy === "Manual"

  // 1. Debounced Backend Quote
  useEffect(() => {
    if (!productId) return

    const timer = setTimeout(() => {
      quoteMutation.mutate({
        product_id: productId,
        risk_details: {
          vehicle: {
            sum_insured: sum_insured,
          },
          financials: {
            rate: financials.rate || 0,
          },
          extensions: {
            pvt: !!extensions.pvt,
            excess_protector: !!extensions.excessProtector,
            om_rescue_plus: !!extensions.omRescuePlus,
            passenger_liability: !!extensions.passengerLiability,
          },
        },
      })
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [
    productId,
    sum_insured,
    financials.rate,
    extensions.pvt,
    extensions.excessProtector,
    extensions.omRescuePlus,
    extensions.passengerLiability,
    quoteMutation.mutate,
  ])

  // 2. authoritative source of truth
  const breakdown = quoteMutation.data?.breakdown as
    | MotorFinancialBreakdown
    | undefined

  // Auto-set rate for Motor Private
  useEffect(() => {
    if (breakdown) {
      if (isMotorPrivate && Number(breakdown.net_premium) > 0) {
        // Reverse calculate effective rate for display (inclusive of non-tax extensions)
        const siNum = Number(sum_insured) || 1
        const effectiveRate = (Number(breakdown.net_premium) / siNum) * 100
        if (Math.abs(effectiveRate - financials.rate) > 0.001) {
          form.setValue("financials.rate", Number(effectiveRate.toFixed(3)))
        }
      }

      if (breakdown.basic_rate !== undefined) {
        form.setValue(
          "financials.basicRate",
          Number(breakdown.basic_rate) * 100,
        )
      }
      if (breakdown.is_high_end !== undefined) {
        form.setValue("financials.isHighEnd", breakdown.is_high_end)
      }
    }
  }, [
    isMotorPrivate,
    breakdown?.net_premium,
    breakdown?.basic_rate,
    breakdown?.is_high_end,
    sum_insured,
    financials.rate,
    form.setValue,
    breakdown,
  ])

  // High-End Logic: Auto-select included benefits
  useEffect(() => {
    if (isMotorPrivate && (Number(sum_insured) || 0) >= 3000000) {
      if (!extensions.pvt) form.setValue("extensions.pvt", true)
      if (!extensions.excessProtector)
        form.setValue("extensions.excessProtector", true)
    }
  }, [
    isMotorPrivate,
    sum_insured,
    extensions.excessProtector,
    extensions.pvt,
    form.setValue,
  ])

  const isHighEnd = isMotorPrivate && (Number(sum_insured) || 0) >= 3000000

  return (
    <Form {...(form as any)}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-8">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight">
            Financials & Coverage
          </h3>
          <p className="text-sm text-muted-foreground">
            Review the insured value and define the duration of protection.
          </p>
        </div>

        <div className="space-y-8">
          {/* Inputs Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!isPA && (
                <div className="space-y-2">
                  <FormLabel>Sum Insured (KES)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      value={(Number(sum_insured) || 0).toLocaleString()}
                      onChange={handleSumInsuredChange}
                      className="h-12 text-base font-bold"
                    />
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground">
                    Define the authoritative value of the asset.
                  </p>
                </div>
              )}
              <FormField
                control={form.control as any}
                name="financials.rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isPA ? "Premium (Flat Amount)" : "Applied Rate (%)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value || 0}
                        readOnly={!!isMotorPrivate && !isManual}
                        className={`h-12 text-base ${isMotorPrivate && !isManual ? "bg-muted/50" : ""}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
              <FormField
                control={form.control as any}
                name="financials.startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coverage Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="financials.duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Duration (Months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || 12}
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isMotor && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                    Benefits (Extensions)
                  </h3>
                  {isHighEnd && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      High-End: All Inclusive
                    </span>
                  )}
                </div>

                <div className="space-y-3 border rounded-md p-4 bg-muted/10">
                  <FormField
                    control={form.control as any}
                    name="extensions.pvt"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between space-y-0 rounded-lg p-2 border bg-card">
                        <FormLabel className="text-sm cursor-pointer w-full">
                          Political Violence & Terrorism (0.25%)
                          {isHighEnd && (
                            <span className="ml-2 text-[10px] font-bold text-emerald-600 block">
                              (INCLUDED)
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            disabled={isHighEnd}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control as any}
                    name="extensions.excessProtector"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between space-y-0 rounded-lg p-2 border bg-card">
                        <FormLabel className="text-sm cursor-pointer w-full">
                          Excess Protector (0.25%)
                          {isHighEnd && (
                            <span className="ml-2 text-[10px] font-bold text-emerald-600 block">
                              (INCLUDED)
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            disabled={isHighEnd}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {isMotorPrivate && (
                    <FormField
                      control={form.control as any}
                      name="extensions.passengerLiability"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between space-y-0 rounded-lg p-2 border bg-card">
                          <FormLabel className="text-sm cursor-pointer w-full">
                            Passenger Liability (KES 500)
                          </FormLabel>
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  {isMotorPrivate && (
                    <FormField
                      control={form.control as any}
                      name="extensions.omRescuePlus"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between space-y-0 rounded-lg p-2 border bg-card">
                          <FormLabel className="text-sm cursor-pointer w-full">
                            OM Rescue Plus (KES 1,000)
                          </FormLabel>
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="bg-slate-900 text-white rounded-lg p-6 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
              <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">
                Premium Preview
              </h3>
              <div className="text-right text-[10px] font-mono text-slate-500 flex items-center gap-2">
                {quoteMutation.isPending && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                )}
                {breakdown ? "AUTHORITATIVE MATH" : "ESTIMATED"}
              </div>
            </div>

            <div className="space-y-6">
              {!breakdown && !quoteMutation.isPending ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">
                    Awaiting Input
                  </p>
                  <p className="text-slate-600 text-[10px] italic">
                    Enter sum insured to generate authoritative quote
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="text-slate-400">
                          {isPA ? "Base Premium" : "Basic Premium"}
                        </span>
                        {isMotorPrivate && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Applied Rate:{" "}
                            {(financials as any).basicRate || financials.rate}%
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          quoteMutation.isPending ? "opacity-40" : ""
                        }`}
                      >
                        {breakdown
                          ? Number(breakdown.net_premium).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                              },
                            )
                          : "0.00"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-tight">
                        Benefits
                      </span>
                      {breakdown?.benefits && breakdown.benefits.length > 0 ? (
                        breakdown.benefits.map((benefit: any) => (
                          <div
                            key={benefit.name}
                            className={`flex justify-between text-xs py-1 border-b border-slate-800 last:border-0 ${
                              quoteMutation.isPending ? "opacity-40" : ""
                            }`}
                          >
                            <span className="text-slate-300 italic">
                              {benefit.name}
                            </span>
                            <span className="font-mono">
                              {Number(benefit.amount).toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                },
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-600 italic">
                          No additional benefits included.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-slate-800 pt-4">
                    <div className="bg-slate-800/50 p-3 rounded space-y-2">
                      {breakdown?.taxes ? (
                        Object.entries(breakdown.taxes).map(
                          ([name, amount]) => (
                            <div
                              key={name}
                              className={`flex justify-between text-xs ${
                                quoteMutation.isPending ? "opacity-40" : ""
                              }`}
                            >
                              <span className="text-slate-400">
                                {name.replace("_", " ").toUpperCase()}
                              </span>
                              <span className="font-mono text-slate-300">
                                {Number(amount).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="text-[10px] text-slate-600 italic py-2">
                          Taxes will be calculated on quote
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-700">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-400 uppercase">
                          Total Amount
                        </span>
                        <div className="text-right">
                          <span
                            className={`text-2xl font-black text-emerald-400 font-mono ${
                              quoteMutation.isPending ? "opacity-40" : ""
                            }`}
                          >
                            <span className="text-sm font-normal mr-1">
                              KES
                            </span>
                            {breakdown
                              ? Number(breakdown.total_amount).toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                  },
                                )
                              : "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-6 border-t mt-4">
          <Button type="button" variant="outline" onClick={onBack} size="lg">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back: Asset Details
          </Button>
          <Button type="submit" size="lg" className="px-10">
            Next: Review & Issue
          </Button>
        </div>
      </form>
    </Form>
  )
}
