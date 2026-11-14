import { describe, expect, it } from "vitest"
import {
  buildCoverSnapshot,
  buildQuoteRiskDetails,
  extractCoverSummary,
  extractSumInsured,
} from "./coverSnapshot"

describe("coverSnapshot", () => {
  describe("extractSumInsured", () => {
    it("extracts numeric sum_insured from nested wizard details", () => {
      expect(
        extractSumInsured({
          vehicle_details: {
            reg_no: "KDA 123A",
            sum_insured: "2,500,000",
          },
        }),
      ).toBe(2500000)
    })

    it("extracts value or Sum Insured aliases and returns 0 when absent", () => {
      expect(extractSumInsured({ "Sum Insured": "1,200,000.50" })).toBe(
        1200000.5,
      )
      expect(extractSumInsured({ property: { value: 500000 } })).toBe(500000)
      expect(extractSumInsured(null)).toBe(0)
      expect(extractSumInsured({ reg_no: "KDA 123A" })).toBe(0)
    })
  })

  describe("buildQuoteRiskDetails", () => {
    it("shapes vehicle sum_insured, optional financials rate, and normalized extensions", () => {
      expect(
        buildQuoteRiskDetails({
          sumInsured: 3500000,
          rate: 4.5,
          extensions: { pvt: true, excessProtector: false },
        }),
      ).toEqual({
        vehicle: { sum_insured: 3500000 },
        financials: { rate: 4.5 },
        extensions: {
          pvt: true,
          excess_protector: false,
          om_rescue_plus: false,
          passenger_liability: false,
        },
      })

      expect(
        buildQuoteRiskDetails({
          sumInsured: 1500000,
          extensions: { omRescuePlus: true },
        }),
      ).toEqual({
        vehicle: { sum_insured: 1500000 },
        extensions: {
          pvt: false,
          excess_protector: false,
          om_rescue_plus: true,
          passenger_liability: false,
        },
      })
    })
  })

  describe("buildCoverSnapshot", () => {
    it("builds Motor cover_snapshot without [ EMPTY ] sentinels", () => {
      const blueprint = {
        vehicle_details: {
          reg_no: "<<text>>",
          chassis_no: "<<text>>",
        },
      }
      const snapshot = buildCoverSnapshot({
        blueprint,
        details: { vehicle_details: { reg_no: "KDA 123A" } },
        sumInsured: 2000000,
        extensions: { pvt: true, excessProtector: true },
        terms: {
          benefits_and_limits: "Comprehensive",
          excesses: "2.5% min 20k",
          special_clauses: "None",
        },
      })

      expect(snapshot).toEqual({
        vehicle: {
          reg_no: "KDA 123A",
          sum_insured: 2000000,
        },
        extensions: {
          pvt: true,
          excess_protector: true,
          om_rescue_plus: false,
          passenger_liability: false,
        },
        benefits_and_limits: "Comprehensive",
        excesses: "2.5% min 20k",
        special_clauses: "None",
      })
      expect(JSON.stringify(snapshot)).not.toContain("[ EMPTY ]")
    })

    it("builds non-Motor cover_snapshot preserving blueprint sections without [ EMPTY ]", () => {
      const blueprint = {
        insured_details: {
          occupation: "<<text>>",
          next_of_kin: "<<text>>",
        },
      }
      const snapshot = buildCoverSnapshot({
        blueprint,
        details: { insured_details: { occupation: "Engineer" } },
        sumInsured: 1000000,
        terms: {
          benefits_and_limits: "PA Cover",
          excesses: "Nil",
          special_clauses: "",
        },
      })

      expect(snapshot).toEqual({
        insured_details: {
          occupation: "Engineer",
        },
        extensions: {
          pvt: false,
          excess_protector: false,
          om_rescue_plus: false,
          passenger_liability: false,
        },
        benefits_and_limits: "PA Cover",
        excesses: "Nil",
        special_clauses: "",
      })
      expect(JSON.stringify(snapshot)).not.toContain("[ EMPTY ]")
    })
  })

  describe("extractCoverSummary", () => {
    it("extracts sumInsured, vehicleReg, makeModel, and active extensions", () => {
      expect(
        extractCoverSummary({
          vehicle: {
            reg_no: "KDA 123A",
            make: "Toyota",
            model: "Prado",
            sum_insured: 4500000,
          },
          extensions: {
            pvt: true,
            excess_protector: true,
            om_rescue_plus: false,
            passenger_liability: false,
          },
        }),
      ).toEqual({
        sumInsured: 4500000,
        vehicleReg: "KDA 123A",
        makeModel: "Toyota Prado",
        extensions: ["pvt", "excess_protector"],
      })
    })

    it("extracts propertyLocation from property.location", () => {
      expect(
        extractCoverSummary({
          property: {
            location: "Westlands, Nairobi",
            sum_insured: 12000000,
          },
        }),
      ).toEqual({
        sumInsured: 12000000,
        vehicleReg: undefined,
        makeModel: undefined,
        propertyLocation: "Westlands, Nairobi",
        extensions: [],
      })
    })

    it("handles null or empty cover_snapshot safely", () => {
      expect(extractCoverSummary(null)).toEqual({
        sumInsured: 0,
        vehicleReg: undefined,
        makeModel: undefined,
        extensions: [],
      })
    })
  })
})
