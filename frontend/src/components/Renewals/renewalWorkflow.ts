import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileQuestion,
  FileText,
  type LucideIcon,
  Mail,
} from "lucide-react"
import type {
  PolicyPublic,
  RenewalHorizonItem,
  RenewalHorizonResponse,
  RenewalPublic,
  RenewalStatus,
} from "@/client"

export interface RenewalStageMeta {
  status: RenewalStatus
  label: string
  sheetLabel: string
  shortLabel: string
  color: string
  icon: LucideIcon
  nextActionLabel?: string
}

export const RENEWAL_WORKFLOW_STAGES: readonly RenewalStageMeta[] = [
  {
    status: "awaiting_carrier",
    label: "Awaiting Insurer",
    sheetLabel: "Awaiting Insurer Terms",
    shortLabel: "Insurer Quoting",
    color:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    icon: FileQuestion,
    nextActionLabel: "Log Insurer Terms",
  },
  {
    status: "carrier_received",
    label: "Terms Received",
    sheetLabel: "Insurer Terms Received",
    shortLabel: "Terms In Hand",
    color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
    icon: FileText,
    nextActionLabel: "Prepare Invitation",
  },
  {
    status: "client_invited",
    label: "Client Invited",
    sheetLabel: "Client Invited / Quoted",
    shortLabel: "Client Invited",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: Mail,
    nextActionLabel: "Follow Up",
  },
  {
    status: "changes_requested",
    label: "Changes Requested",
    sheetLabel: "Changes Requested",
    shortLabel: "Negotiation",
    color:
      "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
    icon: AlertCircle,
    nextActionLabel: "Revise Terms",
  },
  {
    status: "paid",
    label: "Payment Settled",
    sheetLabel: "Premium Payment Settled",
    shortLabel: "Paid",
    color:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: CreditCard,
    nextActionLabel: "Complete Renewal",
  },
  {
    status: "completed",
    label: "Completed",
    sheetLabel: "Renewal Bound & Completed",
    shortLabel: "Completed",
    color:
      "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40",
    icon: CheckCircle2,
  },
] as const

const CANCELLED_STAGE_META: RenewalStageMeta = {
  status: "cancelled",
  label: "Cancelled",
  sheetLabel: "Cancelled",
  shortLabel: "Cancelled",
  color: "bg-muted text-muted-foreground border-border",
  icon: Clock,
}

const STAGE_META_BY_STATUS: Record<RenewalStatus, RenewalStageMeta> = {
  awaiting_carrier: RENEWAL_WORKFLOW_STAGES[0],
  carrier_received: RENEWAL_WORKFLOW_STAGES[1],
  client_invited: RENEWAL_WORKFLOW_STAGES[2],
  changes_requested: RENEWAL_WORKFLOW_STAGES[3],
  paid: RENEWAL_WORKFLOW_STAGES[4],
  completed: RENEWAL_WORKFLOW_STAGES[5],
  cancelled: CANCELLED_STAGE_META,
}

export function getRenewalStageMeta(
  status?: RenewalStatus | null,
): Omit<RenewalStageMeta, "status"> {
  if (status && status in STAGE_META_BY_STATUS) {
    return STAGE_META_BY_STATUS[status]
  }
  return {
    label: status || "Unknown",
    sheetLabel: status || "Unknown",
    shortLabel: status || "Unknown",
    color: "bg-muted text-muted-foreground",
    icon: Clock,
  }
}

export function getRenewalActionLabel(status?: RenewalStatus | null): string {
  if (!status) return "Start Renewal"
  return STAGE_META_BY_STATUS[status]?.nextActionLabel ?? "Start Renewal"
}

export interface PartitionedRenewalHorizon {
  expiring30: RenewalHorizonItem[]
  expiring60: RenewalHorizonItem[]
  expired: RenewalHorizonItem[]
  inWorkflow: RenewalHorizonItem[]
  completedRenewals: RenewalHorizonItem[]
}

function isTerminalStatus(status?: string | null): boolean {
  return ["completed", "cancelled"].includes(status?.toLowerCase() || "")
}

export function partitionRenewalHorizon(
  horizonData?: RenewalHorizonResponse | null,
  renewals?: RenewalPublic[] | null,
): PartitionedRenewalHorizon {
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
  for (const renewal of renewals ?? []) {
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
        policy: undefined as unknown as PolicyPublic,
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
}
