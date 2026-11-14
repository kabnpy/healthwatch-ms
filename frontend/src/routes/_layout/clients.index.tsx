import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ExternalLink, Mail, Phone, Search, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { ClientsService } from "@/client"
import { AddClient } from "@/components/Clients/AddClient"
import { ClientsTableSkeleton } from "@/components/Clients/ClientsTableSkeleton"
import { type ClientRow, columns } from "@/components/Clients/columns"
import { DataTable } from "@/components/Common/DataTable"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { usePolicies } from "@/hooks/usePolicies"
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

type ClientTypeFilter = "All" | "Individual" | "Corporate"

const CLIENT_TYPE_OPTIONS: ClientTypeFilter[] = [
  "All",
  "Individual",
  "Corporate",
]

function ClientsTable() {
  const [clientTypeFilter, setClientTypeFilter] =
    useState<ClientTypeFilter>("All")
  const [mobileSearch, setMobileSearch] = useState("")

  const {
    data: clients,
    isLoading,
    isError,
    refetch,
  } = useQuery(getClientsQueryOptions())

  const { data: policies } = usePolicies(undefined, 0, 500)

  const activePolicyCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const policy of policies?.data ?? []) {
      if (policy.status === "Active") {
        counts.set(policy.client_id, (counts.get(policy.client_id) ?? 0) + 1)
      }
    }
    return counts
  }, [policies?.data])

  const enrichedClients: ClientRow[] = useMemo(() => {
    return (clients?.data ?? []).map((client) => ({
      ...client,
      activePoliciesCount: activePolicyCounts.get(client.id) ?? 0,
    }))
  }, [clients?.data, activePolicyCounts])

  const filteredClients = useMemo(() => {
    return enrichedClients.filter((client) => {
      if (
        clientTypeFilter !== "All" &&
        client.client_type !== clientTypeFilter
      ) {
        return false
      }
      return true
    })
  }, [enrichedClients, clientTypeFilter])

  const mobileFilteredClients = useMemo(() => {
    const q = mobileSearch.trim().toLowerCase()
    if (!q) return filteredClients
    return filteredClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.kra_pin.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        c.phone.toLowerCase().includes(q),
    )
  }, [filteredClients, mobileSearch])

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

  const clientTypeToolbar = (
    <div
      role="group"
      aria-label="Client Type"
      className="flex items-center gap-1 rounded-md border bg-muted/40 p-1"
    >
      {CLIENT_TYPE_OPTIONS.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={clientTypeFilter === option ? "default" : "ghost"}
          className="h-7 px-3 text-xs"
          onClick={() => setClientTypeFilter(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  )

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filteredClients}
          searchPlaceholder="Search clients..."
          toolbar={clientTypeToolbar}
        />
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {clientTypeToolbar}
        </div>

        {mobileFilteredClients.length === 0 ? (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mobileFilteredClients.map((client) => (
              <Card key={client.id} className="gap-3 py-4">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pb-0">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/clients/$clientId/policies"
                      params={{ clientId: client.id }}
                      className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 break-words"
                    >
                      <span>{client.name}</span>
                      <ExternalLink className="size-3.5 shrink-0 opacity-60" />
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">
                      {client.kra_pin}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {client.client_type}
                  </Badge>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 px-4">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{client.email || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                      Active Policies:{" "}
                      <span className="tabular-nums font-semibold text-foreground">
                        {client.activePoliciesCount}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/clients/$clientId/policies"
                        params={{ clientId: client.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        View Hub
                      </Link>
                      <Link
                        to="/clients/$clientId/settings"
                        params={{ clientId: client.id }}
                        className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
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
