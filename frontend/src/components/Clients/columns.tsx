import type { ColumnDef } from "@tanstack/react-table"
import type { ClientPublic } from "@/client"

export const columns: ColumnDef<ClientPublic>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.getValue("phone") || "N/A",
  },
  {
    accessorKey: "town",
    header: "Town",
    cell: ({ row }) => row.getValue("town") || "N/A",
  },
  {
    id: "actions",
    header: "Actions",
    cell: () => null, // We'll add actions later
  },
]
