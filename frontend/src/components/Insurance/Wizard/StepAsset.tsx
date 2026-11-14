import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProducts } from "@/hooks/usePolicies"

interface StepAssetProps {
  defaultValues: { product_id: string; policy_number: string }
  onNext: (data: { product_id: string; policy_number: string }) => void
}

export function StepAsset({ defaultValues, onNext }: StepAssetProps) {
  const { data: productsData } = useProducts()

  const form = useForm({
    defaultValues: {
      product_id: defaultValues?.product_id || "",
      policy_number: defaultValues?.policy_number || "",
    },
  })

  const selectedProductId = form.watch("product_id")
  const policyNumber = form.watch("policy_number")

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-bold tracking-tight">Policy Identity</h3>
        <p className="text-sm text-muted-foreground">
          Identify the insurance product and record the official policy number.
        </p>
      </div>

      <div className="grid gap-6">
        <Controller
          control={form.control}
          name="product_id"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Insurance Product</FieldLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {productsData?.data
                    .filter((p) =>
                      p.class_of_insurance
                        .toLowerCase()
                        .includes("motor private"),
                    )
                    .map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.class_of_insurance})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                The baseline coverage rules will be derived from this selection.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="policy_number"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Policy Number</FieldLabel>
              <Input
                {...field}
                placeholder="e.g. POL/2026/001"
                className="h-12 text-base"
              />
              <FieldDescription>
                Enter the unique reference number provided by the insurance
                company.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={!selectedProductId || !policyNumber}
          size="lg"
          className="px-10"
        >
          Next: Asset Details
        </Button>
      </div>
    </form>
  )
}
