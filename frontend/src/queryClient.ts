import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import axios from "axios"

const handleApiError = (error: Error) => {
  if (
    axios.isAxiosError(error) &&
    error.response &&
    [401, 403].includes(error.response.status)
  ) {
    localStorage.removeItem("access_token")
    window.location.href = "/login"
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes fresh cache
      gcTime: 1000 * 60 * 10, // 10 minutes cache retention
      retry: 1, // Avoid stalling with multi-attempt exponential backoff
      refetchOnWindowFocus: false, // Prevent distracting UI flickers
    },
  },
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})
