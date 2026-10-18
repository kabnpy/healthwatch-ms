import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  FinancialsService,
  type InvoiceBulkCreate,
  type ReceiptAllocationCreate,
  type ReceiptCreate,
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

// 2. RECEIPTS (Payments)
export const useReceipts = (clientId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["receipts", { clientId, skip, limit }],
    queryFn: async () =>
      (
        await FinancialsService.readReceipts({
          query: { client_id: clientId, skip, limit },
        })
      ).data,
  })
}

export const useReceipt = (id: string) => {
  return useQuery({
    queryKey: ["receipts", id],
    queryFn: async () =>
      (await FinancialsService.readReceiptById({ path: { id } })).data,
    enabled: !!id,
  })
}

export const useCreateReceipt = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ReceiptCreate) =>
      (await FinancialsService.createNewReceipt({ body: data })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
  })
}

export const useVoidReceipt = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await FinancialsService.deleteReceipt({ path: { id } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Receipt voided and balances reversed")
    },
  })
}

// 3. ALLOCATIONS
export const useAllocateReceipt = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: ReceiptAllocationCreate
    }) =>
      (await FinancialsService.allocateReceipt({ path: { id }, body: data }))
        .data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] })
      queryClient.invalidateQueries({ queryKey: ["receipts", id] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
  })
}

// 4. FINANCIAL SUMMARY (Aggregator)
export const useFinancialSummary = (clientId?: string) => {
  const invoicesQuery = useInvoices(clientId)
  const receiptsQuery = useReceipts(clientId)

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
    receipts: receiptsQuery.data?.data || [],
    summary: {
      totalInvoiced,
      totalPaid,
      totalDue,
    },
    isLoading: invoicesQuery.isLoading || receiptsQuery.isLoading,
  }
}
