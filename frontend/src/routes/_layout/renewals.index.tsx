import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  RefreshCw,
  Shield,
  ShieldAlert,
  User,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import type { PolicyPublic, RenewalHorizonItem } from "@/client"

import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import { PageHeader } from "@/components/Common/PageHeader"
import { QueryErrorBanner } from "@/components/Common/QueryErrorBanner"
import PendingItems from "@/components/Pending/PendingItems"
import { RenewalStatusBadge } from "@/components/Renewals/RenewalStatusBadge"
import { RenewalTransitionSheet } from "@/components/Renewals/RenewalTransitionSheet"
import {
  getRenewalActionLabel,
  partitionRenewalHorizon,
} from "@/components/Renewals/renewalWorkflow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRenewals, useRenewalsHorizon } from "@/hooks/useRenewals"
import { cn } from "@/lib/utils"
import { extractCoverSummary } from "@/utils/coverSnapshot"
import { getPolicyDisplayName } from "@/utils/insurance"

const RENEWAL_TABS = [
  "expiring_30",
  "in_workflow",
  "expiring_60",
  "lapsed",
  "completed",
] as const

type RenewalTab = (typeof RENEWAL_TABS)[number]

export const Route = createFileRoute("/_layout/renewals/")({
  validateSearch: (search: Record<string, unknown>): { tab?: RenewalTab } => {
    const tab = search.tab
    if (
      typeof tab === "string" &&
      (RENEWAL_TABS as readonly string[]).includes(tab)
    ) {
      return { tab: tab as RenewalTab }
    }
    return {}
  },
  component: RenewalsDeskPage,
  head: () => ({
    meta: [
      {
        title: "Policy Renewals - HealthWatch MS",
      },
    ],
  }),
})

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
                    to="/clients/$clientId/policies"
                    params={{ clientId: item.client_id }}
                    className="text-sm font-medium hover:underline flex items-center gap-1.5"
                  >
                    <User className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.client_name}</span>
                  </Link>
                </div>
              </div>
              <RenewalStatusBadge status={item.renewal?.status} />
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

  const [activeTab, setActiveTabState] = useState<RenewalTab>(() => {
    if (typeof window === "undefined") return "expiring_30"
    const param = new URLSearchParams(window.location.search).get("tab")
    return param && (RENEWAL_TABS as readonly string[]).includes(param)
      ? (param as RenewalTab)
      : "expiring_30"
  })
  const setActiveTab = useCallback((nextTab: string) => {
    const validTab = (RENEWAL_TABS as readonly string[]).includes(nextTab)
      ? (nextTab as RenewalTab)
      : "expiring_30"
    setActiveTabState(validTab)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", validTab)
      window.history.replaceState(null, "", url.toString())
    }
  }, [])
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyPublic | null>(
    null,
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Categorize policies into horizons & stages from server-side horizon
  const categorized = useMemo(
    () => partitionRenewalHorizon(horizonData, renewalsData?.data),
    [horizonData, renewalsData],
  )

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
          const policy = row.original.policy
          const displayName = policy
            ? getPolicyDisplayName(policy)
            : row.original.policy_number
          const product = policy?.product
          const activeNote = policy?.active_note
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
              to="/clients/$clientId/policies"
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
          <RenewalStatusBadge status={row.original.renewal?.status} />
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
      <PageHeader
        eyebrow="Renewals Desk"
        title="Policy Renewals"
        subtitle="Track and manage upcoming policy expirations and renewals."
      />

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
        <TabsList
          variant="line"
          className="w-full max-w-full overflow-x-auto justify-start border-b"
        >
          <TabsTrigger
            value="expiring_30"
            className="gap-2 px-3 py-1.5 text-sm"
          >
            Expiring in ≤30 Days
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
              {categorized.expiring30.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="in_workflow"
            className="gap-2 px-3 py-1.5 text-sm"
          >
            Active Workflows
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
              {categorized.inWorkflow.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="expiring_60"
            className="gap-2 px-3 py-1.5 text-sm"
          >
            Next 60 Days
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
              {categorized.expiring60.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="lapsed" className="gap-2 px-3 py-1.5 text-sm">
            Lapsed / Expired
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
              {categorized.expired.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 px-3 py-1.5 text-sm">
            Bound & Completed
            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
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
        coverageEnd={
          [
            ...categorized.expiring30,
            ...categorized.expiring60,
            ...categorized.expired,
            ...categorized.inWorkflow,
          ].find((h) => h.policy?.id === selectedPolicy?.id)?.coverage_end ??
          null
        }
      />
    </div>
  )
}
