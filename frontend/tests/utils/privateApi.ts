// Note: the `PrivateService` is only available when generating the client
// for local environments
import { client, PrivateService } from "../../src/client"

client.setConfig({
  baseURL: process.env.VITE_API_URL || "http://localhost:8000",
})

export const createUser = async ({
  email,
  password,
}: {
  email: string
  password: string
}) => {
  const response = await PrivateService.createUser({
    body: {
      email,
      password,
      is_verified: true,
      full_name: "Test User",
    },
  })
  return response.data
}
