import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"
import { Suspense } from "react"
import { ClientsService } from "@/client"
import { ClientHubSkeleton } from "@/components/Clients/ClientHubSkeleton"
import ErrorComponent from "@/components/Common/ErrorComponent"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { queryClient } from "@/queryClient"

// --- Query Options ---

function getClientQueryOptions(clientId: string) {
  return {
    queryFn: async () =>
      (await ClientsService.readClient({ path: { id: clientId } })).data,
    queryKey: ["clients", clientId],
    staleTime: 1000 * 60 * 2,
  }
}

// --- Route Definition ---

export const Route = createFileRoute("/_layout/clients/$clientId")({
  component: ClientHubLayout,
  errorComponent: ErrorComponent,
  loader: ({ params }) =>
    queryClient.ensureQueryData(getClientQueryOptions(params.clientId)),
  head: ({ params }) => ({
    meta: [
      {
        title: `Client Details - ${params.clientId}`,
      },
    ],
  }),
})

// --- Component Content (Suspended) ---

function ClientHubContent({ clientId }: { clientId: string }) {
  const { data: client } = useSuspenseQuery(getClientQueryOptions(clientId))
  const location = useLocation()

  // Determine active tab based on path
  const path = location.pathname
  let activeTab = "overview"
  if (path.includes("/overview")) activeTab = "overview"
  else if (path.includes("/policies")) activeTab = "policies"
  else if (path.includes("/invoices")) activeTab = "invoices"
  else if (path.includes("/documents")) activeTab = "documents"
  else if (path.includes("/settings")) activeTab = "settings"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">
            {client.client_type} &bull; Client Hub
          </p>
        </div>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview" asChild>
            <Link to="/clients/$clientId/overview" params={{ clientId }}>
              Overview
            </Link>
          </TabsTrigger>
          <TabsTrigger value="policies" asChild>
            <Link to="/clients/$clientId/policies" params={{ clientId }}>
              Policies
            </Link>
          </TabsTrigger>
          <TabsTrigger value="invoices" asChild>
            <Link to="/clients/$clientId/invoices" params={{ clientId }}>
              Invoices
            </Link>
          </TabsTrigger>
          <TabsTrigger value="documents" asChild>
            <Link to="/clients/$clientId/documents" params={{ clientId }}>
              Documents
            </Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link to="/clients/$clientId/settings" params={{ clientId }}>
              Settings
            </Link>
          </TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <Outlet />
        </div>
      </Tabs>
    </div>
  )
}

// --- Main Page Component ---

function ClientHubLayout() {
  const { clientId } = Route.useParams()

  return (
    <Suspense fallback={<ClientHubSkeleton />}>
      <ClientHubContent clientId={clientId} />
    </Suspense>
  )
}
