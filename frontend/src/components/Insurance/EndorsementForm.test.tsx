// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EndorsementForm } from "./EndorsementForm"

const mockMutate = vi.fn()
const mockShowSuccessToast = vi.fn()
const mockShowErrorToast = vi.fn()

vi.mock("@/hooks/useCustomToast", () => ({
  default: () => ({
    showSuccessToast: mockShowSuccessToast,
    showErrorToast: mockShowErrorToast,
  }),
}))

const mockPolicyData = {
  id: "policy-123",
  policy_number: "POL-2026-001",
  active_note: {
    cover_snapshot: {
      registration_number: "KCA 100A",
      sum_insured: 2000000,
    },
  },
  product: {
    id: "prod-1",
    class_of_insurance: "Motor Private",
    product_details: [
      {
        key: "registration_number",
        label: "Registration Number",
        type: "text",
        field_type: "input",
      },
      {
        key: "sum_insured",
        label: "Sum Insured",
        type: "number",
        field_type: "input",
      },
    ],
  },
}

vi.mock("@/hooks/usePolicies", () => ({
  usePolicy: () => ({
    isLoading: false,
    data: mockPolicyData,
  }),
  useCreateEndorsement: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

describe("EndorsementForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders only endorsement fields and submits EndorsementCreate payload", async () => {
    const onSuccess = vi.fn()
    render(<EndorsementForm policyId="policy-123" onSuccess={onSuccess} />)

    expect(screen.queryByText(/Transaction Type/i)).toBeNull()
    expect(screen.queryByText(/Coverage End/i)).toBeNull()
    expect(screen.queryByText(/Net Premium/i)).toBeNull()
    expect(screen.queryByText(/Commission/i)).toBeNull()

    const effectiveDateInput = screen.getByLabelText(/Effective Date/i)
    fireEvent.change(effectiveDateInput, { target: { value: "2026-12-15" } })

    const descriptionInput = screen.getByLabelText(/Change Description/i)
    fireEvent.change(descriptionInput, {
      target: { value: "Updated vehicle registration" },
    })

    const regInput = screen.getByLabelText(/Registration Number/i)
    fireEvent.change(regInput, { target: { value: "KDB 999Z" } })

    fireEvent.click(screen.getByRole("button", { name: /Submit Endorsement/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1)
    })

    expect(mockMutate).toHaveBeenCalledWith(
      {
        policyId: "policy-123",
        data: {
          effective_date: "2026-12-15",
          change_description: "Updated vehicle registration",
          updated_risk_details: {
            registration_number: "KDB 999Z",
            sum_insured: 2000000,
          },
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })
})
