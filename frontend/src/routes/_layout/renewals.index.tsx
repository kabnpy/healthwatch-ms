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
import type { PolicyPublic, RenewalHorizonItem, RenewalStatus } from "@/client"

import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import PendingItems from "@/components/Pending/PendingItems"
import { RenewalTransitionSheet } from "@/components/Renewals/RenewalTransitionSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRenewals, useRenewalsHorizon } from "@/hooks/useRenewals"
import { cn } from "@/lib/utils"
import { extractCoverSummary } from "@/utils/coverSnapshot"
import { getPolicyDisplayName } from "@/utils/insurance"

export const Route = createFileRoute("/_layout/renewals/")({
  component: RenewalsDeskPage,
  head: () => ({
    meta: [
      {
        title: "Policy Renewals - HealthWatch MS",
      },
    ],
  }),
})

const STAGE_META: Record<
  RenewalStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  awaiting_carrier: {
    label: "Awaiting Insurer",
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

const NEXT_STAGE_ACTION: Partial<Record<RenewalStatus, string>> = {
  awaiting_carrier: "Log Insurer Terms",
  carrier_received: "Prepare Invitation",
  client_invited: "Follow Up",
  changes_requested: "Revise Terms",
  paid: "Complete Renewal",
}

function getRenewalActionLabel(status?: RenewalStatus | null): string {
  if (!status) return "Start Renewal"
  return NEXT_STAGE_ACTION[status] ?? "Start Renewal"
}

function RenewalHorizonPill({
  coverageEnd,
  daysLeft,
}: {
  coverageEnd?: string | null
  daysLeft: number
}) {
  if (!coverageEnd) return <span>—</span>
  return (
    <div className="flex items-center gap-2 flex-wrap">
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
        ({coverageEnd})
      </span>
    </div>
  )
}

function WorkflowStageBadge({
  renewal,
}: {
  renewal?: RenewalHorizonItem["renewal"]
}) {
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
}

function RenewalTriageList({
  items,
  columns,
  searchPlaceholder,
  onOpenTriage,
}: {
  items: RenewalHorizonItem[]
  columns: ColumnDef<RenewalHorizonItem>[]
  searchPlaceholder: string
  onOpenTriage: (policy: PolicyPublic) => void
}) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={items}
          searchPlaceholder={searchPlaceholder}
        />
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <Card
            key={item.policy_id}
            data-testid="renewal-mobile-card"
            className="p-4 gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenTriage(item.policy)}
                  className="font-mono text-xs font-semibold hover:underline text-primary text-left cursor-pointer"
                >
                  {item.policy_number}
                </button>
                <div className="mt-1">
                  <Link
                    to="/clients/$clientId/overview"
                    params={{ clientId: item.client_id }}
                    className="text-sm font-medium hover:underline flex items-center gap-1.5"
                  >
                    <User className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.client_name}</span>
                  </Link>
                </div>
              </div>
              <WorkflowStageBadge renewal={item.renewal} />
            </div>

            <RenewalHorizonPill
              coverageEnd={item.coverage_end}
              daysLeft={item.days_left}
            />

            <Button
              size="sm"
              variant={item.renewal ? "default" : "outline"}
              onClick={() => onOpenTriage(item.policy)}
              className="w-full justify-center gap-1.5 cursor-pointer text-xs"
            >
              {getRenewalActionLabel(item.renewal?.status)}
              <ArrowRight className="size-3.5" />
            </Button>
          </Card>
        ))}
      </div>
    </>
  )
}

