import { describe, expect, it } from "vitest"
import { injectWizardData } from "./documentData"

describe("injectWizardData", () => {
  it("should resolve flat paths", () => {
    const blueprint = {
      reg_no: "<<text>>",
    }
    const inputs = {
      reg_no: "KCM 123",
    }
    const result = injectWizardData(blueprint, inputs)
    expect(result.reg_no).toBe("KCM 123")
  })

  it("should resolve nested paths using dot notation", () => {
    const blueprint = {
      vehicle: {
        registration: "<<VEHICLE DETAILS.Reg. No>>",
      },
    }
    const inputs = {
      "VEHICLE DETAILS": {
        "Reg. No": "KCM 123",
      },
    }
    const result = injectWizardData(blueprint, inputs)
    expect(result.vehicle.registration).toBe("KCM 123")
  })

  it("should resolve absolute paths from root even when recursing", () => {
    const blueprint = {
      section: {
        deep: {
          field: "<<top_level>>",
        },
      },
    }
    const inputs = {
      top_level: "ROOT_VALUE",
    }
    const result = injectWizardData(blueprint, inputs)
    expect(result.section.deep.field).toBe("ROOT_VALUE")
  })

  it("should resolve relative paths when recursing", () => {
    const blueprint = {
      section: {
        field: "<<field>>",
      },
    }
    const inputs = {
      section: {
        field: "RELATIVE_VALUE",
      },
    }
    const result = injectWizardData(blueprint, inputs)
    expect(result.section.field).toBe("RELATIVE_VALUE")
  })
})
