import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { InsurersService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddInsurer from "@/components/Insurers/AddInsurer"
import { columns } from "@/components/Insurers/columns"
import PendingItems from "@/components/Pending/PendingItems"

function getInsurersQueryOptions() {
  return {
    queryFn: async () =>
      (await InsurersService.readInsurers({ query: { skip: 0, limit: 100 } }))
        .data,
    queryKey: ["insurers"],
  }
}

export const Route = createFileRoute("/_layout/catalog/insurers/")({
  component: Insurers,
  head: () => ({
    meta: [
      {
        title: "Insurers - Catalog",
      },
    ],
  }),
})

function InsurersTableContent() {
  const { data: insurers } = useSuspenseQuery(getInsurersQueryOptions())

  if (insurers.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No insurers found</h3>
        <p className="text-muted-foreground">
          Add a new insurance carrier to get started
        </p>
      </div>
    )
  }

  return <DataTable columns={columns} data={insurers.data} />
}

function InsurersTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <InsurersTableContent />
    </Suspense>
  )
}

function Insurers() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Insurance Carriers
          </h2>
          <p className="text-sm text-muted-foreground">
            List of all registered insurers in the system.
          </p>
        </div>
        <AddInsurer />
      </div>
      <InsurersTable />
    </div>
  )
}
