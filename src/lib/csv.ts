/** CSV that opens cleanly in Excel (UTF-8 marker, quoted cells, formula-safe). */
export function toCsv(rows: Record<string, string | number | null | undefined>[]): string {
  if (rows.length === 0) return "﻿"
  const headers = Object.keys(rows[0])
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v)
    // Stop spreadsheet apps treating text like "=SUM(...)" as a formula.
    if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return "﻿" + [headers.map(cell).join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n")
}
