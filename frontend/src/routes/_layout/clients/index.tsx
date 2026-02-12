import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search, UserPlus } from "lucide-react"
import { Suspense } from "react"

import { ClientsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { columns } from "@/components/Clients/columns"
import PendingUsers from "@/components/Pending/PendingUsers"
import { Button } from "@/components/ui/button"

function getClientsQueryOptions() {
  return {
    queryFn: () => ClientsService.readClients({ skip: 0, limit: 100 }),
    queryKey: ["clients"],
  }
}

export const Route = createFileRoute("/_layout/clients/")({
  component: Clients,
  head: () => ({
    meta: [
      {
        title: "Clients - HealthWatch",
      },
    ],
  }),
})

function ClientsTableContent() {
  const { data: clients } = useSuspenseQuery(getClientsQueryOptions())

  if (clients.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No clients found</h3>
        <p className="text-muted-foreground">Add a new client to get started</p>
      </div>
    )
  }

  return <DataTable columns={columns} data={clients.data} />
}

function ClientsTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <ClientsTableContent />
    </Suspense>
  )
}

function Clients() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your client database</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </div>
      <ClientsTable />
    </div>
  )
}
