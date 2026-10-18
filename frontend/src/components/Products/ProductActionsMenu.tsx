import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { EllipsisVertical, Eye, Trash2 } from "lucide-react"
import { useState } from "react"
import type { ProductPublic } from "@/client"
import { ProductsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface ProductActionsMenuProps {
  product: ProductPublic
}

export const ProductActionsMenu = ({ product }: ProductActionsMenuProps) => {
  const [open, setOpen] = useState(false)
  const qClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const deleteMutation = useMutation({
    mutationFn: () =>
      ProductsService.deleteProduct({ path: { id: product.id } }),
    onSuccess: () => {
      showSuccessToast("Product deleted successfully")
      qClient.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (err: any) => handleError.bind(showErrorToast)(err),
  })

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            to="/catalog/products/$productId"
            params={{ productId: product.id }}
          >
            <Eye className="mr-2 h-4 w-4" />
            Edit & Schema
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            if (
              window.confirm("Are you sure you want to delete this product?")
            ) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
