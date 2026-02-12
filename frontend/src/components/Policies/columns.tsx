import type { ColumnDef } from "@tanstack/react-table"
import type { PolicyPublic } from "@/client"
import { Badge } from "@/components/ui/badge"

export const columns: ColumnDef<PolicyPublic>[] = [
  {
    accessorKey: "policy_number",
    header: "Policy #",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("policy_number")}</div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "provider",
    header: "Provider",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={status === "Active" ? "default" : "secondary"}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "start_date",
    header: "Start Date",
  },
]
