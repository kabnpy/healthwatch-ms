import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useMatch,
} from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
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
  const isPolicyDetail = Boolean(
    useMatch({
      from: "/_layout/clients/$clientId/policies/$policyId",
      shouldThrow: false,
    }),
  )

  if (isPolicyDetail) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center border-b pb-3">
          <Link
            to="/clients/$clientId/policies"
            params={{ clientId }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">Back to {client.name} Policies</span>
          </Link>
        </div>
        <Outlet />
      </div>
    )
  }

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
        <TabsList className="w-full max-w-full overflow-x-auto justify-start">
          <TabsTrigger
            value="overview"
            render={
              <Link to="/clients/$clientId/overview" params={{ clientId }}>
                Overview
              </Link>
            }
          />
          <TabsTrigger
            value="policies"
            render={
              <Link to="/clients/$clientId/policies" params={{ clientId }}>
                Policies
              </Link>
            }
          />
          <TabsTrigger
            value="invoices"
            render={
              <Link to="/clients/$clientId/invoices" params={{ clientId }}>
                Invoices
              </Link>
            }
          />
          <TabsTrigger
            value="documents"
            render={
              <Link to="/clients/$clientId/documents" params={{ clientId }}>
                Documents
              </Link>
            }
          />
          <TabsTrigger
            value="settings"
            render={
              <Link to="/clients/$clientId/settings" params={{ clientId }}>
                Settings
              </Link>
            }
          />
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
