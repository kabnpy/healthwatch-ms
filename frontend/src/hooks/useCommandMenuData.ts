import { useQuery } from "@tanstack/react-query"
import {
  ClientsService,
  DashboardService,
  FinancialsService,
  PaymentRecordsService,
  PoliciesService,
} from "@/client"

/**
 * Loads command-palette datasets only when the palette is open (`enabled: open`),
 * sourcing expiring policies from the server-side dashboard summary seam.
 */
export function useCommandMenuData(open: boolean) {
  const clientsQuery = useQuery({
    queryKey: ["clients", { skip: 0, limit: 50 }],
    queryFn: async () =>
      (await ClientsService.readClients({ query: { skip: 0, limit: 50 } }))
        .data,
    enabled: open,
  })

  const policiesQuery = useQuery({
    queryKey: ["policies", { clientId: undefined, skip: 0, limit: 100 }],
    queryFn: async () =>
      (
        await PoliciesService.readPolicies({
          query: { client_id: undefined, skip: 0, limit: 100 },
        })
      ).data,
    enabled: open,
  })

  const invoicesQuery = useQuery({
    queryKey: ["invoices", { clientId: undefined, skip: 0, limit: 50 }],
    queryFn: async () =>
      (
        await FinancialsService.readInvoices({
          query: { client_id: undefined, skip: 0, limit: 50 },
        })
      ).data,
    enabled: open,
  })

  const paymentsQuery = useQuery({
    queryKey: ["payment-records", { clientId: undefined, skip: 0, limit: 50 }],
    queryFn: async () =>
      (
        await PaymentRecordsService.recordsReadPaymentRecords({
          query: { client_id: undefined, skip: 0, limit: 50 },
        })
      ).data,
    enabled: open,
  })

  const dashboardSummaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => (await DashboardService.readDashboardSummary()).data,
    enabled: open,
  })

  return {
    clients: clientsQuery.data?.data ?? [],
    policies: policiesQuery.data?.data ?? [],
    invoices: invoicesQuery.data?.data ?? [],
    payments: paymentsQuery.data?.data ?? [],
    expiringPolicies: dashboardSummaryQuery.data?.expiring_30 ?? [],
  }
}
