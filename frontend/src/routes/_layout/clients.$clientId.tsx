import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useMatch,
} from "@tanstack/react-router"
import { ArrowLeft, Check, Copy, Hash, Mail, Phone } from "lucide-react"
import { Suspense } from "react"
import { ClientsService } from "@/client"
import { ClientHubSkeleton } from "@/components/Clients/ClientHubSkeleton"
import ErrorComponent from "@/components/Common/ErrorComponent"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
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
  const [copiedPin, copyPin] = useCopyToClipboard()
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
  let activeTab = "policies"
  if (path.includes("/policies")) activeTab = "policies"
  else if (path.includes("/invoices")) activeTab = "invoices"
  else if (path.includes("/activity")) activeTab = "activity"
  else if (path.includes("/documents")) activeTab = "documents"
  else if (path.includes("/settings")) activeTab = "settings"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center border-b pb-3">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Back to Clients</span>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">{client.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="uppercase tracking-widest font-bold">
            {client.client_type}
          </span>
          {client.kra_pin && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-muted/30 font-mono font-medium text-foreground">
              <Hash className="size-3 text-muted-foreground" />
              <span>PIN: {client.kra_pin}</span>
              <button
                type="button"
                onClick={() => copyPin(client.kra_pin || "")}
                className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Copy KRA PIN"
              >
                {copiedPin === client.kra_pin ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          )}
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground font-mono transition-colors"
            >
              <Phone className="size-3.5 text-muted-foreground shrink-0" />
              <span>{client.phone}</span>
            </a>
          )}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Mail className="size-3.5 text-muted-foreground shrink-0" />
              <span>{client.email}</span>
            </a>
          )}
        </div>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList
          variant="line"
          className="w-full max-w-full overflow-x-auto justify-start border-b"
        >
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
            value="activity"
            render={
              <Link to="/clients/$clientId/activity" params={{ clientId }}>
                Activity
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
