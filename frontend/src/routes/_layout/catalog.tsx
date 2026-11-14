import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"
import AddInsurer from "@/components/Insurers/AddInsurer"
import { AddProduct } from "@/components/Products/AddProduct"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/_layout/catalog")({
  component: CatalogLayout,
})

function CatalogLayout() {
  const location = useLocation()

  // Determine active tab based on path
  const isProducts = location.pathname.includes("/catalog/products")
  const activeTab = isProducts ? "products" : "insurers"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Catalog
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {isProducts ? "Products" : "Insurers"}
          </h1>
          <p className="text-muted-foreground">
            Manage insurers and their products.
          </p>
        </div>
        {isProducts ? <AddProduct /> : <AddInsurer />}
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger
            value="insurers"
            render={<Link to="/catalog/insurers">Insurers</Link>}
          />
          <TabsTrigger
            value="products"
            render={<Link to="/catalog/products">Products</Link>}
          />
        </TabsList>
        <div className="mt-4">
          <Outlet />
        </div>
      </Tabs>
    </div>
  )
}
