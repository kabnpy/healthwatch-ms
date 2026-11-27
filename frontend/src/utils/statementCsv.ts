export interface StatementLedgerCsvRow {
  date: string
  type: string
  reference: string
  description: string
  debit?: string | number | null
  credit?: string | number | null
  running_balance?: string | number | null
}

const STATEMENT_CSV_HEADERS = [
  "Date",
  "Type",
  "Reference",
  "Description",
  "Debit (KES)",
  "Credit (KES)",
  "Running Balance (KES)",
]

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function formatFixedPointMoney(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "0.00"
  }
  const raw = String(value).trim()
  if (!raw) {
    return "0.00"
  }

  const sign = raw.startsWith("-") ? "-" : ""
  const unsigned = sign ? raw.slice(1) : raw
  const [intPartRaw, fracPartRaw = ""] = unsigned.split(".")
  const intPart = intPartRaw || "0"
  const fracPart = `${fracPartRaw}00`.slice(0, 2)
  return `${sign}${intPart}.${fracPart}`
}

export function serializeStatementLedgerToCsv(
  ledgerEntries: readonly StatementLedgerCsvRow[],
): string {
  if (!ledgerEntries.length) {
    return ""
  }

  const rows = ledgerEntries.map((row) => [
    escapeCsvField(row.date),
    escapeCsvField(row.type),
    escapeCsvField(row.reference),
    escapeCsvField(row.description),
    formatFixedPointMoney(row.debit),
    formatFixedPointMoney(row.credit),
    formatFixedPointMoney(row.running_balance),
  ])

  return [
    STATEMENT_CSV_HEADERS.join(","),
    ...rows.map((cells) => cells.join(",")),
  ].join("\n")
}

export function buildStatementCsvFilename(
  clientName?: string,
  isoDate = new Date().toISOString().split("T")[0],
): string {
  const safeName = (clientName || "client").replace(/\s+/g, "_")
  return `statement_${safeName}_${isoDate}.csv`
}
