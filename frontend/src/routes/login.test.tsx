// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Route } from "./login"

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  )
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode
      to: string
      [key: string]: unknown
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock("@/hooks/useAuth", () => ({
  default: () => ({
    loginMutation: {
      mutate: vi.fn(),
      isPending: false,
    },
  }),
  isLoggedIn: () => false,
}))

describe("Login route", () => {
  it("sets the document title to 'Log In - HealthWatch MS'", async () => {
    const head = await Route.options.head?.({} as never)
    expect(head?.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Log In - HealthWatch MS" }),
      ]),
    )
  })

  it("does not render a public Sign up link", () => {
    const LoginComponent = Route.options.component
    expect(LoginComponent).toBeDefined()
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        {LoginComponent ? <LoginComponent /> : null}
      </QueryClientProvider>,
    )

    expect(screen.queryByRole("link", { name: /sign up/i })).toBeNull()
    expect(screen.queryByText(/don't have an account/i)).toBeNull()
  })
})
