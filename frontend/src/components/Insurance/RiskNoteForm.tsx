import { zodResolver } from "@hookform/resolvers/zod"
import { Calculator } from "lucide-react"
import { useEffect, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import type { ApiError, RiskNoteStatus } from "@/client"
import { AdvisoryRatingCalculator } from "@/components/Insurance/AdvisoryRatingCalculator"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import {
  useCreateRiskNote,
  usePolicy,
  useRiskNote,
  useUpdateRiskNote,
} from "@/hooks/useInsurance"
import { handleError } from "@/utils"
import type { AdvisoryRatingResult } from "@/utils/ratingCalculator"

interface RiskNoteFormProps {
  policyId: string
  riskNoteId?: string // If provided, we are editing an existing (likely draft) risk note
  initialTransactionType?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export const RiskNoteForm = ({
  policyId,
  riskNoteId,
  initialTransactionType = "Endorsement",
  onSuccess,
  onCancel,
}: RiskNoteFormProps) => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: policy, isLoading: isLoadingPolicy } = usePolicy(policyId)
  const { data: existingRiskNote, isLoading: isLoadingRiskNote } = useRiskNote(
    riskNoteId || "",
  )
  const createRiskNote = useCreateRiskNote()
  const updateRiskNote = useUpdateRiskNote()
  const [ratingCalcOpen, setRatingCalcOpen] = useState(false)

  const formSchema = z.object({
    transaction_type: z.string().min(1),
    coverage_start: z.string().min(1),
    coverage_end: z.string().min(1),
    status: z.string().min(1),
    net_premium: z.coerce.number().min(0),
    commission_amount: z.coerce.number().min(0),
    details: z.record(z.string(), z.any()), // Dynamic fields from form_schema
  })

  type FormData = z.infer<typeof formSchema>

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      transaction_type: initialTransactionType,
      coverage_start: new Date().toISOString().split("T")[0],
      coverage_end: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1),
      )
        .toISOString()
        .split("T")[0],
      status: "Draft",
      net_premium: 0,
      commission_amount: 0,
      details: {},
    },
  })

  // Populate form when data is loaded
  useEffect(() => {
    if (existingRiskNote) {
      const coverSnapshot = existingRiskNote.cover_snapshot || {}
      const existingRN = existingRiskNote as any

      form.reset({
        transaction_type: existingRiskNote.transaction_type,
        coverage_start:
          existingRiskNote.coverage_start ||
          (existingRiskNote as any).start_date,
        coverage_end:
          existingRiskNote.coverage_end || (existingRiskNote as any).end_date,
        status: existingRN.status || "Draft",
        net_premium: Number(existingRiskNote.net_premium),
        commission_amount: Number(existingRiskNote.commission_amount),
        details: coverSnapshot,
      })
    } else if (policy) {
      const activeNote = (policy as any).active_note
      form.reset({
        transaction_type: initialTransactionType,
        coverage_start:
          activeNote?.coverage_start || new Date().toISOString().split("T")[0],
        coverage_end:
          activeNote?.coverage_end ||
          new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            .toISOString()
            .split("T")[0],
        status: "Draft",
        net_premium: Number(activeNote?.net_premium || 0),
        commission_amount: Number(activeNote?.commission_amount || 0),
        details: activeNote?.cover_snapshot || {},
      })
    }
  }, [existingRiskNote, policy, form, initialTransactionType])

  const handleApplyRating = (res: AdvisoryRatingResult) => {
    form.setValue("net_premium", res.netPremium)
    const commRate =
      Number(policy?.product?.default_commission_rate || 10) / 100
    form.setValue(
      "commission_amount",
      Math.round(res.netPremium * commRate * 100) / 100,
    )

    const currentDetails = form.getValues("details") || {}
    form.setValue("details", {
      ...currentDetails,
      advisory_calculation: {
        base_premium: res.basePremium,
        applied_rate: res.appliedRatePercent,
        benefits: res.benefitLines,
        net_premium: res.netPremium,
        taxes: res.taxesAndLevies,
        gross_total: res.grossTotal,
        engine_version: res.ruleProvenance.engineVersion,
      },
    })
  }

  const onSubmit: SubmitHandler<FormData> = (data) => {
    const isMedical =
      policy?.product?.class_of_insurance?.toLowerCase().includes("medical") ||
      false
    const stampDuty = isMedical ? 0 : 40.0
    const trainingLevy = Math.round(data.net_premium * 0.002 * 100) / 100
    const phcf = Math.round(data.net_premium * 0.0025 * 100) / 100
    const total_amount =
      Math.round((data.net_premium + trainingLevy + phcf + stampDuty) * 100) /
      100

    const payload = {
      policy_id: policyId,
      transaction_type: data.transaction_type as any,
      coverage_start: data.coverage_start,
      coverage_end: data.coverage_end,
      net_premium: data.net_premium,
      commission_amount: data.commission_amount,
      status: data.status as RiskNoteStatus,
      cover_snapshot: data.details,
      financial_breakdown: {
        taxes: {
          training_levy: trainingLevy,
          phcf,
          stamp_duty: stampDuty,
        },
        net_premium: data.net_premium,
        total_amount,
        commission_amount: data.commission_amount,
      },
      total_amount,
    }

    if (riskNoteId) {
      updateRiskNote.mutate(
        { id: riskNoteId, data: payload as any },
        {
          onSuccess: () => {
            showSuccessToast("Transaction record updated successfully")
            onSuccess?.()
          },
          onError: (err: Error) => {
            handleError.call(showErrorToast, err as ApiError)
          },
        },
      )
    } else {
      createRiskNote.mutate(payload as any, {
        onSuccess: () => {
          showSuccessToast("New transaction note issued successfully")
          onSuccess?.()
        },
        onError: (err: Error) => {
          handleError.call(showErrorToast, err as ApiError)
        },
      })
    }
  }

  if (isLoadingPolicy || (riskNoteId && isLoadingRiskNote)) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Loading transaction details...
      </div>
    )
  }

  const productAny = policy?.product as any
  const productDetails = (productAny?.product_details as any[]) || []
  const isPending = createRiskNote.isPending || updateRiskNote.isPending

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit as any)}
          className="space-y-6"
        >
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
            <FormField
              control={form.control as any}
              name="transaction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="New Business">New Business</SelectItem>
                      <SelectItem value="Renewal">Renewal</SelectItem>
                      <SelectItem value="Endorsement">Endorsement</SelectItem>
                      <SelectItem value="Cancellation">Cancellation</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as any}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Draft">Draft (Preliminary)</SelectItem>
                      <SelectItem value="Active">Active (Finalized)</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control as any}
              name="coverage_start"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage Start</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control as any}
              name="coverage_end"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage End</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {productDetails.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                Risk Details ({policy?.product?.class_of_insurance})
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {productDetails
                  .filter(
                    (f: any) =>
                      f.field_type === "input" || f.field_type === "optional",
                  )
                  .map((field: any) => (
                    <FormField
                      key={field.key}
                      control={form.control as any}
                      name={`details.${field.key}`}
                      render={({ field: inputField }) => (
                        <FormItem>
                          <FormLabel>{field.label}</FormLabel>
                          <FormControl>
                            <Input
                              type={field.type === "number" ? "number" : "text"}
                              {...inputField}
                              value={inputField.value || ""}
                              onChange={(e) =>
                                inputField.onChange(
                                  field.type === "number"
                                    ? e.target.valueAsNumber
                                    : e.target.value,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Financial Schedule (Fixed-Point)
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRatingCalcOpen(true)}
                className="h-6 text-[11px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/5"
              >
                <Calculator className="size-3" />
                Run Rating Engine
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="net_premium"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Net Premium (KES)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="commission_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission (KES)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              size="sm"
              loading={isPending}
              className="font-bold bg-primary text-primary-foreground"
            >
              {form.watch("status") === "Active"
                ? "Issue & Finalize Note"
                : "Save Draft Changes"}
            </LoadingButton>
          </div>
        </form>
      </Form>

      <AdvisoryRatingCalculator
        isOpen={ratingCalcOpen}
        onOpenChange={setRatingCalcOpen}
        initialClass={policy?.product?.class_of_insurance || "Motor Private"}
        initialSumInsured={
          Number((form.getValues("details") as any)?.sum_insured) ||
          Number((form.getValues("details") as any)?.vehicle?.sum_insured) ||
          Number(
            ((policy as any)?.active_note?.cover_snapshot as any)?.vehicle
              ?.sum_insured,
          ) ||
          2000000
        }
        onApplyCalculation={handleApplyRating}
      />
    </>
  )
}
