import { Link } from "@tanstack/react-router"
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  type Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileQuestion,
  FileText,
  Mail,
  Printer,
  Receipt,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { PolicyPublic, RenewalPublic, RenewalStatus } from "@/client"
import { AdvisoryRatingCalculator } from "@/components/Insurance/AdvisoryRatingCalculator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { usePolicyClaimsAdvocacySummary } from "@/hooks/useClaims"
import useCustomToast from "@/hooks/useCustomToast"
import {
  useCreateRenewal,
  useTransitionRenewal,
  useUpdateRenewal,
} from "@/hooks/useInsurance"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils"
import type { AdvisoryRatingResult } from "@/utils/ratingCalculator"

interface RenewalTransitionSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  policy: PolicyPublic | null
  clientName?: string
  renewal: RenewalPublic | null
}

const STAGES: {
  status: RenewalStatus
  label: string
  shortLabel: string
  icon: typeof Clock
  color: string
}[] = [
  {
    status: "awaiting_carrier",
    label: "Awaiting Carrier Terms",
    shortLabel: "Carrier Quoting",
    icon: FileQuestion,
    color:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  {
    status: "carrier_received",
    label: "Carrier Terms Received",
    shortLabel: "Terms In Hand",
    icon: FileText,
    color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  },
  {
    status: "client_invited",
    label: "Client Invited / Quoted",
    shortLabel: "Client Invited",
    icon: Mail,
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  {
    status: "changes_requested",
    label: "Changes Requested",
    shortLabel: "Negotiation",
    icon: AlertCircle,
    color:
      "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  {
    status: "paid",
    label: "Premium Payment Settled",
    shortLabel: "Paid",
    icon: CreditCard,
    color:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    status: "completed",
    label: "Renewal Bound & Completed",
    shortLabel: "Completed",
    icon: CheckCircle2,
    color:
      "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40",
  },
]

export function RenewalTransitionSheet({
  isOpen,
  onOpenChange,
  policy,
  clientName,
  renewal,
}: RenewalTransitionSheetProps) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const createRenewalMutation = useCreateRenewal()
  const transitionMutation = useTransitionRenewal()
  const updateMutation = useUpdateRenewal()
  const { data: claimsSummary } = usePolicyClaimsAdvocacySummary(policy?.id)

  const [proposedPremium, setProposedPremium] = useState<number>(0)
  const [agreedPremium, setAgreedPremium] = useState<number>(0)
  const [carrierDocKey, setCarrierDocKey] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [ratingCalcOpen, setRatingCalcOpen] = useState<boolean>(false)

  const handleApplyRating = (result: AdvisoryRatingResult) => {
    setProposedPremium(result.grossTotal)
    setAgreedPremium(result.grossTotal)
    const breakdownNote = `Advisory rating calculated: Gross KES ${result.grossTotal.toLocaleString()} (Net KES ${result.netPremium.toLocaleString()}, Levies KES ${result.taxesAndLevies.totalLevies.toLocaleString()})`
    setNotes((prev) => (prev ? `${prev}\n${breakdownNote}` : breakdownNote))
  }

  // Sync state when renewal opens
  useEffect(() => {
    if (renewal) {
      setProposedPremium(Number(renewal.proposed_premium || 0))
      setAgreedPremium(Number(renewal.agreed_premium || 0))
      setCarrierDocKey(renewal.carrier_document_key || "")
      setNotes(renewal.notes || "")
    } else if (policy?.active_note) {
      const prev = Number(policy.active_note.total_amount || 0)
      setProposedPremium(prev)
      setAgreedPremium(prev)
      setCarrierDocKey("")
      setNotes("")
    }
  }, [renewal, policy])

  if (!policy) return null

  const currentStatus = renewal?.status || "awaiting_carrier"
  const currentStageIndex = STAGES.findIndex((s) => s.status === currentStatus)
  const activeNote = policy.active_note
  const prevPremium = Number(
    renewal?.previous_premium || activeNote?.total_amount || 0,
  )

  // Handle Initiating Renewal if not yet started
  const handleInitiate = async () => {
    if (!activeNote?.coverage_end) return
    const startDate = activeNote.coverage_end
    const endDate = new Date(
      new Date(startDate).getTime() + 365 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split("T")[0]

    try {
      await createRenewalMutation.mutateAsync({
        policy_id: policy.id,
        renewal_period_start: startDate,
        renewal_period_end: endDate,
        previous_premium: String(prevPremium),
        proposed_premium:
          proposedPremium > 0 ? String(proposedPremium) : undefined,
        notes: notes || undefined,
      })
      showSuccessToast("Renewal workflow initiated successfully.")
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to initiate renewal.")
    }
  }

  // Handle Stage Transition with OCC
  const handleTransition = async (targetStatus: RenewalStatus) => {
    if (!renewal) return
    try {
      await transitionMutation.mutateAsync({
        id: renewal.id,
        data: {
          target_status: targetStatus,
          expected_version: renewal.version,
          agreed_premium: agreedPremium > 0 ? String(agreedPremium) : undefined,
          notes: notes || undefined,
        },
      })
      showSuccessToast(
        `Renewal transitioned to ${targetStatus.replace(/_/g, " ")}.`,
      )
    } catch (err: any) {
      if (err?.status === 409 || err?.response?.status === 409) {
        showErrorToast(
          "Version conflict (OCC): This renewal was updated by another user. The latest state has been refreshed.",
        )
      } else {
        showErrorToast(err?.message || "Transition failed.")
      }
    }
  }

  // Handle Saving Financials
  const handleSaveFinancials = async () => {
    if (!renewal) return
    try {
      await updateMutation.mutateAsync({
        id: renewal.id,
        data: {
          expected_version: renewal.version,
          proposed_premium:
            proposedPremium > 0 ? String(proposedPremium) : undefined,
          agreed_premium: agreedPremium > 0 ? String(agreedPremium) : undefined,
          carrier_document_key: carrierDocKey || undefined,
          notes: notes || undefined,
        },
      })
      showSuccessToast("Renewal financials & terms updated.")
    } catch (err: any) {
      if (err?.status === 409 || err?.response?.status === 409) {
        showErrorToast("Version conflict: Refreshed latest renewal state.")
      } else {
        showErrorToast(err?.message || "Failed to update financials.")
      }
    }
  }

  const isPending =
    createRenewalMutation.isPending ||
    transitionMutation.isPending ||
    updateMutation.isPending

  const delta =
    agreedPremium > 0
      ? agreedPremium - prevPremium
      : proposedPremium - prevPremium

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-6 p-6">
        <SheetHeader className="space-y-1.5 border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              Renewal Review
            </span>
            {renewal ? (
              <Badge variant="outline" className="font-mono text-xs">
                OCC v{renewal.version}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs text-amber-600 border-amber-500/30"
              >
                Uninitiated
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <span className="font-mono">{policy.policy_number}</span>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground flex items-center gap-1.5">
            <User className="size-3.5" />
            <span>{clientName || "Client Portfolio"}</span>
            <span>•</span>
            <span>Expires: {activeNote?.coverage_end || "N/A"}</span>
          </SheetDescription>
        </SheetHeader>

        {/* 6-Stage Visual Stepper */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workflow Progress
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {STAGES.map((s, idx) => {
              const isCurrent = s.status === currentStatus && !!renewal
              const isPast =
                renewal &&
                currentStageIndex > idx &&
                currentStatus !== "cancelled"
              const Icon = s.icon

              return (
                <div
                  key={s.status}
                  className={cn(
                    "flex flex-col gap-1 p-2.5 rounded-lg border text-xs transition-all",
                    isCurrent &&
                      "ring-2 ring-primary border-transparent font-medium",
                    isCurrent && s.color,
                    isPast && "bg-muted/40 border-border text-muted-foreground",
                    !isCurrent &&
                      !isPast &&
                      "bg-background border-dashed text-muted-foreground/60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-3.5" />
                    {isPast && (
                      <CheckCircle2 className="size-3 text-emerald-500" />
                    )}
                    {isCurrent && (
                      <span className="size-1.5 rounded-full bg-current animate-pulse" />
                    )}
                  </div>
                  <span className="font-medium text-[11px] leading-tight mt-1 truncate">
                    {s.shortLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Claims Advocacy & Underwriting Loss Ratio Intelligence */}
        {claimsSummary && (
          <div className="flex flex-col gap-2.5 rounded-lg border bg-muted/20 p-3.5 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-primary" />
                <span className="font-bold uppercase tracking-wider text-foreground text-[11px]">
                  Claims Experience & Loss Ratio
                </span>
              </div>
              <div>
                {claimsSummary.claim_experience_tier === "FAVORABLE" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  >
                    Favorable Experience ({claimsSummary.loss_ratio_percent}%)
                  </Badge>
                ) : claimsSummary.claim_experience_tier === "ELEVATED" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                  >
                    Elevated Activity ({claimsSummary.loss_ratio_percent}%)
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                  >
                    Adverse Experience ({claimsSummary.loss_ratio_percent}%)
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded bg-background border">
                <span className="text-[10px] text-muted-foreground uppercase block">
                  Incurred Claims
                </span>
                <span className="font-mono tabular-nums text-xs font-bold text-foreground">
                  {formatCurrency(claimsSummary.total_incurred_claims)}
                </span>
              </div>

              <div className="p-2 rounded bg-background border">
                <span className="text-[10px] text-muted-foreground uppercase block">
                  Settled Claims
                </span>
                <span className="font-mono tabular-nums text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(claimsSummary.total_settled_claims)}
                </span>
              </div>

              <div className="p-2 rounded bg-background border">
                <span className="text-[10px] text-muted-foreground uppercase block">
                  Open Reserves
                </span>
                <span className="font-mono tabular-nums text-xs font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(claimsSummary.total_open_reserves)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              {claimsSummary.claim_experience_tier === "FAVORABLE"
                ? "Low loss ratio supports demanding carrier renewal discounts or no-claim bonus concessions."
                : claimsSummary.claim_experience_tier === "ELEVATED"
                  ? "Moderate claims activity. Recommend maintaining current premium rating without punitive load."
                  : "Adverse loss ratio detected. Anticipate carrier rate loading or review excess / deductible terms."}
            </p>
          </div>
        )}

        {/* Financial Schedule */}
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Financial Schedule (Fixed-Point)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRatingCalcOpen(true)}
                className="h-6 text-[11px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/5"
              >
                <Calculator className="size-3" />
                Calculate Premium
              </Button>
              {delta !== 0 && (
                <span
                  className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded-full",
                    delta > 0
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {delta > 0
                    ? `+${formatCurrency(delta)}`
                    : formatCurrency(delta)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">
                Expiring Term Premium
              </Label>
              <div className="mt-1 font-mono tabular-nums text-sm font-semibold text-foreground">
                {formatCurrency(prevPremium)}
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">
                Carrier Proposed Premium
              </Label>
              <div className="mt-1">
                <CurrencyInput
                  value={proposedPremium}
                  onValueChange={setProposedPremium}
                  disabled={!renewal || currentStatus === "completed"}
                  className="font-mono text-sm h-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">
                Agreed / Bound Premium
              </Label>
              <div className="mt-1">
                <CurrencyInput
                  value={agreedPremium}
                  onValueChange={setAgreedPremium}
                  disabled={!renewal || currentStatus === "completed"}
                  className="font-mono text-sm h-8"
                />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">
                Carrier Reference / Doc Key
              </Label>
              <div className="mt-1">
                <Input
                  value={carrierDocKey}
                  onChange={(e) => setCarrierDocKey(e.target.value)}
                  placeholder="e.g. QTE-2026-JAG"
                  disabled={!renewal || currentStatus === "completed"}
                  className="font-mono text-xs h-8"
                />
              </div>
            </div>
          </div>

          {renewal && currentStatus !== "completed" && (
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveFinancials}
                disabled={isPending}
                className="text-xs h-7"
              >
                Save Schedule Changes
              </Button>
            </div>
          )}
        </div>

        {/* Operational Notes */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Agent & Negotiation Notes
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Log carrier discussions, loss ratio adjustments, or client concessions..."
            rows={3}
            disabled={!renewal && false}
            className="text-xs"
          />
        </div>

        {/* Workflow Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Available State Actions
          </span>

          {!renewal ? (
            <Button
              onClick={handleInitiate}
              disabled={isPending}
              className="w-full gap-2 font-medium"
            >
              <RefreshCw
                className={cn("size-4", isPending && "animate-spin")}
              />
              Initiate Annual Renewal (Stage 1)
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              {currentStatus === "awaiting_carrier" && (
                <Button
                  onClick={() => handleTransition("carrier_received")}
                  disabled={isPending}
                  className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <FileText className="size-4" />
                  Mark Carrier Terms Received
                  <ArrowRight className="size-4 ml-auto" />
                </Button>
              )}

              {currentStatus === "carrier_received" && (
                <Button
                  onClick={() => handleTransition("client_invited")}
                  disabled={isPending}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="size-4" />
                  Issue Renewal Invitation to Client
                  <ArrowRight className="size-4 ml-auto" />
                </Button>
              )}

              {currentStatus === "client_invited" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleTransition("changes_requested")}
                    disabled={isPending}
                    className="gap-1.5 text-purple-600 border-purple-500/30 hover:bg-purple-500/10"
                  >
                    <AlertCircle className="size-3.5" />
                    Client Requests Changes
                  </Button>
                  <Button
                    onClick={() => handleTransition("paid")}
                    disabled={isPending}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CreditCard className="size-3.5" />
                    Confirm Payment Received
                  </Button>
                </div>
              )}

              {currentStatus === "changes_requested" && (
                <Button
                  onClick={() => handleTransition("client_invited")}
                  disabled={isPending}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="size-4" />
                  Re-Issue Revised Quote to Client
                  <ArrowRight className="size-4 ml-auto" />
                </Button>
              )}

              {currentStatus === "paid" && (
                <Button
                  onClick={() => handleTransition("completed")}
                  disabled={isPending}
                  className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  <CheckCircle2 className="size-4" />
                  Complete Renewal & Bind New Risk Note
                  <ArrowRight className="size-4 ml-auto" />
                </Button>
              )}

              {currentStatus === "completed" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      <span>Renewal Workflow Fully Bound & Completed</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase">
                      Active Term
                    </span>
                  </div>

                  {/* Outbound Document Packet */}
                  <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                        <FileText className="size-3.5 text-primary" />
                        Outbound Document Packet
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        Ready to Issue
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 justify-start text-xs gap-2 bg-background hover:bg-muted/80 cursor-pointer"
                        onClick={() => {
                          if (policy.active_note?.id) {
                            window.open(
                              `/print/risk-notes/${policy.active_note.id}`,
                              "_blank",
                            )
                          }
                        }}
                      >
                        <Printer className="size-3.5 text-primary" />
                        <span className="truncate">Underwriter Risk Note</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 justify-start text-xs gap-2 bg-background hover:bg-muted/80 cursor-pointer"
                        asChild
                      >
                        <Link
                          to="/clients/$clientId/invoices"
                          params={{ clientId: policy.client_id }}
                        >
                          <Receipt className="size-3.5 text-primary" />
                          <span className="truncate">
                            Client Billing Invoice
                          </span>
                        </Link>
                      </Button>
                    </div>

                    {/* Copy Client Renewal Notice */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5 border border-dashed hover:bg-muted cursor-pointer"
                      onClick={() => {
                        const msg = `Dear ${clientName || "Valued Client"},\nYour policy ${policy.policy_number} (${policy.product?.name || "Insurance"}) has been renewed for the period ${renewal.renewal_period_start} to ${renewal.renewal_period_end}.\nTotal Premium: KES ${Number(agreedPremium || proposedPremium).toLocaleString()}.\n\nThank you for choosing HealthWatch MS.`
                        navigator.clipboard.writeText(msg)
                        showSuccessToast(
                          "Client renewal confirmation copied to clipboard.",
                        )
                      }}
                    >
                      <Copy className="size-3 text-muted-foreground" />
                      Copy Client WhatsApp / SMS Notice
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="mt-auto border-t pt-4 flex flex-row items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <Link
              to="/clients/$clientId/policies/$policyId"
              params={{
                clientId: policy.client_id,
                policyId: policy.id,
              }}
            >
              View Policy
              <ExternalLink className="size-3" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>

      <AdvisoryRatingCalculator
        isOpen={ratingCalcOpen}
        onOpenChange={setRatingCalcOpen}
        initialClass={policy?.product?.class_of_insurance || "Motor Private"}
        initialSumInsured={
          Number((activeNote?.cover_snapshot as any)?.vehicle?.sum_insured) ||
          Number((activeNote?.cover_snapshot as any)?.sum_insured) ||
          2000000
        }
        onApplyCalculation={handleApplyRating}
      />
    </Sheet>
  )
}
