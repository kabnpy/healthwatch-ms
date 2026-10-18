import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CreditCard, Hash, Mail, Phone, User } from "lucide-react"
import { ClientsService } from "@/client"
import { SummaryCard } from "@/components/Common/SummaryCard"
import { useFinancialSummary } from "@/hooks/useFinancials"

function getClientQueryOptions(clientId: string) {
  return {
    queryFn: async () =>
      (await ClientsService.readClient({ path: { id: clientId } })).data,
    queryKey: ["clients", clientId],
  }
}

export const Route = createFileRoute("/_layout/clients/$clientId/overview")({
  component: ClientOverview,
})

function ClientOverview() {
  const { clientId } = Route.useParams()
  const { data: client } = useSuspenseQuery(getClientQueryOptions(clientId))
  const { summary } = useFinancialSummary(clientId)

  const postalAddress = [
    client.postal_number ? `P.O. Box ${client.postal_number}` : null,
    client.postal_code ? `- ${client.postal_code}` : null,
    client.town ? `, ${client.town}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="KRA PIN"
          value={client.kra_pin}
          icon={Hash}
          valueClassName="font-mono text-xl"
        />
        <SummaryCard
          title="Outstanding Balance"
          value={`KES ${summary.totalDue.toLocaleString()}`}
          icon={CreditCard}
          valueClassName={
            summary.totalDue > 0
              ? "text-destructive font-bold"
              : "text-green-600"
          }
        />
        <SummaryCard
          title="Phone Number"
          value={client.phone}
          icon={Phone}
          valueClassName="text-xl"
        />
        <SummaryCard
          title="Client Type"
          value={client.client_type}
          icon={User}
          valueClassName="text-xl"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Email Address"
          value={client.email || "N/A"}
          icon={Mail}
          valueClassName="text-sm truncate font-normal"
        />
        <SummaryCard
          title="Physical Address"
          value={client.physical_address || "No address provided"}
          valueClassName="text-sm font-normal whitespace-pre-line"
        />
        <SummaryCard
          title="Postal Address"
          value={postalAddress || "No address provided"}
          valueClassName="text-sm font-normal whitespace-pre-line"
        />
      </div>

      {client.contacts && (client.contacts as any[]).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Key Contacts
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(client.contacts as any[]).map((contact, index) => (
              <SummaryCard
                key={index}
                title={contact.role || "Contact"}
                value={contact.name}
                description={`${contact.phone || ""} ${contact.email ? `• ${contact.email}` : ""}`}
                valueClassName="text-lg"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
