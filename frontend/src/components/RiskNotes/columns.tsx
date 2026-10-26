import type { ColumnDef } from "@tanstack/react-table"
import { Copy, Eye, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import type { RiskNotePublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/utils"

export const getColumns = (
  onView: (riskNote: RiskNotePublic) => void,
): ColumnDef<RiskNotePublic>[] => [
  {
    accessorKey: "risk_note_number",
    header: "Risk Note #",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onView(row.original)}
        className="font-mono text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1.5"
      >
        <span>{row.original.risk_note_number || "DRAFT"}</span>
      </button>
    ),
  },
  {
    accessorKey: "transaction_type",
    header: "Transaction",
    cell: ({ row }) => {
      const type = row.original.transaction_type || "Cover Note"
      return (
        <span className="text-xs font-medium uppercase tracking-wide">
          {type}
        </span>
      )
    },
  },
  {
    id: "coverage_period",
    header: "Coverage Term",
    cell: ({ row }) => {
      const start = row.original.coverage_start
      const end = row.original.coverage_end
      if (!start && !end) {
        return <span className="text-xs text-muted-foreground">—</span>
      }
      return (
        <div className="flex flex-col text-xs font-mono">
          <span>{start || "—"}</span>
          <span className="text-[10px] text-muted-foreground">
            to {end || "—"}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "net_premium",
    header: () => <span className="block text-right">Net Premium</span>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs font-medium tabular-nums">
        {formatCurrency(row.original.net_premium)}
      </div>
    ),
  },
  {
    accessorKey: "total_amount",
    header: () => <span className="block text-right">Total Payable</span>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-xs font-bold text-foreground tabular-nums">
        {formatCurrency(row.original.total_amount)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status || "Final"
      const isDraft = status.toLowerCase() === "draft"
      return (
        <Badge
          variant="outline"
          className={
            isDraft
              ? "text-amber-600 border-amber-500/30 text-[11px]"
              : "text-emerald-600 border-emerald-500/30 text-[11px]"
          }
        >
          {status}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const riskNote = row.original

      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onView(riskNote)}
            className="h-8 text-xs gap-1.5 px-2.5 cursor-pointer font-medium"
          >
            <Eye className="size-3.5" />
            <span>View</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(
                    riskNote.risk_note_number || riskNote.id,
                  )
                  toast.success("Copied to clipboard")
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Risk Note Ref
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onView(riskNote)}>
                <Eye className="mr-2 h-4 w-4" />
                View Schedule Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
