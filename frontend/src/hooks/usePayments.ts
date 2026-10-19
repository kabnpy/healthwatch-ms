import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  type PaymentAllocationCreate,
  PaymentAllocationsService,
  type PaymentRecordCreate,
  PaymentRecordsService,
  type ReversalCreate,
} from "../client"

export const usePaymentRecords = (clientId?: string, skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["payment-records", { clientId, skip, limit }],
    queryFn: async () =>
      (
        await PaymentRecordsService.recordsReadPaymentRecords({
          query: { client_id: clientId, skip, limit },
        })
      ).data,
  })
}

export const usePaymentRecord = (id: string) => {
  return useQuery({
    queryKey: ["payment-records", id],
    queryFn: async () =>
      (await PaymentRecordsService.recordsReadPaymentRecord({ path: { id } }))
        .data,
    enabled: !!id,
  })
}

export const usePaymentAllocationsForRecord = (
  id: string,
  skip = 0,
  limit = 100,
) => {
  return useQuery({
    queryKey: ["payment-records", id, "allocations", { skip, limit }],
    queryFn: async () =>
      (
        await PaymentRecordsService.recordsReadPaymentAllocationsForRecord({
          path: { id },
          query: { skip, limit },
        })
      ).data,
    enabled: !!id,
  })
}

export const usePaymentAllocations = (
  paymentRecordId?: string,
  invoiceId?: string,
  skip = 0,
  limit = 100,
) => {
  return useQuery({
    queryKey: [
      "payment-allocations",
      { paymentRecordId, invoiceId, skip, limit },
    ],
    queryFn: async () =>
      (
        await PaymentAllocationsService.allocationsReadPaymentAllocations({
          query: {
            payment_record_id: paymentRecordId,
            invoice_id: invoiceId,
            skip,
            limit,
          },
        })
      ).data,
  })
}

export const useCreatePaymentRecord = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: PaymentRecordCreate) =>
      (await PaymentRecordsService.recordsCreatePaymentRecord({ body: data }))
        .data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-records"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Payment recorded successfully")
    },
    onError: (error: any) => {
      toast.error(error?.detail || "Failed to record payment")
    },
  })
}

export const useAllocatePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: PaymentAllocationCreate
    }) =>
      (
        await PaymentRecordsService.recordsAllocatePaymentToInvoice({
          path: { id },
          body: data,
        })
      ).data,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["payment-records"] })
      queryClient.invalidateQueries({ queryKey: ["payment-records", id] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Payment allocated to invoice")
    },
    onError: (error: any) => {
      toast.error(error?.detail || "Failed to allocate payment")
    },
  })
}

export const useReversePaymentRecord = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReversalCreate }) =>
      (
        await PaymentRecordsService.recordsReversePaymentRecord({
          path: { id },
          body: data,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-records"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Payment reversed and allocations rolled back")
    },
    onError: (error: any) => {
      toast.error(error?.detail || "Failed to reverse payment")
    },
  })
}

export const useReversePaymentAllocation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReversalCreate }) =>
      (
        await PaymentAllocationsService.allocationsReversePaymentAllocation({
          path: { id },
          body: data,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-records"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Allocation reversed and invoice balance restored")
    },
    onError: (error: any) => {
      toast.error(error?.detail || "Failed to reverse allocation")
    },
  })
}
