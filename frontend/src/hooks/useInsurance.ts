// Temporary re-export barrel while callers migrate to domain hook modules (#54, #55, #56).
export {
  useClient,
  useClients,
  useCorrespondences,
  useCreateClient,
  useCreateCorrespondence,
  useDeleteClient,
  useUpdateClient,
} from "./useClients"
export { useInvoices, useReceipts } from "./useFinancials"
export {
  useAllocatePayment,
  usePaymentAllocations,
  usePaymentRecord,
  usePaymentRecords,
  useRecordPayment,
  useReversePaymentAllocation,
  useReversePaymentRecord,
} from "./usePayments"
export {
  useActivities,
  useCreateActivity,
  useCreatePolicy,
  useCreateRiskNote,
  usePolicies,
  usePolicy,
  usePolicyDashboard,
  useProducts,
  useQuote,
  useQuoteQuery,
  useRiskNote,
  useRiskNotes,
  useUpdatePolicy,
  useUpdateRiskNote,
} from "./usePolicies"
export {
  useCreateRenewal,
  useRenewal,
  useRenewals,
  useTransitionRenewal,
  useUpdateRenewal,
} from "./useRenewals"
export {
  useCreateVehicle,
  useDeleteVehicle,
  useUpdateVehicle,
  useVehicle,
  useVehicles,
} from "./useVehicles"
