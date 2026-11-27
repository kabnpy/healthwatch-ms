import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useMatches,
} from "@tanstack/react-router"
import { PageHeader } from "@/components/Common/PageHeader"
import AddInsurer from "@/components/Insurers/AddInsurer"
import { AddProduct } from "@/components/Products/AddProduct"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/_layout/catalog")({
  component: CatalogLayout,
})

function CatalogLayout() {
  const location = useLocation()
  const matches = useMatches()

  // Suppress parent Catalog chrome on detail routes ($insurerId / $productId)
  const isDetailRoute = matches.some(
    (m) =>
      m.routeId === "/_layout/catalog/insurers/$insurerId" ||
      m.routeId === "/_layout/catalog/products/$productId",
  )
  if (isDetailRoute) {
    return <Outlet />
  }

  // Determine active tab based on path
  const isProducts = location.pathname.includes("/catalog/products")
  const activeTab = isProducts ? "products" : "insurers"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Catalog"
        title={isProducts ? "Products" : "Insurers"}
        subtitle="Manage insurers and their products."
        actions={isProducts ? <AddProduct /> : <AddInsurer />}
      />

      <Tabs value={activeTab} className="w-full">
        <TabsList
          variant="line"
          className="w-full max-w-full overflow-x-auto justify-start border-b"
        >
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