function RenewalsDeskPage() {
  const {
    data: horizonData,
    isLoading: isHorizonLoading,
    isError: isHorizonError,
    refetch: refetchHorizon,
  } = useRenewalsHorizon()
  const { data: renewalsData } = useRenewals()

  const [activeTab, setActiveTab] = useState("expiring_30")
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyPublic | null>(
    null,
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Categorize policies into horizons & stages from server-side horizon
  const categorized = useMemo(() => {
    const isTerminalStatus = (status?: string | null) =>
      ["completed", "cancelled"].includes(status?.toLowerCase() || "")

    const expiring30 = (horizonData?.["0_30"] ?? []).filter(
      (item) => !item.renewal || isTerminalStatus(item.renewal.status),
    )
    const expiring60 = horizonData?.["31_60"] ?? []
    const expired = horizonData?.overdue ?? []
    const allItems = [
      ...expired,
      ...(horizonData?.["0_30"] ?? []),
      ...expiring60,
      ...(horizonData?.["61_90"] ?? []),
    ]
    const inWorkflow: RenewalHorizonItem[] = []
    const completedRenewals: RenewalHorizonItem[] = []

    for (const item of allItems) {
      if (item.renewal) {
        if (item.renewal.status === "completed") {
          completedRenewals.push(item)
        } else if (!isTerminalStatus(item.renewal.status)) {
          inWorkflow.push(item)
        }
      }
    }

    const inWorkflowPolicyIds = new Set(inWorkflow.map((item) => item.policy_id))
    for (const renewal of renewalsData?.data ?? []) {
      if (
        !isTerminalStatus(renewal.status) &&
        !inWorkflowPolicyIds.has(renewal.policy_id)
      ) {
        inWorkflowPolicyIds.add(renewal.policy_id)
        inWorkflow.push({
          policy_id: renewal.policy_id,
          policy_number: renewal.policy_id,
          client_id: "",
          client_name: "—",
          coverage_end: "",
          days_left: 0,
          renewal,
        })
      }
    }

    return {
      expiring30,
      expiring60,
      expired,
      inWorkflow,
      completedRenewals,
    }
  }, [horizonData, renewalsData])

  const openTriage = useCallback((policy: PolicyPublic) => {
    setSelectedPolicy(policy)
    setIsSheetOpen(true)
  }, [])

  const columns: ColumnDef<RenewalHorizonItem>[] = useMemo(
    () => [
      {
        accessorKey: "policy_number",
        header: "Policy / Cover",
        cell: ({ row }) => {
          const displayName = getPolicyDisplayName(row.original.policy)
          const product = row.original.policy.product
          const activeNote = row.original.policy.active_note
          const summary = extractCoverSummary(activeNote?.cover_snapshot)

          let assetDescriptor: string | null = null
          if (summary.vehicleReg) {
            assetDescriptor = `${summary.makeModel || "Vehicle"} (${summary.vehicleReg})`
          } else if (summary.propertyLocation) {
            assetDescriptor = summary.propertyLocation
          } else if (
            product?.class_of_insurance &&
            product.class_of_insurance.trim().toLowerCase() !==
              displayName.trim().toLowerCase()
          ) {
            assetDescriptor = product.class_of_insurance
          }

          return (
            <div className="flex flex-col gap-0.5 min-w-0">
              <button
                type="button"
                onClick={() => openTriage(row.original.policy)}
                className="font-mono text-xs font-semibold hover:underline text-primary flex items-center gap-1.5 text-left cursor-pointer w-fit"
              >
                <span>{row.original.policy_number}</span>
              </button>
              <span className="font-medium text-xs leading-tight truncate max-w-[220px]">
                {displayName}
              </span>
              {assetDescriptor ? (
                <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                  {assetDescriptor}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "client_name",
        header: "Insured Client",
        cell: ({ row }) => {
          const clientName = row.original.client_name
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
        id: "expiry_countdown",
        header: "Renewal Horizon",
        cell: ({ row }) => (
          <RenewalHorizonPill
            coverageEnd={row.original.coverage_end}
            daysLeft={row.original.days_left}
          />
        ),
      },
      {
        id: "workflow_stage",
        header: "Workflow Stage",
        cell: ({ row }) => (
          <WorkflowStageBadge renewal={row.original.renewal} />
        ),
      },
      {
        id: "action",
        header: () => <span className="sr-only">Action</span>,
        cell: ({ row }) => {
          const renewal = row.original.renewal
          return (
            <div className="text-right">
              <Button
                size="sm"
                variant={renewal ? "default" : "outline"}
                onClick={() => openTriage(row.original.policy)}
                className="h-8 gap-1.5 cursor-pointer text-xs"
              >
                {getRenewalActionLabel(renewal?.status)}
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )
        },
      },
    ],
    [openTriage],
  )

  if (isHorizonLoading) {
    return <PendingItems />
  }

  if (isHorizonError) {
    return (
      <div className="p-6">
        <QueryErrorBanner
          message="Failed to load renewals pipeline. Please try again."
          onRetry={() => void refetchHorizon()}
        />
      </div>
    )
  }

  const allHorizonItems = [
    ...(horizonData?.overdue ?? []),
    ...(horizonData?.["0_30"] ?? []),
    ...(horizonData?.["31_60"] ?? []),
    ...(horizonData?.["61_90"] ?? []),
  ]
  const selectedItem = selectedPolicy
    ? allHorizonItems.find((item) => item.policy_id === selectedPolicy.id) ||
      null
    : null
  const selectedRenewal = selectedItem?.renewal || null
  const selectedClientName = selectedItem?.client_name

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b pb-6">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Renewals Desk
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Policy Renewals</h1>
        <p className="text-sm text-muted-foreground">
          Track and manage upcoming policy expirations and renewals.
        </p>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className={cn(
            categorized.expiring30.length > 0 &&
              "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle
              className={cn(
                "text-xs font-semibold uppercase tracking-wider flex items-center justify-between",
                categorized.expiring30.length > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              Expiring in ≤30 Days
              <Clock
                className={cn(
                  "size-4",
                  categorized.expiring30.length > 0
                    ? "text-amber-600"
                    : "text-muted-foreground",
                )}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-3xl font-bold font-mono",
                categorized.expiring30.length > 0 &&
                  "text-amber-700 dark:text-amber-400",
              )}
            >
              {categorized.expiring30.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires insurer terms & client renewal notice
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            categorized.inWorkflow.length > 0 &&
              "border-blue-500/30 bg-blue-500/5",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle
              className={cn(
                "text-xs font-semibold uppercase tracking-wider flex items-center justify-between",
                categorized.inWorkflow.length > 0
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-muted-foreground",
              )}
            >
              Active In-Flight Renewals
              <RefreshCw
                className={cn(
                  "size-4",
                  categorized.inWorkflow.length > 0
                    ? "text-blue-600"
                    : "text-muted-foreground",
                )}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-3xl font-bold font-mono",
                categorized.inWorkflow.length > 0 &&
                  "text-blue-700 dark:text-blue-400",
              )}
            >
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

        <Card
          className={cn(
            categorized.expired.length > 0 &&
              "border-rose-500/30 bg-rose-500/5",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle
              className={cn(
                "text-xs font-semibold uppercase tracking-wider flex items-center justify-between",
                categorized.expired.length > 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              Overdue / Lapsed
              <ShieldAlert
                className={cn(
                  "size-4",
                  categorized.expired.length > 0
                    ? "text-rose-600"
                    : "text-muted-foreground",
                )}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-3xl font-bold font-mono",
                categorized.expired.length > 0 &&
                  "text-rose-700 dark:text-rose-400",
              )}
            >
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
        <TabsList className="bg-muted/60 p-1 max-w-full overflow-x-auto justify-start">
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
            <RenewalTriageList
              items={categorized.expiring30}
              columns={columns}
              searchPlaceholder="Search urgent renewals..."
              onOpenTriage={openTriage}
            />
          )}
        </TabsContent>

        <TabsContent value="in_workflow" className="pt-4">
          {categorized.inWorkflow.length === 0 ? (
            <EmptyState
              title="No renewals currently in flight"
              description="Click 'Start Renewal' on an expiring policy to initiate the insurer terms and invitation workflow."
              icon={RefreshCw}
            />
          ) : (
            <RenewalTriageList
              items={categorized.inWorkflow}
              columns={columns}
              searchPlaceholder="Search active renewal workflows..."
              onOpenTriage={openTriage}
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
            <RenewalTriageList
              items={categorized.expiring60}
              columns={columns}
              searchPlaceholder="Search 60-day renewals..."
              onOpenTriage={openTriage}
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
            <RenewalTriageList
              items={categorized.expired}
              columns={columns}
              searchPlaceholder="Search lapsed policies..."
              onOpenTriage={openTriage}
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
            <RenewalTriageList
              items={categorized.completedRenewals}
              columns={columns}
              searchPlaceholder="Search completed renewals..."
              onOpenTriage={openTriage}
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
