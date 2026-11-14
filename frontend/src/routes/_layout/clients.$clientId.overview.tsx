import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  Copy,
  CreditCard,
  Hash,
  Mail,
  MapPin,
  Phone,
  Receipt,
  ShieldCheck,
  User,
  Users,
} from "lucide-react"
import { ClientsService } from "@/client"
import { ActivityTimeline } from "@/components/Activities/ActivityTimeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { useFinancialSummary } from "@/hooks/useFinancials"
import { usePolicies } from "@/hooks/usePolicies"
import { cn } from "@/lib/utils"
import { queryClient } from "@/queryClient"
import { formatCurrency } from "@/utils"
import { getPolicyDisplayName } from "@/utils/insurance"

function getClientQueryOptions(clientId: string) {
  return {
    queryFn: async () =>
      (await ClientsService.readClient({ path: { id: clientId } })).data,
    queryKey: ["clients", clientId],
    staleTime: 1000 * 60 * 2,
  }
}

export const Route = createFileRoute("/_layout/clients/$clientId/overview")({
  component: ClientOverview,
  loader: ({ params }) =>
    queryClient.ensureQueryData(getClientQueryOptions(params.clientId)),
})

function ClientOverview() {
  const { clientId } = Route.useParams()
  const { data: client } = useSuspenseQuery(getClientQueryOptions(clientId))
  const { summary } = useFinancialSummary(clientId)
  const balanceState =
    summary.totalDue > 0
      ? {
          iconClass: "text-rose-600",
          amountClass: "text-rose-600 dark:text-rose-400",
          label: "Open balance due",
        }
      : summary.totalInvoiced === 0
        ? {
            iconClass: "text-muted-foreground",
            amountClass: "text-foreground",
            label: "No issued invoices",
          }
        : {
            iconClass: "text-emerald-600",
            amountClass: "text-emerald-600 dark:text-emerald-400",
            label: "Account settled",
          }
  const { data: policiesData, isLoading: isPoliciesLoading } = usePolicies(
    clientId,
    0,
    50,
  )

  const [copiedPin, copyPin] = useCopyToClipboard()

  const policies = policiesData?.data || []
  const activePolicies = policies.filter(
    (p) => p.status?.toLowerCase() === "active",
  )

  const postalAddress = [
    client.postal_number ? `P.O. Box ${client.postal_number}` : null,
    client.postal_code ? `- ${client.postal_code}` : null,
    client.town ? `, ${client.town}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  return (
    <div className="flex flex-col gap-6 pt-4 pb-12">
      {/* 1. Compact Inline Metadata Strip */}
      <div className="flex flex-col gap-3 border-b pb-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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

          <div className="flex items-center gap-1.5">
            <Phone className="size-3.5 text-muted-foreground shrink-0" />
            {client.phone ? (
              <a
                href={`tel:${client.phone}`}
                className="hover:text-foreground font-mono transition-colors"
              >
                {client.phone}
              </a>
            ) : (
              <span>No phone recorded</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="size-3.5 text-muted-foreground shrink-0" />
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="hover:text-foreground truncate transition-colors"
                title={client.email}
              >
                {client.email}
              </a>
            ) : (
              <span>No email recorded</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="size-3.5 text-muted-foreground shrink-0" />
            <span
              className="truncate"
              title={
                client.physical_address ||
                postalAddress ||
                "No address recorded"
              }
            >
              {client.physical_address ||
                postalAddress ||
                "No address recorded"}
            </span>
          </div>
        </div>

        {/* Key Contacts Strip (if applicable) */}
        {client.contacts && (client.contacts as any[]).length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Users className="size-3" />
              Key Contacts:
            </span>
            {(client.contacts as any[]).map((contact, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 border text-xs"
              >
                <User className="size-3 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  {contact.name}
                </span>
                <span className="text-muted-foreground">
                  ({contact.role || "Contact"})
                </span>
                {contact.phone && (
                  <span className="font-mono text-muted-foreground">
                    &bull; {contact.phone}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Unified Hairline-Divided Summary Strip (Strict Invariant: Tabular Numerals) */}
      <div
        data-testid="overview-summary-strip"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x rounded-lg border bg-card"
      >
        {/* Metric 1: Policies In Force */}
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Policies In Force
            </span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums tracking-tight">
            {activePolicies.length}
          </div>
          <p className="text-xs text-muted-foreground">
            {policies.length} total historical contracts
          </p>
        </div>

        {/* Metric 2: Outstanding Balance */}
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Outstanding Balance
            </span>
            <CreditCard className={cn("size-4", balanceState.iconClass)} />
          </div>
          <div
            className={cn(
              "text-2xl font-bold font-mono tabular-nums tracking-tight",
              balanceState.amountClass,
            )}
          >
            {formatCurrency(summary.totalDue)}
          </div>
          <p className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{balanceState.label}</span>
            {summary.totalDue > 0 && (
              <Link
                to="/clients/$clientId/invoices"
                params={{ clientId }}
                className="font-bold underline text-rose-600 dark:text-rose-400"
              >
                Collect &rarr;
              </Link>
            )}
          </p>
        </div>

        {/* Metric 3: Invoiced Premium */}
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Invoiced Premium
            </span>
            <Receipt className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums tracking-tight">
            {formatCurrency(summary.totalInvoiced)}
          </div>
          <p className="text-xs text-muted-foreground">
            All issued debit notes
          </p>
        </div>

        {/* Metric 4: Cleared Collections */}
        <div className="p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cleared Collections
            </span>
            <Check className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.totalPaid)}
          </div>
          <p className="text-xs text-muted-foreground">
            Remitted by client
          </p>
        </div>
      </div>

      {/* 3. Operational Two-Column Workspace */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Left Column: Active Policies Portfolio */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Client Policies Portfolio ({policies.length})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              render={
                <Link to="/clients/$clientId/policies" params={{ clientId }}>
                  Manage All
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              }
            />
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {isPoliciesLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                  Loading policy contracts...
                </div>
              ) : policies.length === 0 ? (
                <div className="p-8 text-center">
                  <ShieldCheck className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold">
                    No policies issued yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create the first policy contract for this client portfolio.
                  </p>
                </div>
              ) : (
                policies.slice(0, 5).map((pol) => {
                  const displayName = getPolicyDisplayName(pol)
                  const activeNote = pol.active_note
                  const isExpiringSoon =
                    activeNote?.coverage_end &&
                    new Date(activeNote.coverage_end).getTime() - Date.now() <
                      30 * 24 * 3600 * 1000

                  return (
                    <div
                      key={pol.id}
                      className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to="/clients/$clientId/policies/$policyId"
                            params={{ clientId, policyId: pol.id }}
                            className="font-mono text-xs font-bold hover:underline text-primary"
                          >
                            {pol.policy_number}
                          </Link>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0",
                              pol.status?.toLowerCase() === "active"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
                            )}
                          >
                            {pol.status}
                          </Badge>
                          {isExpiringSoon && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                              <Clock className="size-2.5" />
                              Expiring soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate mt-0.5">
                          {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {pol.product?.name || "General Cover"}
                          {activeNote?.coverage_end &&
                            ` • Valid thru ${activeNote.coverage_end}`}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 shrink-0 text-xs"
                        render={
                          <Link
                            to="/clients/$clientId/policies/$policyId"
                            params={{ clientId, policyId: pol.id }}
                          >
                            View Policy
                            <ArrowRight className="size-3" />
                          </Link>
                        }
                      />
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Operational Activity Stream */}
        <div className="flex flex-col gap-4">
          <ActivityTimeline clientId={clientId} />
        </div>
      </div>
    </div>
  )
}
