import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FinancialsService, type InvoiceBulkCreate } from "../client"

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

// 2. FINANCIAL SUMMARY (Server-side Decimal KPIs)
export const useFinancialSummary = (clientId?: string) => {
  const summaryQuery = useQuery({
    queryKey: ["financial-summary", { clientId }],
    queryFn: async () =>
      (
        await FinancialsService.readFinancialSummary({
          query: clientId ? { client_id: clientId } : undefined,
        })
      ).data,
  })

  const data = summaryQuery.data

  return {
    summary: {
      totalInvoiced: Number(data?.total_invoiced ?? 0),
      totalPaid: Number(data?.total_paid ?? 0),
      totalDue: Number(data?.total_due ?? 0),
      totalUnallocated: Number(data?.total_unallocated ?? 0),
    },
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    refetch: summaryQuery.refetch,
  }
}
