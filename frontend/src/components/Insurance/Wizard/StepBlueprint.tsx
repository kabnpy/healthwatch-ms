import { ArrowLeft } from "lucide-react"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
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
import { useProducts } from "@/hooks/useInsurance"
import type { EnhancedProduct } from "@/types/insurance"
import { extractWizardFields } from "@/utils/documentData"

interface StepBlueprintProps {
  productId: string
  defaultValues: Record<string, any>
  onNext: (data: Record<string, any>) => void
  onBack: () => void
}

export function StepBlueprint({
  productId,
  defaultValues,
  onNext,
  onBack,
}: StepBlueprintProps) {
  const { data: productsData } = useProducts()

  const selectedProduct = useMemo(() => {
    return productsData?.data.find((p) => p.id === productId) as
      | EnhancedProduct
      | undefined
  }, [productId, productsData])

  const wizardFields = useMemo(() => {
    if (!selectedProduct) return []
    const allFields = extractWizardFields(selectedProduct.product_details)

    // Essential details filter
    const isMotor = selectedProduct.class_of_insurance
      .toLowerCase()
      .includes("motor")
    const essentialKeys = isMotor
      ? ["registration_number", "make", "year_of_manufacture"]
      : allFields.map((f) => f.path[f.path.length - 1])

    return allFields.filter((f) =>
      essentialKeys.includes(f.path[f.path.length - 1]),
    )
  }, [selectedProduct])

  const form = useForm({
    defaultValues: defaultValues || {},
  })

  if (!selectedProduct) return null

  return (
    <Form {...(form as any)}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-8">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight">Asset Details</h3>
          <p className="text-sm text-muted-foreground">
            Provide the technical specifications of the vehicle to be insured.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {wizardFields.map((field) => (
            <FormField
              key={field.path.join(".")}
              control={form.control}
              name={field.path.join(".")}
              render={({ field: inputField }) => (
                <FormItem>
                  <FormLabel className="capitalize">
                    {field.label.replace(/_/g, " ")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      placeholder={`Enter ${field.label.replace(/_/g, " ").toLowerCase()}...`}
                      {...inputField}
                      value={inputField.value || ""}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button type="submit" size="lg" className="px-10">
            Next: Financials
          </Button>
        </div>
      </form>
    </Form>
  )
}
