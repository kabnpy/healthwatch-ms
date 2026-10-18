import { FileText, Shield } from "lucide-react"
import type { RiskNotePublic } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPolicyDisplayName } from "@/utils/insurance"

interface CoverageCardProps {
  riskNote?: RiskNotePublic
  onViewBreakdown: (riskNote: RiskNotePublic) => void
}

export function CoverageCard({ riskNote, onViewBreakdown }: CoverageCardProps) {
  if (!riskNote) {
    return (
      <Card className="h-full border-dashed bg-muted/40">
        <CardContent className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
          <Shield className="size-12 mb-4 opacity-50" />
          <p>No Active Coverage Found</p>
        </CardContent>
      </Card>
    )
  }

  const displayName = riskNote.policy
    ? getPolicyDisplayName(riskNote.policy)
    : "Coverage"

  return (
    <Card className="h-full border-l-4 border-l-green-600 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {displayName}
        </CardTitle>
        <Shield className="size-4 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-2xl font-bold">
              KES{" "}
              {Number(riskNote.total_amount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-tighter">
              {riskNote.status} • Total Amount
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs uppercase">
                Start Date
              </span>
              <span className="font-semibold">
                {riskNote.coverage_start || (riskNote as any).start_date}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs uppercase">
                End Date
              </span>
              <span className="font-semibold">
                {riskNote.coverage_end || (riskNote as any).end_date}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => onViewBreakdown(riskNote)}
            >
              <FileText className="size-4" />
              View Breakdown
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
