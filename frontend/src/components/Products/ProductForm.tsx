import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useFormContext } from "react-hook-form"
import { z } from "zod"
import type { ProductCreate, ProductPublic, ProductUpdate } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useInsurers } from "@/hooks/useCatalog"

const formSchema = z.object({
  insurer_id: z.string().uuid("Please select an insurer"),
  name: z.string().min(1, "Product name is required"),
  class_of_insurance: z.string().min(1, "Class of insurance is required"),
  default_commission_rate: z.coerce.number().min(0).max(100),
  product_details: z.record(z.string(), z.any()).default({}),
})

type FormData = z.infer<typeof formSchema>

interface ProductFormProps {
  initialData?: ProductPublic
  onSubmit: (data: ProductCreate | ProductUpdate) => void
  onCancel?: () => void
  isLoading?: boolean
  submitLabel?: string
  fixedInsurerId?: string
  useContext?: boolean
}

export const ProductForm = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel = "Save Product",
  fixedInsurerId,
  useContext = false,
}: ProductFormProps) => {
  const { data: insurersData } = useInsurers()
  const insurers = insurersData?.data || []

  // If useContext is true, we expect to be wrapped in a FormProvider
  const context = useFormContext<FormData>()

  const localForm = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      insurer_id: fixedInsurerId || initialData?.insurer_id || "",
      name: initialData?.name || "",
      class_of_insurance: initialData?.class_of_insurance || "",
      default_commission_rate: initialData?.default_commission_rate ?? 10.0,
      product_details: (initialData?.product_details as any) || {},
    },
  })

  const form = useContext && context ? context : (localForm as any)

  const handleFormSubmit = (data: FormData) => {
    onSubmit(data as any)
  }

  const content = (
    <form
      onSubmit={(form as any).handleSubmit(handleFormSubmit as any)}
      className="space-y-4"
    >
      {!fixedInsurerId && (
        <Controller
          control={(form as any).control}
          name="insurer_id"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Insurer</FieldLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!!initialData}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select insurer" />
                </SelectTrigger>
                <SelectContent>
                  {insurers.map((insurer) => (
                    <SelectItem key={insurer.id} value={insurer.id}>
                      {insurer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}

      <Controller
        control={(form as any).control}
        name="name"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Product Name</FieldLabel>
            <Input placeholder="e.g. Motor Comprehensive - Gold" {...field} />
            <FieldDescription>
              The public name of the insurance product.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={(form as any).control}
          name="class_of_insurance"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Class of Insurance</FieldLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Motor Private">Motor Private</SelectItem>
                  <SelectItem value="Motor Commercial">
                    Motor Commercial
                  </SelectItem>
                  <SelectItem value="Fire">Fire</SelectItem>
                  <SelectItem value="Domestic Package">
                    Domestic Package
                  </SelectItem>
                  <SelectItem value="Personal Accident">
                    Personal Accident
                  </SelectItem>
                  <SelectItem value="Marine">Marine</SelectItem>
                  <SelectItem value="Medical">Medical</SelectItem>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={(form as any).control}
          name="default_commission_rate"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Default Commission %</FieldLabel>
              <Input type="number" step="0.01" {...field} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <div className="flex justify-end gap-4 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <LoadingButton type="submit" loading={isLoading}>
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  )

  return content
}
