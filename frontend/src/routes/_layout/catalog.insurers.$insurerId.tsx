import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Mail, Phone, Shield } from "lucide-react"
import { Suspense } from "react"

import { InsurersService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import PendingItems from "@/components/Pending/PendingItems"
import { AddProduct } from "@/components/Products/AddProduct"
import { columns as productColumns } from "@/components/Products/columns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useProducts } from "@/hooks/useCatalog"
import { queryClient } from "@/queryClient"

// --- Query Options ---

function getInsurerQueryOptions(insurerId: string) {
  return {
    queryFn: async () =>
      (await InsurersService.readInsurer({ path: { id: insurerId } })).data,
    queryKey: ["insurers", insurerId],
  }
}

// --- Route Definition ---

export const Route = createFileRoute("/_layout/catalog/insurers/$insurerId")({
  component: InsurerDetailLayout,
  loader: ({ params }) =>
    queryClient.ensureQueryData(getInsurerQueryOptions(params.insurerId)),
  head: ({ params }) => ({
    meta: [
      {
        title: `Insurer Details - ${params.insurerId}`,
      },
    ],
  }),
})

// --- Components ---

function InsurerProducts({ insurerId }: { insurerId: string }) {
  const { data: productsData, isLoading } = useProducts(insurerId)

  if (isLoading) return <PendingItems />

  const products = productsData?.data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Insurance Products</h3>
        <AddProduct fixedInsurerId={insurerId} />
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="font-medium">No products for this insurer</p>
            <p className="text-sm text-muted-foreground">
              Add products to start issuing policies for this carrier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable columns={productColumns} data={products} />
      )}
    </div>
  )
}

function InsurerDetailContent({ insurerId }: { insurerId: string }) {
  const { data: insurer } = useSuspenseQuery(getInsurerQueryOptions(insurerId))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button
          variant="ghost"
          asChild
          className="mb-4 -ml-2 h-8 px-2 text-muted-foreground"
        >
          <Link to="/catalog/insurers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Insurers
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{insurer.name}</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{insurer.email || "No email provided"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{insurer.phone || "No phone provided"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Management view for insurance carrier details and associated
              products.
            </p>
          </CardContent>
        </Card>
      </div>

      <InsurerProducts insurerId={insurerId} />
    </div>
  )
}

function InsurerDetailLayout() {
  const { insurerId } = Route.useParams()

  return (
    <Suspense fallback={<PendingItems />}>
      <InsurerDetailContent insurerId={insurerId} />
    </Suspense>
  )
}
