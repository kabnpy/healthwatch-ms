import { describe, expect, it } from "vitest"
import {
  buildStatementCsvFilename,
  serializeStatementLedgerToCsv,
} from "./statementCsv"

describe("serializeStatementLedgerToCsv", () => {
  it("serializes ledger entries with headers and escapes double quotes in description", () => {
    const csv = serializeStatementLedgerToCsv([
      {
        date: "2026-05-01",
        type: "INVOICE",
        reference: "INV-001",
        description: 'Invoice "Acme" Policy',
        debit: "1000.00",
        credit: "0.00",
        running_balance: "1000.00",
      },
      {
        date: "2026-05-10",
        type: "PAYMENT_ALLOCATION",
        reference: "PAY-001",
        description: "Payment allocated to INV-001",
        debit: "0",
        credit: "250.5",
        running_balance: "749.50",
      },
    ])

    const lines = csv.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(
      "Date,Type,Reference,Description,Debit (KES),Credit (KES),Running Balance (KES)",
    )
    expect(lines[1]).toBe(
      '"2026-05-01","INVOICE","INV-001","Invoice ""Acme"" Policy",1000.00,0.00,1000.00',
    )
    expect(lines[2]).toBe(
      '"2026-05-10","PAYMENT_ALLOCATION","PAY-001","Payment allocated to INV-001",0.00,250.50,749.50',
    )
  })

  it("returns empty string when ledger entries are empty", () => {
    expect(serializeStatementLedgerToCsv([])).toBe("")
  })
})

describe("buildStatementCsvFilename", () => {
  it("sanitizes client name whitespace and appends ISO date", () => {
    expect(buildStatementCsvFilename("Acme Health Ltd", "2026-05-15")).toBe(
      "statement_Acme_Health_Ltd_2026-05-15.csv",
    )
  })

  it("falls back to 'client' when client name is missing", () => {
    expect(buildStatementCsvFilename(undefined, "2026-05-15")).toBe(
      "statement_client_2026-05-15.csv",
    )
  })
})
