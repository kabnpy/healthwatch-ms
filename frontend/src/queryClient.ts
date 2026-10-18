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
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})
