import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { InsurersService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { columns } from "@/components/Insurers/columns"
import { InsurerActionsMenu } from "@/components/Insurers/InsurerActionsMenu"
import PendingItems from "@/components/Pending/PendingItems"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
      <EmptyState
        title="No insurers found"
        description="Add a new insurer to get started"
        icon={Search}
      />
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTable columns={columns} data={insurers.data} />
      </div>
      <div className="grid gap-3 md:hidden">
        {insurers.data.map((insurer) => (
          <Card key={insurer.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">
                <Link
                  to="/catalog/insurers/$insurerId"
                  params={{ insurerId: insurer.id }}
                  className="hover:underline"
                >
                  {insurer.name}
                </Link>
              </CardTitle>
              <InsurerActionsMenu insurer={insurer} />
            </CardHeader>
            <CardContent className="grid gap-1 text-sm text-muted-foreground">
              <div className="truncate">
                {insurer.email || (
                  <span className="text-muted-foreground italic text-xs">
                    N/A
                  </span>
                )}
              </div>
              <div>
                {insurer.phone || (
                  <span className="text-muted-foreground italic text-xs">
                    N/A
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function InsurersTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <InsurersTableContent />
    </Suspense>
  )
}

function Insurers() {
  return <InsurersTable />
}
