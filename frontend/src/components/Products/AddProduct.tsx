import { Plus } from "lucide-react"
import { useState } from "react"

import type { ApiError, ProductCreate } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useCreateProduct } from "@/hooks/useCatalog"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { ProductForm } from "./ProductForm"

interface AddProductProps {
  fixedInsurerId?: string
}

export const AddProduct = ({ fixedInsurerId }: AddProductProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const createProduct = useCreateProduct()

  const onSubmit = (data: ProductCreate) => {
    createProduct.mutate(data, {
      onSuccess: () => {
        showSuccessToast("Product created successfully")
        setIsOpen(false)
      },
      onError: (err: Error) => {
        handleError.call(showErrorToast, err as ApiError)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="size-4" />
            Add Product
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Define a new insurance product and its default commission.
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          onSubmit={onSubmit as any}
          onCancel={() => setIsOpen(false)}
          isLoading={createProduct.isPending}
          fixedInsurerId={fixedInsurerId}
        />
      </DialogContent>
    </Dialog>
  )
}
