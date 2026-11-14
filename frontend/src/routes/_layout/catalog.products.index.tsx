import { createFileRoute, Link } from "@tanstack/react-router"
import { Search } from "lucide-react"

import { DataTable } from "@/components/Common/DataTable"
import PendingItems from "@/components/Pending/PendingItems"
import { columns, type ProductRow } from "@/components/Products/columns"
import { ProductActionsMenu } from "@/components/Products/ProductActionsMenu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useInsurers, useProducts } from "@/hooks/useCatalog"

export const Route = createFileRoute("/_layout/catalog/products/")({
  component: Products,
  head: () => ({
    meta: [
      {
        title: "Products - Catalog",
      },
    ],
  }),
})

function ProductsTableContent() {
  const { data: products, isPending: isProductsPending } = useProducts()
  const { data: insurers, isPending: isInsurersPending } = useInsurers()

  if (isProductsPending || isInsurersPending || !products || !insurers) {
    return <PendingItems />
  }

  if (products.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No products found</h3>
        <p className="text-muted-foreground">
          Define a new insurance product to get started
        </p>
      </div>
    )
  }

  const insurerMap = new Map(insurers.data.map((i) => [i.id, i.name]))
  const rows: ProductRow[] = products.data.map((product) => ({
    ...product,
    insurerName: insurerMap.get(product.insurer_id) ?? "—",
  }))

  return (
    <>
      <div className="hidden md:block">
        <DataTable columns={columns} data={rows} />
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((product) => (
          <Card key={product.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">
                  <Link
                    to="/catalog/products/$productId"
                    params={{ productId: product.id }}
                    className="hover:underline"
                  >
                    {product.name}
                  </Link>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {product.insurerName}
                </p>
              </div>
              <ProductActionsMenu product={product} />
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{product.class_of_insurance}</span>
              <span className="tabular-nums font-medium text-foreground">
                {product.default_commission_rate}% comm.
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function Products() {
  return <ProductsTableContent />
}
