import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ExternalLink,
  MoreHorizontal,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { PolicyPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useClients, usePolicies } from "@/hooks/useInsurance"
import { formatCurrency } from "@/utils"
import { getPolicyDisplayName } from "@/utils/insurance"

export const Route = createFileRoute("/_layout/policies/")({
  component: GlobalPoliciesPage,
  head: () => ({
    meta: [
      {
        title: "Policies Portfolio - HealthWatch MS",
      },
    ],
  }),
})

function GlobalPoliciesPage() {
  const { data: policiesData, isLoading: isPoliciesLoading } = usePolicies(
    undefined,
    0,
    200,
  )
  const { data: clientsData, isLoading: isClientsLoading } = useClients(0, 200)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const clientMap = useMemo(() => {
    const map = new Map<string, string>()
    clientsData?.data?.forEach((c) => {
      map.set(c.id, c.name)
    })
    return map
  }, [clientsData])

  const policies = policiesData?.data || []

  const filteredPolicies = useMemo(() => {
    if (statusFilter === "all") return policies
    return policies.filter(
      (p) => p.status?.toLowerCase() === statusFilter.toLowerCase(),
    )
  }, [policies, statusFilter])

  const columns: ColumnDef<PolicyPublic>[] = useMemo(
    () => [
      {
        accessorKey: "policy_number",
        header: "Policy No",
        cell: ({ row }) => (
          <Link
            to="/clients/$clientId/policies/$policyId"
            params={{
              clientId: row.original.client_id,
              policyId: row.original.id,
            }}
            className="font-mono text-xs font-semibold hover:underline text-primary flex items-center gap-1.5"
          >
            <Shield className="size-3.5 text-muted-foreground shrink-0" />
            <span>{row.original.policy_number}</span>
          </Link>
        ),
      },
      {
        id: "client_name",
        header: "Insured Client",
        cell: ({ row }) => {
          const clientName =
            clientMap.get(row.original.client_id) || "Unknown Client"
          return (
            <Link
              to="/clients/$clientId/overview"
              params={{ clientId: row.original.client_id }}
              className="text-sm font-medium hover:underline flex items-center gap-1.5"
            >
              <User className="size-3.5 text-muted-foreground shrink-0" />
              <span>{clientName}</span>
            </Link>
          )
        },
      },
      {
        id: "cover_details",
        header: "Cover / Asset",
        cell: ({ row }) => {
          const displayName = getPolicyDisplayName(row.original)
          const productClass =
            row.original.product?.class_of_insurance ||
            row.original.product?.name
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">
                {displayName}
              </span>
              {productClass && (
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  {productClass}
                </span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status || "Unknown"
          const isActive = status === "Active"
          const isExpired = status === "Expired" || status === "Lapsed"

          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : isExpired
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isActive
                    ? "bg-emerald-500"
                    : isExpired
                      ? "bg-rose-500"
                      : "bg-amber-500"
                }`}
              />
              {status}
            </span>
          )
        },
      },
      {
        id: "coverage_period",
        header: "Coverage & Expiry",
        cell: ({ row }) => {
          const activeNote = row.original.active_note
          if (!activeNote?.coverage_end) {
            return (
              <span className="text-xs text-muted-foreground italic">
                No active term
              </span>
            )
          }

          const expiryDate = new Date(activeNote.coverage_end)
          const daysToExpiry = Math.ceil(
            (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          )

          return (
            <div className="flex flex-col">
              <span className="text-xs font-mono font-medium">
                {activeNote.coverage_end}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  daysToExpiry <= 14
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : daysToExpiry <= 30
                      ? "text-amber-600 dark:text-amber-400 font-bold"
                      : "text-muted-foreground"
                }`}
              >
                {daysToExpiry > 0
                  ? `${daysToExpiry} days left`
                  : daysToExpiry === 0
                    ? "Expires today"
                    : `Expired ${Math.abs(daysToExpiry)}d ago`}
              </span>
            </div>
          )
        },
      },
      {
        id: "sum_insured",
        header: () => <span className="block text-right">Sum Insured</span>,
        cell: ({ row }) => {
          const snapshot = row.original.active_note?.cover_snapshot as any
          const rawSum =
            snapshot?.vehicle?.sum_insured || snapshot?.sum_insured || 0

          return (
            <div className="text-right">
              <span className="font-mono tabular-nums text-xs font-medium">
                {rawSum > 0 ? formatCurrency(rawSum) : "—"}
              </span>
            </div>
          )
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const policy = row.original
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/clients/$clientId/policies/$policyId"
                      params={{
                        clientId: policy.client_id,
                        policyId: policy.id,
                      }}
                      className="cursor-pointer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Digital File
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/clients/$clientId/overview"
                      params={{ clientId: policy.client_id }}
                      className="cursor-pointer"
                    >
                      <User className="mr-2 h-4 w-4" />
                      View Client Hub
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(policy.policy_number)
                    }}
                  >
                    Copy Policy Number
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [clientMap],
  )

  if (isPoliciesLoading || isClientsLoading) {
    return <PendingItems />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policies Hub</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            Agency Portfolio Across All Carriers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/renewals">View Renewals Desk</Link>
          </Button>
          <Button asChild>
            <Link to="/clients">
              <Plus className="mr-2 size-4" />
              New Policy (Select Client)
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
          className="text-xs h-8"
        >
          All Policies ({policies.length})
        </Button>
        <Button
          variant={statusFilter === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("active")}
          className="text-xs h-8 gap-1.5"
        >
          <ShieldCheck className="size-3.5 text-emerald-500" />
          Active (
          {policies.filter((p) => p.status?.toLowerCase() === "active").length})
        </Button>
        <Button
          variant={statusFilter === "lapsed" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("lapsed")}
          className="text-xs h-8 gap-1.5"
        >
          <ShieldAlert className="size-3.5 text-rose-500" />
          Lapsed / Expired (
          {
            policies.filter((p) =>
              ["expired", "lapsed", "cancelled"].includes(
                p.status?.toLowerCase() || "",
              ),
            ).length
          }
          )
        </Button>
      </div>

      {filteredPolicies.length === 0 ? (
        <EmptyState
          title="No policies match filter"
          description="Try adjusting your status filter or issue a new policy from the Client Hub."
          icon={Shield}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredPolicies}
          searchPlaceholder="Search by policy number, client, cover..."
        />
      )}
    </div>
  )
}
