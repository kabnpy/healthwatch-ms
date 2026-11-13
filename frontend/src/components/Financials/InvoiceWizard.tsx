import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { DataTable } from "@/components/Common/DataTable"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreateBulkInvoice } from "@/hooks/useFinancials"
import { useRiskNotes } from "@/hooks/usePolicies"
import { getPolicyDisplayName } from "@/utils"

interface InvoiceWizardProps {
  clientId: string
  isOpen: boolean
  onClose: () => void
}

export function InvoiceWizard({
  clientId,
  isOpen,
  onClose,
}: InvoiceWizardProps) {
  const { data: riskNotesData, isLoading } = useRiskNotes(
    undefined,
    0,
    100,
    clientId,
    true, // uninvoicedOnly
  )
  const createBulkInvoice = useCreateBulkInvoice()
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const pendingNotes = riskNotesData?.data || []

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const selectedCount = Object.values(selectedIds).filter(Boolean).length
  const totalAmount = useMemo(() => {
    return pendingNotes
      .filter((n) => selectedIds[n.id])
      .reduce((sum, n) => sum + Number(n.total_amount || 0), 0)
  }, [pendingNotes, selectedIds])

  const handleGenerate = async () => {
    const ids = Object.entries(selectedIds)
      .filter(([_, selected]) => selected)
      .map(([id]) => id)

    if (ids.length === 0) return

    try {
      await createBulkInvoice.mutateAsync({
        client_id: clientId,
        risk_note_ids: ids,
        date_issued: new Date().toISOString().split("T")[0],
      })
      onClose()
      setSelectedIds({})
    } catch (_error) {
      // Error handled by hook
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      id: "select",
      header: "Select",
      cell: ({ row }) => (
        <Checkbox
          checked={!!selectedIds[row.original.id]}
          onCheckedChange={() => toggleSelect(row.original.id)}
        />
      ),
    },
    {
      accessorKey: "display_name",
      header: "Policy / Cover",
      cell: ({ row }) => getPolicyDisplayName(row.original),
    },
    {
      accessorKey: "transaction_type",
      header: "Type",
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-mono">
          KES {(row.original.total_amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "start_date",
      header: "Period Start",
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Select the policies/risk notes you want to include in this invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <p className="text-center py-8">Loading pending items...</p>
          ) : pendingNotes.length === 0 ? (
            <div className="text-center py-8 border rounded-md bg-muted/20">
              <p className="text-muted-foreground">
                No pending items to invoice for this client.
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <DataTable
                columns={columns}
                data={pendingNotes}
                searchPlaceholder="Search pending items..."
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full border-t pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground font-medium">Selected:</span>{" "}
            <span className="font-bold">{selectedCount} items</span>
            <span className="mx-2 text-muted-foreground">|</span>
            <span className="text-muted-foreground font-medium">Total:</span>{" "}
            <span className="font-bold text-primary">
              KES {totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={selectedCount === 0 || createBulkInvoice.isPending}
              className="min-w-[120px]"
            >
              {createBulkInvoice.isPending
                ? "Generating..."
                : "Generate Invoice"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
