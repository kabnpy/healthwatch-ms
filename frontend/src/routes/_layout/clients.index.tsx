import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Users } from "lucide-react"
import { ClientsService } from "@/client"
import { AddClient } from "@/components/Clients/AddClient"
import { ClientsTableSkeleton } from "@/components/Clients/ClientsTableSkeleton"
import { columns } from "@/components/Clients/columns"
import { DataTable } from "@/components/Common/DataTable"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
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

function ClientsTable() {
  const {
    data: clients,
    isLoading,
    isError,
    refetch,
  } = useQuery(getClientsQueryOptions())

  if (isLoading) {
    return <ClientsTableSkeleton />
  }

  if (isError || !clients) {
    return (
      <QueryErrorBanner
        message="Failed to load clients. Please try again."
        onRetry={() => void refetch()}
      />
    )
  }

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

function Clients() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Client Portfolio Management
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">
            Clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage client profiles, policies, and servicing records
          </p>
        </div>
        <AddClient />
      </div>
      <ClientsTable />
    </div>
  )
}
