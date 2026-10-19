import { useQuery } from "@tanstack/react-query"
import { InvoiceBatchesService, StatementsService } from "../client"

export interface StatementLedgerEntry {
  date: string
  type: "INVOICE" | "PAYMENT_ALLOCATION"
  reference: string
  description: string
  debit: string
  credit: string
  status: string
}

export interface ClientStatementResponse {
  client_id: string
  client_name: string
  kra_pin: string
  total_invoiced: string
  total_allocated: string
  net_outstanding_balance: string
  invoice_count: number
  allocation_count: number
  ledger_entries: StatementLedgerEntry[]
}

export const useClientStatement = (clientId: string) => {
  return useQuery({
    queryKey: ["client-statement", clientId],
    queryFn: async () => {
      const res = await StatementsService.getClientStatement({
        path: { client_id: clientId },
      })
      return res.data as ClientStatementResponse
    },
    enabled: !!clientId,
  })
}

export const useInvoiceBatches = (skip = 0, limit = 50) => {
  return useQuery({
    queryKey: ["invoice-batches", { skip, limit }],
    queryFn: async () =>
      (
        await InvoiceBatchesService.batchesReadInvoiceBatches({
          query: { skip, limit },
        })
      ).data,
  })
}
