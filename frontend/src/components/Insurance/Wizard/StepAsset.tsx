import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProducts } from "@/hooks/useInsurance"

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
    <Form {...(form as any)}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-8">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight">Policy Identity</h3>
          <p className="text-sm text-muted-foreground">
            Identify the insurance product and record the official policy
            number.
          </p>
        </div>

        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Insurance Product</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select a product..." />
                    </SelectTrigger>
                  </FormControl>
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
                <FormDescription>
                  The baseline coverage rules will be derived from this
                  selection.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="policy_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Policy Number</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. POL/2026/001"
                    className="h-12 text-base"
                  />
                </FormControl>
                <FormDescription>
                  Enter the unique reference number provided by the insurance
                  company.
                </FormDescription>
                <FormMessage />
              </FormItem>
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
    </Form>
  )
}
