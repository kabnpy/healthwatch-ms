import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Copy,
  Edit,
  ExternalLink,
  MoreHorizontal,
  ReceiptText,
} from "lucide-react"
import { toast } from "sonner"

import type { ClientPublic } from "@/client"
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

export type ClientRow = ClientPublic & {
  activePoliciesCount: number
}

export const columns: ColumnDef<ClientRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        to="/clients/$clientId/overview"
        params={{ clientId: row.original.id }}
        className="font-medium hover:underline text-primary flex items-center gap-2"
      >
        {row.original.name}
        <ExternalLink className="size-3 opacity-50" />
      </Link>
    ),
  },
  {
    accessorKey: "client_type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.client_type}</Badge>
    ),
  },
  {
    accessorKey: "kra_pin",
    header: "KRA PIN",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.kra_pin}</span>
    ),
  },
  {
    accessorKey: "activePoliciesCount",
    header: "Active Policies",
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">
        {row.original.activePoliciesCount}
      </span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) =>
      row.original.email || (
        <span className="text-muted-foreground italic text-xs">N/A</span>
      ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const client = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(client.id)
                toast.success("Client ID copied to clipboard")
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  to="/clients/$clientId/overview"
                  params={{ clientId: client.id }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Hub
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  to="/clients/$clientId/invoices"
                  params={{ clientId: client.id }}
                >
                  <ReceiptText className="mr-2 h-4 w-4" />
                  View Invoices
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  to="/clients/$clientId/settings"
                  params={{ clientId: client.id }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </Link>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
