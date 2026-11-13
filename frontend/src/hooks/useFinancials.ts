import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  FinancialsService,
  type InvoiceBulkCreate,
} from "../client"

// 1. INVOICES
export const useInvoices = (clientId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["invoices", { clientId, skip, limit }],
    queryFn: async () =>
      (
        await FinancialsService.readInvoices({
          query: { client_id: clientId, skip, limit },
        })
      ).data,
  })
}

export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () =>
      (await FinancialsService.readInvoice({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateBulkInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: InvoiceBulkCreate) =>
      (await FinancialsService.createBulkInvoice({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["risk-notes"] })
      toast.success("Invoice generated successfully")
    },
    onError: (error: any) => {
      toast.error(error.detail || "Failed to generate invoice")
    },
  })
}

// 2. FINANCIAL SUMMARY (Aggregator)
export const useFinancialSummary = (clientId?: string) => {
  const invoicesQuery = useInvoices(clientId)

  const invoices = invoicesQuery.data?.data || []
  const totalInvoiced = invoices.reduce(
    (sum, inv) => sum + Number(inv.total_amount || 0),
    0,
  )
  const totalDue = invoices.reduce(
    (sum, inv) => sum + Number(inv.balance_due || 0),
    0,
  )
  const totalPaid = totalInvoiced - totalDue

  return {
    invoices,
    summary: {
      totalInvoiced,
      totalPaid,
      totalDue,
    },
    isLoading: invoicesQuery.isLoading,
  }
}
