import { useQuery } from "@tanstack/react-query"
import { DashboardService } from "@/client"

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const response = await DashboardService.readDashboardSummary()
      return response.data
    },
  })
}
