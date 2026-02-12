import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react"
import { Suspense } from "react"

import { ClientsService } from "@/client"
import EditClient from "@/components/Clients/EditClient"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"
import AddPolicy from "@/components/Policies/AddPolicy"
import { columns } from "@/components/Policies/columns"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function getClientQueryOptions(clientId: string) {
  return {
    queryFn: () => ClientsService.readClient({ id: clientId }),
    queryKey: ["clients", clientId],
  }
}

export const Route = createFileRoute("/_layout/clients/$clientId")({
  component: ClientDetail,
  head: () => ({
    meta: [
      {
        title: `Client Detail - HealthWatch`,
      },
    ],
  }),
})

function ClientDetailContent() {
  const { clientId } = Route.useParams()
  const { data: client } = useSuspenseQuery(getClientQueryOptions(clientId))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">Client ID: {client.id}</p>
          </div>
        </div>
        <EditClient client={client} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Personal details and contact info</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{client.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client.phone || "No phone number"}</span>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
              <div className="grid gap-0.5">
                <span className="font-medium">Address</span>
                <span className="text-sm text-muted-foreground">
                  {client.postal_address || "No address"}
                  <br />
                  {client.postal_code} {client.town}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Policies</CardTitle>
              <CardDescription>
                Insurance policies associated with this client
              </CardDescription>
            </div>
            <AddPolicy clientId={client.id} />
          </CardHeader>
          <CardContent>
            {client.policies && client.policies.length > 0 ? (
              <DataTable columns={columns} data={client.policies} />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-muted-foreground mb-4">
                  No policies found for this client.
                </p>
                <AddPolicy clientId={client.id} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ClientDetail() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <ClientDetailContent />
    </Suspense>
  )
}
