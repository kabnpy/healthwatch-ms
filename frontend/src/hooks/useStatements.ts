import { useQuery } from "@tanstack/react-query"
import { InvoiceBatchesService, StatementsService } from "../client"

export const useClientStatement = (clientId: string) => {
  return useQuery({
    queryKey: ["client-statement", clientId],
    queryFn: async () => {
      const res = await StatementsService.getClientStatement({
        path: { client_id: clientId },
      })
      return res.data
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
