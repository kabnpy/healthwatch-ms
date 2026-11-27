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
    Number(row.debit || 0).toFixed(2),
    Number(row.credit || 0).toFixed(2),
    Number(row.running_balance || 0).toFixed(2),
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
