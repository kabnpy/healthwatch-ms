import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  FileQuestion,
  FileText,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  User,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import type { PolicyPublic, RenewalPublic, RenewalStatus } from "@/client"

import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import PendingItems from "@/components/Pending/PendingItems"
import { RenewalTransitionSheet } from "@/components/Renewals/RenewalTransitionSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClients, usePolicies, useRenewals } from "@/hooks/useInsurance"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"
import { getPolicyDisplayName } from "@/utils/insurance"

export const Route = createFileRoute("/_layout/renewals/")({
  component: RenewalsDeskPage,
  head: () => ({
    meta: [
      {
        title: "Renewals Desk - HealthWatch MS",
      },
    ],
  }),
})

const STAGE_META: Record<
  RenewalStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  awaiting_carrier: {
    label: "Awaiting Carrier",
    color:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: FileQuestion,
  },
  carrier_received: {
    label: "Terms Received",
    color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
    icon: FileText,
  },
  client_invited: {
    label: "Client Invited",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: Mail,
  },
  changes_requested: {
    label: "Changes Requested",
    color:
      "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
    icon: AlertCircle,
  },
  paid: {
    label: "Payment Settled",
    color:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: CreditCard,
  },
  completed: {
    label: "Completed",
    color:
      "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
}

function RenewalsDeskPage() {
  const { data: policiesData, isLoading: isPoliciesLoading } = usePolicies(
    undefined,
    0,
    200,
  )
  const { data: clientsData, isLoading: isClientsLoading } = useClients(0, 200)
  const { data: renewalsData, isLoading: isRenewalsLoading } = useRenewals(
    undefined,
    undefined,
    0,
    200,
  )

  const [activeTab, setActiveTab] = useState("expiring_30")
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyPublic | null>(
    null,
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const clientMap = useMemo(() => {
    const map = new Map<string, string>()
    clientsData?.data?.forEach((c) => {
      map.set(c.id, c.name)
    })
    return map
  }, [clientsData])

  const renewalMap = useMemo(() => {
    const map = new Map<string, RenewalPublic>()
    renewalsData?.data?.forEach((r) => {
      map.set(r.policy_id, r)
    })
    return map
  }, [renewalsData])

  const policies = policiesData?.data || []

  // Categorize policies into horizons & stages
  const categorized = useMemo(() => {
    const now = Date.now()

    const expiring30: PolicyPublic[] = []
    const expiring60: PolicyPublic[] = []
    const expired: PolicyPublic[] = []
    const inWorkflow: PolicyPublic[] = []
    const completedRenewals: PolicyPublic[] = []

    policies.forEach((policy) => {
      const activeNote = policy.active_note
      if (!activeNote?.coverage_end) return

      const endDate = new Date(activeNote.coverage_end).getTime()
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
      const renewal = renewalMap.get(policy.id)

      if (renewal) {
        if (renewal.status === "completed") {
          completedRenewals.push(policy)
        } else {
          inWorkflow.push(policy)
        }
      }

      if (daysLeft >= 0 && daysLeft <= 30) {
        expiring30.push(policy)
      } else if (daysLeft > 30 && daysLeft <= 60) {
        expiring60.push(policy)
      } else if (daysLeft < 0) {
        expired.push(policy)
      }
    })

    return {
      expiring30,
      expiring60,
      expired,
      inWorkflow,
      completedRenewals,
    }
  }, [policies, renewalMap])

  const openTriage = useCallback((policy: PolicyPublic) => {
    setSelectedPolicy(policy)
    setIsSheetOpen(true)
  }, [])

  const columns: ColumnDef<PolicyPublic>[] = useMemo(
    () => [
      {
        accessorKey: "policy_number",
        header: "Policy No",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openTriage(row.original)}
            className="font-mono text-xs font-semibold hover:underline text-primary flex items-center gap-1.5 text-left cursor-pointer"
          >
            <span>{row.original.policy_number}</span>
          </button>
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
          const product = row.original.product
          const activeNote = row.original.active_note
          const snapshot = activeNote?.cover_snapshot as any

          let assetDescriptor = "Asset / Risk Details"
          if (snapshot?.vehicle?.reg_no) {
            assetDescriptor = `${snapshot.vehicle.make || "Vehicle"} ${snapshot.vehicle.model || ""} (${snapshot.vehicle.reg_no})`
          } else if (snapshot?.property?.location) {
            assetDescriptor = snapshot.property.location
          } else if (product?.class_of_insurance) {
            assetDescriptor = product.class_of_insurance
          }

          return (
            <div className="flex flex-col">
              <span className="font-semibold text-xs leading-none">
                {getPolicyDisplayName(row.original)}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px]">
                {assetDescriptor}
              </span>
            </div>
          )
        },
      },
      {
        id: "expiry_countdown",
        header: "Renewal Horizon",
        cell: ({ row }) => {
          const activeNote = row.original.active_note
          if (!activeNote?.coverage_end) return <span>—</span>

          const endDate = new Date(activeNote.coverage_end).getTime()
          const daysLeft = Math.ceil(
            (endDate - Date.now()) / (1000 * 60 * 60 * 24),
          )

          return (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  daysLeft <= 7
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                    : daysLeft <= 30
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                }`}
              >
                <Clock className="size-3" />
                {daysLeft > 0
                  ? `${daysLeft}d left`
                  : daysLeft === 0
                    ? "Expires today"
                    : `Expired ${Math.abs(daysLeft)}d ago`}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                ({activeNote.coverage_end})
              </span>
            </div>
          )
        },
      },
      {
        id: "workflow_stage",
        header: "Workflow Stage",
        cell: ({ row }) => {
          const renewal = renewalMap.get(row.original.id)
          if (!renewal) {
            return (
              <Badge
                variant="outline"
                className="text-[11px] text-muted-foreground font-normal"
              >
                Not Initiated
              </Badge>
            )
          }

          const meta = (renewal.status ? STAGE_META[renewal.status] : null) || {
            label: renewal.status || "Unknown",
            color: "bg-muted text-muted-foreground",
            icon: Clock,
          }
          const Icon = meta.icon

          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                meta.color,
              )}
            >
              <Icon className="size-3" />
              {meta.label}
            </span>
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
        id: "action",
        header: () => <span className="sr-only">Action</span>,
        cell: ({ row }) => {
          const renewal = renewalMap.get(row.original.id)
          return (
            <div className="text-right">
              <Button
                size="sm"
                variant={renewal ? "default" : "outline"}
                onClick={() => openTriage(row.original)}
                className="h-8 gap-1.5 cursor-pointer text-xs"
              >
                {renewal ? "Advance Stage" : "Review & Renew"}
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )
        },
      },
    ],
    [clientMap, renewalMap, openTriage],
  )

  if (isPoliciesLoading || isClientsLoading || isRenewalsLoading) {
    return <PendingItems />
  }

  const selectedRenewal = selectedPolicy
    ? renewalMap.get(selectedPolicy.id) || null
    : null
  const selectedClientName = selectedPolicy
    ? clientMap.get(selectedPolicy.client_id)
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Renewals Desk</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            6-Stage Renewal Workflow & Expiry Triage Pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/policies">Browse All Policies</Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
              Expiring in ≤30 Days
              <Clock className="size-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-amber-700 dark:text-amber-400">
              {categorized.expiring30.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires carrier terms & client renewal notice
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center justify-between">
              Active In-Flight Renewals
              <RefreshCw className="size-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-400">
              {categorized.inWorkflow.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently navigating 6-stage lifecycle
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Expiring in 31–60 Days
              <Clock className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {categorized.expiring60.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upcoming renewal horizon
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-between">
              Overdue / Lapsed
              <ShieldAlert className="size-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-rose-700 dark:text-rose-400">
              {categorized.expired.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Expired without active renewal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="expiring_30" className="gap-2 text-xs">
            Expiring in ≤30 Days
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {categorized.expiring30.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="in_workflow" className="gap-2 text-xs">
            Active Workflows
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {categorized.inWorkflow.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="expiring_60" className="gap-2 text-xs">
            Next 60 Days
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {categorized.expiring60.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="lapsed" className="gap-2 text-xs">
            Lapsed / Expired
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {categorized.expired.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 text-xs">
            Bound & Completed
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {categorized.completedRenewals.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expiring_30" className="pt-4">
          {categorized.expiring30.length === 0 ? (
            <EmptyState
              title="No policies expiring within 30 days"
              description="All current policies have comfortable coverage terms. Check the 60-day horizon to prepare upcoming renewals."
              icon={FileCheck2}
            />
          ) : (
            <DataTable
              columns={columns}
              data={categorized.expiring30}
              searchPlaceholder="Search urgent renewals..."
            />
          )}
        </TabsContent>

        <TabsContent value="in_workflow" className="pt-4">
          {categorized.inWorkflow.length === 0 ? (
            <EmptyState
              title="No renewals currently in flight"
              description="Click 'Review & Renew' on an expiring policy to initiate the carrier terms and invitation workflow."
              icon={RefreshCw}
            />
          ) : (
            <DataTable
              columns={columns}
              data={categorized.inWorkflow}
              searchPlaceholder="Search active renewal workflows..."
            />
          )}
        </TabsContent>

        <TabsContent value="expiring_60" className="pt-4">
          {categorized.expiring60.length === 0 ? (
            <EmptyState
              title="No policies expiring in 31–60 days"
              description="There are no policies entering the 60-day renewal prep window."
              icon={Clock}
            />
          ) : (
            <DataTable
              columns={columns}
              data={categorized.expiring60}
              searchPlaceholder="Search 60-day renewals..."
            />
          )}
        </TabsContent>

        <TabsContent value="lapsed" className="pt-4">
          {categorized.expired.length === 0 ? (
            <EmptyState
              title="No lapsed policies"
              description="Zero policies are currently expired without renewed terms. Perfect operational compliance!"
              icon={CheckCircle2}
            />
          ) : (
            <DataTable
              columns={columns}
              data={categorized.expired}
              searchPlaceholder="Search lapsed policies..."
            />
          )}
        </TabsContent>

        <TabsContent value="completed" className="pt-4">
          {categorized.completedRenewals.length === 0 ? (
            <EmptyState
              title="No completed renewals yet"
              description="Renewals that are bound and closed will be logged here for historical tracking."
              icon={Shield}
            />
          ) : (
            <DataTable
              columns={columns}
              data={categorized.completedRenewals}
              searchPlaceholder="Search completed renewals..."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Slide-over Renewal Transition Drawer */}
      <RenewalTransitionSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        policy={selectedPolicy}
        clientName={selectedClientName}
        renewal={selectedRenewal}
      />
    </div>
  )
}
