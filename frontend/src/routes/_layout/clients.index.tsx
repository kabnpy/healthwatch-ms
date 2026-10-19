import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Users } from "lucide-react"
import { Suspense } from "react"
import { ClientsService } from "@/client"
import { AddClient } from "@/components/Clients/AddClient"
import { ClientsTableSkeleton } from "@/components/Clients/ClientsTableSkeleton"
import { columns } from "@/components/Clients/columns"
import { DataTable } from "@/components/Common/DataTable"
import { queryClient } from "@/queryClient"

function getClientsQueryOptions() {
  return {
    queryFn: async () =>
      (await ClientsService.readClients({ query: { skip: 0, limit: 100 } }))
        .data,
    queryKey: ["clients"],
    staleTime: 1000 * 60 * 2, // 2 minutes fresh cache
  }
}

export const Route = createFileRoute("/_layout/clients/")({
  component: Clients,
  loader: () => queryClient.ensureQueryData(getClientsQueryOptions()),
  head: () => ({
    meta: [
      {
        title: "Clients - HealthWatch MS",
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
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No clients found</h3>
        <p className="text-muted-foreground mb-4">
          Add a new client to get started
        </p>
        <AddClient />
      </div>
    )
  }

  return <DataTable columns={columns} data={clients.data} />
}

function ClientsTable() {
  return (
    <Suspense fallback={<ClientsTableSkeleton />}>
      <ClientsTableContent />
    </Suspense>
  )
}

function Clients() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            Client Portfolio Management
          </p>
        </div>
        <AddClient />
      </div>
      <ClientsTable />
    </div>
  )
}
