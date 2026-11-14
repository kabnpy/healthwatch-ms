import { zodResolver } from "@hookform/resolvers/zod"
import { Calculator } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import type { ApiError, CalculationQuoteResponse } from "@/client"
import { AdvisoryRatingCalculator } from "@/components/Insurance/AdvisoryRatingCalculator"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
import { useCreateEndorsement, usePolicy } from "@/hooks/usePolicies"
import { handleError } from "@/utils"
import { extractCoverSummary, extractSumInsured } from "@/utils/coverSnapshot"

interface RiskNoteFormProps {
  policyId: string
  initialTransactionType?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export const RiskNoteForm = ({
  policyId,
  initialTransactionType = "Endorsement",
  onSuccess,
  onCancel,
}: RiskNoteFormProps) => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: policy, isLoading: isLoadingPolicy } = usePolicy(policyId)
  const createEndorsement = useCreateEndorsement()
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
    if (policy) {
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
  }, [policy, form, initialTransactionType])

  const handleApplyRating = (res: CalculationQuoteResponse) => {
    const netPremium = Number(res.net_premium || 0)
    form.setValue("net_premium", netPremium)
    form.setValue("commission_amount", Number(res.commission_amount || 0))

    const currentDetails = form.getValues("details") || {}
    form.setValue("details", {
      ...currentDetails,
      calculation_detail: res.calculation_detail,
      rule_provenance: res.rule_provenance,
    })
  }

  const onSubmit: SubmitHandler<FormData> = (data) => {
    createEndorsement.mutate(
      {
        policyId,
        data: {
          updated_risk_details: data.details,
          change_description: `${data.transaction_type} transaction`,
          effective_date: data.coverage_start,
        },
      },
      {
        onSuccess: () => {
          showSuccessToast("Endorsement risk note issued successfully")
          onSuccess?.()
        },
        onError: (err: Error) => {
          handleError.call(showErrorToast, err as ApiError)
        },
      },
    )
  }

  if (isLoadingPolicy) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Loading transaction details...
      </div>
    )
  }

  const productAny = policy?.product as any
  const productDetails = (productAny?.product_details as any[]) || []
  const isPending = createEndorsement.isPending

  return (
    <>
      <form
        onSubmit={form.handleSubmit(onSubmit as any)}
        className="space-y-6"
      >
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
            <Controller
              control={form.control as any}
              name="transaction_type"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Transaction Type</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New Business">New Business</SelectItem>
                      <SelectItem value="Renewal">Renewal</SelectItem>
                      <SelectItem value="Endorsement">Endorsement</SelectItem>
                      <SelectItem value="Cancellation">Cancellation</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control as any}
              name="status"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft (Preliminary)</SelectItem>
                      <SelectItem value="Active">Active (Finalized)</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={form.control as any}
              name="coverage_start"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Coverage Start</FieldLabel>
                  <Input type="date" {...field} />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control as any}
              name="coverage_end"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Coverage End</FieldLabel>
                  <Input type="date" {...field} />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
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
                    <Controller
                      key={field.key}
                      control={form.control as any}
                      name={`details.${field.key}`}
                      render={({ field: inputField, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>{field.label}</FieldLabel>
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
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
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
              <Controller
                control={form.control as any}
                name="net_premium"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Net Premium (KES)</FieldLabel>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      className="font-mono text-sm"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                control={form.control as any}
                name="commission_amount"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Commission (KES)</FieldLabel>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      className="font-mono text-sm"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
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

      <AdvisoryRatingCalculator
        isOpen={ratingCalcOpen}
        onOpenChange={setRatingCalcOpen}
        productId={policy?.product?.id}
        initialClass={policy?.product?.class_of_insurance || "Motor Private"}
        initialSumInsured={
          extractSumInsured(form.getValues("details")) ||
          extractCoverSummary((policy as any)?.active_note?.cover_snapshot)
            .sumInsured ||
          2000000
        }
        onApplyCalculation={handleApplyRating}
      />
    </>
  )
}
