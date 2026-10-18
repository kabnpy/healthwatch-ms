import type { ColumnDef } from "@tanstack/react-table"
import { Copy, Eye, FileDown, Mail, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import type { RiskNotePublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getPolicyDisplayName } from "@/utils/insurance"

export const getColumns = (
  onView: (riskNote: RiskNotePublic) => void,
): ColumnDef<RiskNotePublic>[] => [
  {
    id: "display_name",
    header: "Policy / Cover",
    cell: ({ row }) => {
      const displayName = row.original.policy
        ? getPolicyDisplayName(row.original.policy)
        : "Cover"
      return <span className="font-medium text-foreground">{displayName}</span>
    },
  },
  {
    accessorKey: "risk_note_number",
    header: "Risk Note #",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onView(row.original)}
        className="font-mono font-medium text-primary hover:underline"
      >
        {row.original.risk_note_number || "Draft"}
      </button>
    ),
  },
  {
    accessorKey: "transaction_type",
    header: "Type",
  },
  {
    accessorKey: "coverage_start",
    header: "Start Date",
  },
  {
    accessorKey: "total_amount",
    header: "Total Amount",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span className="font-bold">
            KES{" "}
            {Number(row.original.total_amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
          <span className="text-[10px] uppercase text-muted-foreground">
            {row.original.status}
          </span>
        </div>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const riskNote = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(riskNote.id)
                toast.success("ID copied to clipboard")
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView(riskNote)}>
              <Eye className="mr-2 h-4 w-4" />
              View Document
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Mail className="mr-2 h-4 w-4" />
              Email to Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
