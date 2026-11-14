// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientPublic } from "@/client"
import type { EnhancedPolicy, EnhancedRiskNote } from "@/types/insurance"
import {
  PRESET_CLAUSES,
  useDocumentPreviewSession,
} from "./useDocumentPreviewSession"

const mockExportPdf = vi.fn()
const mockCreateRiskNoteRevisionMutateAsync = vi.fn()

vi.mock("@/hooks/useDocumentJobs", () => ({
  useDocumentPdfExport: () => ({
    exportPdf: mockExportPdf,
    isExporting: false,
  }),
}))

vi.mock("@/hooks/usePolicies", () => ({
  useCreateRiskNoteRevision: () => ({
    mutateAsync: mockCreateRiskNoteRevisionMutateAsync,
    isPending: false,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const baseClient = {
  id: "client-1",
  name: "Acme Logistics Ltd",
  kra_pin: "P051234567A",
} as ClientPublic

const basePolicy = {
  id: "policy-1",
  policy_number: "POL-2026-001",
  product: {
    name: "Motor Commercial",
    class_of_insurance: "Motor",
  },
} as unknown as EnhancedPolicy

const baseRiskNote = {
  id: "rn-1",
  risk_note_number: "RN-2026-001",
  status: "Draft",
  coverage_start: "2026-01-01",
  coverage_end: "2026-12-31",
  net_premium: 50000,
  cover_snapshot: {
    vehicle: {
      registration_number: "KDA 123A",
      chassis_number: "VIN123456",
      sum_insured: 1500000,
    },
  },
} as unknown as EnhancedRiskNote

describe("useDocumentPreviewSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("initializes specialConditions from riskNote.cover_snapshot or default warranties and defaults includeDigitalStamp to true", () => {
    const { result: defaultResult } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: basePolicy,
      }),
    )

    expect(defaultResult.current.includeDigitalStamp).toBe(true)
    expect(defaultResult.current.specialConditions).toContain(
      "Standard Policy Warranties",
    )
    expect(defaultResult.current.draftSnapshot).toEqual({
      include_digital_stamp: true,
      special_conditions: defaultResult.current.specialConditions,
    })

    const customRiskNote = {
      ...baseRiskNote,
      cover_snapshot: {
        ...baseRiskNote.cover_snapshot,
        special_conditions: "Custom endorsement text",
      },
    } as unknown as EnhancedRiskNote

    const { result: customResult } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: customRiskNote,
        client: baseClient,
        policy: basePolicy,
      }),
    )

    expect(customResult.current.specialConditions).toBe(
      "Custom endorsement text",
    )
  })

  it("inserts preset clauses and toggles includeDigitalStamp in draftSnapshot", () => {
    const { result } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: basePolicy,
      }),
    )

    act(() => {
      result.current.setSpecialConditions("")
    })
    act(() => {
      result.current.handleInsertClause(PRESET_CLAUSES[0].snippet)
    })

    expect(result.current.specialConditions).toBe(PRESET_CLAUSES[0].snippet)

    act(() => {
      result.current.handleInsertClause(PRESET_CLAUSES[1].snippet)
      result.current.setIncludeDigitalStamp(false)
    })

    expect(result.current.specialConditions).toBe(
      `${PRESET_CLAUSES[0].snippet}\n\n${PRESET_CLAUSES[1].snippet}`,
    )
    expect(result.current.draftSnapshot).toEqual({
      include_digital_stamp: false,
      special_conditions: `${PRESET_CLAUSES[0].snippet}\n\n${PRESET_CLAUSES[1].snippet}`,
    })
  })

  it("persists specialConditions to RiskNote via handleSaveClauses", async () => {
    mockCreateRiskNoteRevisionMutateAsync.mockResolvedValueOnce({})

    const { result } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: basePolicy,
      }),
    )

    act(() => {
      result.current.setSpecialConditions("Updated warranty")
    })

    await act(async () => {
      await result.current.handleSaveClauses()
    })

    expect(mockCreateRiskNoteRevisionMutateAsync).toHaveBeenCalledWith({
      id: "rn-1",
      data: {
        special_clauses: ["Updated warranty"],
        cover_snapshot: {
          ...baseRiskNote.cover_snapshot,
          special_conditions: "Updated warranty",
        },
      },
    })
  })

  it("delegates PDF export to useDocumentPdfExport with snapshot_data", async () => {
    mockExportPdf.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: basePolicy,
      }),
    )

    await act(async () => {
      await result.current.handleGenerateServerPdf()
    })

    expect(mockExportPdf).toHaveBeenCalledWith({
      resource_type: "risk_note",
      resource_id: "rn-1",
      snapshot_data: {
        include_digital_stamp: true,
        special_conditions: result.current.specialConditions,
      },
    })
    expect(result.current.isGeneratingPdf).toBe(false)
  })

  it("validates completeness of client, riskNote, and motor fields", () => {
    const { result: validResult } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: baseRiskNote,
        client: baseClient,
        policy: basePolicy,
      }),
    )
    expect(validResult.current.validation).toEqual({
      isValid: true,
      missingFields: [],
    })

    const { result: nullResult } = renderHook(() =>
      useDocumentPreviewSession({
        riskNote: null,
        client: baseClient,
        policy: basePolicy,
      }),
    )
    expect(nullResult.current.validation).toEqual({
      isValid: false,
      missingFields: ["Risk Note Record"],
    })
  })

  it("supports invoice targets with read-only preview and async PDF export", async () => {
    const { result } = renderHook(() =>
      useDocumentPreviewSession({
        target: {
          kind: "invoice",
          invoiceId: "inv-1",
          invoiceNumber: "INV-2026-001",
        },
      }),
    )

    expect(result.current.validation).toEqual({
      isValid: true,
      missingFields: [],
    })
    expect(result.current.draftSnapshot).toBeUndefined()

    await act(async () => {
      await result.current.handleGenerateServerPdf()
    })

    expect(mockExportPdf).toHaveBeenCalledWith({
      resource_type: "invoice",
      resource_id: "inv-1",
    })
  })
})
