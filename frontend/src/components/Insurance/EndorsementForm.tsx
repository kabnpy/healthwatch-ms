import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import type { ApiError } from "@/client"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { useCreateEndorsement, usePolicy } from "@/hooks/usePolicies"
import { handleError } from "@/utils"
import { buildEndorsementPayload } from "@/utils/endorsementPayload"

interface ProductDetailField {
  key: string
  label: string
  type?: string
  field_type?: string
}

interface PolicyWithSnapshot {
  active_note?: {
    cover_snapshot?: Record<string, unknown> | null
  } | null
  product?: {
    class_of_insurance?: string | null
    product_details?: ProductDetailField[] | null
  } | null
}

const endorsementFormSchema = z.object({
  effective_date: z.string(),
  change_description: z
    .string()
    .trim()
    .min(1, "Change description is required"),
  updated_risk_details: z.record(z.string(), z.unknown()),
})

type EndorsementSchemaValues = z.infer<typeof endorsementFormSchema>

interface EndorsementFormProps {
  policyId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export const EndorsementForm = ({
  policyId,
  onSuccess,
  onCancel,
}: EndorsementFormProps) => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { data: policy, isLoading: isLoadingPolicy } = usePolicy(policyId)
  const createEndorsement = useCreateEndorsement()

  const form = useForm<EndorsementSchemaValues>({
    resolver: zodResolver(endorsementFormSchema),
    defaultValues: {
      effective_date: new Date().toISOString().split("T")[0],
      change_description: "",
      updated_risk_details: {},
    },
  })

  useEffect(() => {
    if (policy) {
      const policyData = policy as unknown as PolicyWithSnapshot
      form.reset({
        effective_date: new Date().toISOString().split("T")[0],
        change_description: "",
        updated_risk_details: policyData.active_note?.cover_snapshot ?? {},
      })
    }
  }, [policy, form])

  const onSubmit: SubmitHandler<EndorsementSchemaValues> = (values) => {
    const payload = buildEndorsementPayload(values)
    createEndorsement.mutate(
      {
        policyId,
        data: payload,
      },
      {
        onSuccess: () => {
          showSuccessToast("Endorsement issued successfully")
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
        Loading endorsement details...
      </div>
    )
  }

  const policyData = policy as unknown as PolicyWithSnapshot | undefined
  const productDetails = policyData?.product?.product_details ?? []
  const editableDetails = productDetails.filter(
    (f) => f.field_type === "input" || f.field_type === "optional",
  )

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <Controller
          control={form.control}
          name="effective_date"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="endorsement-effective-date">
                Effective Date
              </FieldLabel>
              <Input id="endorsement-effective-date" type="date" {...field} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="change_description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="endorsement-change-description">
                Change Description
              </FieldLabel>
              <Textarea
                id="endorsement-change-description"
                placeholder="Describe the mid-term policy changes..."
                rows={3}
                {...field}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      {editableDetails.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            Updated Risk Details ({policyData?.product?.class_of_insurance})
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {editableDetails.map((detailField) => {
              const inputId = `endorsement-detail-${detailField.key}`
              return (
                <Controller
                  key={detailField.key}
                  control={form.control}
                  name={`updated_risk_details.${detailField.key}`}
                  render={({ field: inputField, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={inputId}>
                        {detailField.label}
                      </FieldLabel>
                      <Input
                        id={inputId}
                        type={detailField.type === "number" ? "number" : "text"}
                        name={inputField.name}
                        ref={inputField.ref}
                        onBlur={inputField.onBlur}
                        value={
                          inputField.value === undefined ||
                          inputField.value === null
                            ? ""
                            : String(inputField.value)
                        }
                        onChange={(e) =>
                          inputField.onChange(
                            detailField.type === "number"
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
              )
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton
          type="submit"
          size="sm"
          loading={createEndorsement.isPending}
          className="font-bold bg-primary text-primary-foreground"
        >
          Submit Endorsement
        </LoadingButton>
      </div>
    </form>
  )
}
