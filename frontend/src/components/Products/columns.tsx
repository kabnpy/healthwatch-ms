import type { ColumnDef } from "@tanstack/react-table"
import { Link } from "@tanstack/react-router"

import type { ProductPublic } from "@/client"
import { ProductActionsMenu } from "./ProductActionsMenu"

export type ProductRow = ProductPublic & {
  insurerName?: string
}

export const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: "name",
    header: "Product Name",
    cell: ({ row }) => (
      <Link
        to="/catalog/products/$productId"
        params={{ productId: row.original.id }}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "insurerName",
    header: "Insurer",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.insurerName || "—"}
      </span>
    ),
  },
  {
    accessorKey: "class_of_insurance",
    header: "Class",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.class_of_insurance}
      </span>
    ),
  },
  {
    accessorKey: "default_commission_rate",
    header: "Comm. %",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.default_commission_rate}%
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ProductActionsMenu product={row.original} />
      </div>
    ),
  },
]
