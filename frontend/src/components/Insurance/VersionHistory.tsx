import { format, parseISO } from "date-fns"
import { Clock, Eye, Info } from "lucide-react"
import type { RiskNotePublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/utils"

interface VersionHistoryProps {
  riskNotes: RiskNotePublic[]
  onView: (riskNote: RiskNotePublic) => void
}

export function VersionHistory({ riskNotes, onView }: VersionHistoryProps) {
  if (!riskNotes || riskNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/10 border-2 border-dashed rounded-xl">
        <Clock className="size-8 text-muted-foreground mb-4 opacity-50" />
        <p className="text-muted-foreground italic">
          No transaction history found.
        </p>
      </div>
    )
  }

  // Sort notes by date descending
  const sortedNotes = [...riskNotes].sort((a, b) => {
    const dateA = new Date(a.effective_date || a.created_at || 0).getTime()
    const dateB = new Date(b.effective_date || b.created_at || 0).getTime()
    return dateB - dateA
  })

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
      {sortedNotes.map((note, index) => {
        const isLatest = index === 0
        const isDraft = note.status === "Draft"
        const noteDate = note.effective_date
          ? parseISO(note.effective_date)
          : new Date(note.created_at || 0)

        return (
          <div
            key={note.id}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            {/* Dot */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-200 group-[.is-active]:bg-primary text-slate-500 group-[.is-active]:text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <Clock className="size-4" />
            </div>

            {/* Content */}
            <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <time className="font-mono text-xs font-bold text-slate-500">
                        {format(noteDate, "dd MMM yyyy")}
                      </time>
                      {isLatest && !isDraft && (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none h-5 px-1.5 text-[10px] uppercase font-black">
                          Active Version
                        </Badge>
                      )}
                      {isDraft && (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-200 bg-amber-50 h-5 px-1.5 text-[10px] uppercase font-black"
                        >
                          Draft
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">
                      #{note.risk_note_number || "DRAFT"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                      {note.transaction_type}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                      {note.special_clauses?.[0] || "No description provided."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 bg-slate-50/50 rounded-sm px-2">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Net Premium
                      </p>
                      <p className="text-xs font-mono font-bold text-slate-700">
                        {formatCurrency(note.net_premium)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Total Amount
                      </p>
                      <p className="text-xs font-mono font-bold text-primary">
                        {formatCurrency(note.total_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Info className="size-3" />
                      <span>{note.status}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-2 text-xs font-bold text-primary hover:text-primary hover:bg-primary/5"
                      onClick={() => onView(note)}
                    >
                      <Eye className="size-3" />
                      View Snapshot
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
