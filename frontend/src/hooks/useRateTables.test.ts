import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUseQuery = vi.fn((options: unknown) => options)

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}))

const mockTablesReadRateTables = vi.fn()
const mockTablesReadRateTable = vi.fn()

vi.mock("../client", () => ({
  RateTablesService: {
    tablesReadRateTables: (...args: unknown[]) =>
      mockTablesReadRateTables(...args),
    tablesReadRateTable: (...args: unknown[]) =>
      mockTablesReadRateTable(...args),
  },
}))

import { usePublishedRateTable } from "./useRateTables"

describe("usePublishedRateTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null without fetching detail when no published rate table exists", async () => {
    mockTablesReadRateTables.mockResolvedValue({
      data: { data: [], count: 0 },
    })

    const queryOptions = usePublishedRateTable({
      insurerId: "ins-1",
      classOfInsurance: "Motor Private",
    }) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }

    expect(queryOptions.queryKey).toEqual([
      "rate-tables",
      "published",
      "ins-1",
      "Motor Private",
    ])

    const result = await queryOptions.queryFn()
    expect(result).toBeNull()
    expect(mockTablesReadRateTables).toHaveBeenCalledWith({
      query: {
        insurer_id: "ins-1",
        class_of_insurance: "Motor Private",
        status: "published",
        limit: 1,
      },
    })
    expect(mockTablesReadRateTable).not.toHaveBeenCalled()
  })

  it("fetches published rate table detail when a published version exists", async () => {
    const published = {
      id: "rt-1",
      insurer_id: "ins-1",
      class_of_insurance: "Motor Private",
      status: "published",
    }
    const detail = {
      ...published,
      brackets: [{ id: "b-1", rate_percent: "0.045" }],
      benefits: [],
      medical_tiers: [],
    }

    mockTablesReadRateTables.mockResolvedValue({
      data: { data: [published], count: 1 },
    })
    mockTablesReadRateTable.mockResolvedValue({
      data: detail,
    })

    const queryOptions = usePublishedRateTable({
      insurerId: undefined,
      classOfInsurance: "Motor Private",
    }) as unknown as {
      queryKey: unknown[]
      queryFn: () => Promise<unknown>
    }

    expect(queryOptions.queryKey).toEqual([
      "rate-tables",
      "published",
      null,
      "Motor Private",
    ])

    const result = await queryOptions.queryFn()
    expect(result).toEqual(detail)
    expect(mockTablesReadRateTables).toHaveBeenCalledWith({
      query: {
        insurer_id: null,
        class_of_insurance: "Motor Private",
        status: "published",
        limit: 1,
      },
    })
    expect(mockTablesReadRateTable).toHaveBeenCalledWith({
      path: { id: "rt-1" },
    })
  })
})
