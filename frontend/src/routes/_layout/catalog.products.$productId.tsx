import { zodResolver } from "@hookform/resolvers/zod"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Save, Shield } from "lucide-react"
import { Suspense } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { z } from "zod"

import { ProductsService } from "@/client"
import PendingItems from "@/components/Pending/PendingItems"
import { PricingRulesInspector } from "@/components/Products/PricingRulesInspector"
import { ProductForm } from "@/components/Products/ProductForm"
import { SchemaBuilder } from "@/components/Products/SchemaBuilder"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import { queryClient } from "@/queryClient"
import { handleError } from "@/utils"

// --- Schema ---

const productSchema = z.object({
  insurer_id: z.string().uuid(),
  name: z.string().min(1, "Product name is required"),
  class_of_insurance: z.string().min(1, "Class of insurance is required"),
  default_commission_rate: z.coerce.number().min(0).max(100),
  product_details: z.record(z.string(), z.any()).default({}),
})

type ProductFormData = z.infer<typeof productSchema>

// --- Query Options ---

function getProductQueryOptions(productId: string) {
  return {
    queryFn: async () =>
      (await ProductsService.readProduct({ path: { id: productId } })).data,
    queryKey: ["products", productId],
  }
}

// --- Route Definition ---

export const Route = createFileRoute("/_layout/catalog/products/$productId")({
  component: ProductDetailLayout,
  loader: ({ params }) =>
    queryClient.ensureQueryData(getProductQueryOptions(params.productId)),
  head: ({ params }) => ({
    meta: [
      {
        title: `Edit Product - ${params.productId}`,
      },
    ],
  }),
})

// --- Components ---

function ProductDetailContent({ productId }: { productId: string }) {
  const { data: product } = useSuspenseQuery(getProductQueryOptions(productId))
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const qClient = useQueryClient()

  const methods = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      insurer_id: product.insurer_id,
      name: product.name,
      class_of_insurance: product.class_of_insurance,
      default_commission_rate: product.default_commission_rate,
      product_details: (product.product_details as any) || {},
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) =>
      (
        await ProductsService.updateProduct({
          path: { id: productId },
          body: data as any,
        })
      ).data,
    onSuccess: () => {
      showSuccessToast("Product updated successfully")
      qClient.invalidateQueries({ queryKey: ["products"] })
      qClient.invalidateQueries({ queryKey: ["products", productId] })
    },
    onError: (err: any) => handleError.bind(showErrorToast)(err),
  })

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          asChild
          className="mb-4 -ml-2 h-8 w-fit px-2 text-muted-foreground"
        >
          <Link to="/catalog/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {product.name}
              </h1>
              <p className="text-muted-foreground text-sm">
                {product.class_of_insurance} &bull;{" "}
                {product.insurer?.name || "No Insurer"}
              </p>
            </div>
          </div>
          <LoadingButton
            onClick={methods.handleSubmit(onSubmit as any)}
            loading={mutation.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </LoadingButton>
        </div>
      </div>

      <FormProvider {...methods}>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General Settings</TabsTrigger>
            <TabsTrigger value="schema">Form Schema</TabsTrigger>
            <TabsTrigger value="pricing">Pricing Rules</TabsTrigger>
          </TabsList>
          <div className="mt-6">
            <TabsContent value="general">
              <div className="max-w-2xl bg-white p-6 rounded-lg border">
                <ProductForm
                  onSubmit={onSubmit as any}
                  initialData={product}
                  isLoading={mutation.isPending}
                  onCancel={() => methods.reset()}
                  useContext={true}
                />
              </div>
            </TabsContent>
            <TabsContent value="schema">
              <SchemaBuilder />
            </TabsContent>
            <TabsContent value="pricing">
              <PricingRulesInspector product={product} />
            </TabsContent>
          </div>
        </Tabs>
      </FormProvider>
    </div>
  )
}

function ProductDetailLayout() {
  const { productId } = Route.useParams()

  return (
    <Suspense fallback={<PendingItems />}>
      <ProductDetailContent productId={productId} />
    </Suspense>
  )
}
