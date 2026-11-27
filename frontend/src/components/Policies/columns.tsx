import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  ReceiptText,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import type { PolicyPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { getPolicyDisplayName } from "@/utils/insurance"

export const columns: ColumnDef<PolicyPublic>[] = [
  {
    id: "display_name",
    header: "Policy",
    cell: ({ row }) => {
      const displayName = getPolicyDisplayName(row.original)
      return (
        <Link
          to="/clients/$clientId/policies/$policyId"
          params={{
            clientId: row.original.client_id,
            policyId: row.original.id,
          }}
          className="font-medium hover:underline text-primary flex items-center gap-2"
        >
          {displayName}
          <ExternalLink className="size-3 opacity-50" />
        </Link>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status?.toLowerCase()
      return (
        <Badge
          variant={
            s === "active"
              ? "active"
              : s === "lapsed"
                ? "lapsed"
                : s === "pending"
                  ? "pending"
                  : "draft"
          }
        >
          {row.original.status}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const policy = row.original

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
            <DropdownMenuLabel>Policy Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(policy.id)
                toast.success("Policy ID copied to clipboard")
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  to="/clients/$clientId/policies/$policyId"
                  params={{
                    clientId: policy.client_id,
                    policyId: policy.id,
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Dashboard
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  to="/clients/$clientId/policies/$policyId"
                  params={{
                    clientId: policy.client_id,
                    policyId: policy.id,
                  }}
                  hash="risk-notes"
                >
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Risk Notes
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  to="/clients/$clientId/policies/$policyId"
                  params={{
                    clientId: policy.client_id,
                    policyId: policy.id,
                  }}
                  hash="certificates"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Certificates
                </Link>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
