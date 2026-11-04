"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { Chip } from "@/components/chip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PHONE_ERROR, normalizePhone } from "@/lib/format"
import { TEAM_ROLE_LABEL, type Pod, type TeamRole } from "@/lib/types"
import { bulkImport, type BulkRowResult } from "./actions"
import { describeOutcome, sendLinksTo } from "./send-links"

type PreviewRow = {
  line: number
  full_name: string
  email: string
  phone: string
  role: TeamRole | null
  pod_name: string
  problem: string | null
  skip: boolean
  note: string | null
}

const HEADERS: Record<string, keyof Pick<PreviewRow, "full_name" | "email" | "phone" | "role" | "pod_name">> = {
  name: "full_name",
  "full name": "full_name",
  email: "email",
  "email id": "email",
  "email address": "email",
  phone: "phone",
  ph: "phone",
  mobile: "phone",
  "phone number": "phone",
  "mobile number": "phone",
  whatsapp: "phone",
  "whatsapp number": "phone",
  role: "role",
  pod: "pod_name",
  "pod name": "pod_name",
}

function parseRole(raw: string): TeamRole | null {
  const r = raw.trim().toLowerCase().replace(/[\s_-]+/g, " ")
  if (!r || r === "intern") return "intern"
  if (r === "admin") return "admin"
  if (r === "pod leader" || r === "leader" || r === "team leader") return "leader"
  return null
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function readRows(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text())
  const { readSheet } = await import("read-excel-file/browser")
  const data = await readSheet(file)
  return data.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))))
}

async function downloadTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser")
  const header = ["Name", "Email", "Phone", "Role", "Pod"].map((value) => ({ value, fontWeight: "bold" as const }))
  await writeXlsxFile(
    [
      header,
      ["Riya Sharma", "riya@example.com", "9876543210", "Pod leader", "Pod Alpha"],
      ["Arjun Mehta", "arjun@example.com", "9123456780", "Intern", "Pod Alpha"],
      ["Meera Iyer", "meera@example.com", "9988776655", "Intern", ""],
    ],
    { columns: [{ width: 22 }, { width: 30 }, { width: 14 }, { width: 12 }, { width: 16 }] }
  ).toFile("azisly-team-template.xlsx")
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  existingEmails,
  pods,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  existingEmails: Set<string>
  pods: Pod[]
}) {
  const router = useRouter()
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [readError, setReadError] = useState<string | null>(null)
  const [sendLinks, setSendLinks] = useState(true)
  const [stage, setStage] = useState<"pick" | "importing" | "sending" | "done">("pick")
  const [progress, setProgress] = useState("")
  const [results, setResults] = useState<BulkRowResult[] | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const podNames = useMemo(() => new Set(pods.map((p) => p.name.toLowerCase())), [pods])

  function reset() {
    setFileName(null)
    setRows([])
    setReadError(null)
    setStage("pick")
    setProgress("")
    setResults(null)
    setSummary(null)
  }

  async function onFile(file: File | undefined) {
    reset()
    if (!file) return
    setFileName(file.name)
    let table: string[][]
    try {
      table = await readRows(file)
    } catch {
      setReadError("Couldn’t read that file. Save it as .xlsx or .csv and try again.")
      return
    }
    const headerIdx = table.findIndex((r) => r.some((c) => HEADERS[c.trim().toLowerCase()] === "email"))
    if (headerIdx === -1) {
      setReadError("Couldn’t find the header row. The first row needs columns named Name, Email, Phone, Role (and optionally Pod).")
      return
    }
    const cols = table[headerIdx].map((c) => HEADERS[c.trim().toLowerCase()])
    if (!cols.includes("full_name")) {
      setReadError("The sheet needs a Name column.")
      return
    }
    const seen = new Set<string>()
    const parsed: PreviewRow[] = []
    table.slice(headerIdx + 1).forEach((cells, i) => {
      if (cells.every((c) => !c.trim())) return
      const get = (k: string) => {
        const idx = cols.indexOf(k as never)
        return idx === -1 ? "" : (cells[idx] ?? "").trim()
      }
      const row: PreviewRow = {
        line: headerIdx + i + 2,
        full_name: get("full_name"),
        email: get("email").toLowerCase(),
        phone: get("phone"),
        role: parseRole(get("role")),
        pod_name: get("pod_name"),
        problem: null,
        skip: false,
        note: null,
      }
      const phone = normalizePhone(row.phone)
      if (row.full_name.length < 2 || row.full_name.length > 80) row.problem = "Name must be 2–80 characters."
      else if (!/^\S+@\S+\.\S+$/.test(row.email)) row.problem = "Missing or invalid email."
      else if (phone === "invalid") row.problem = PHONE_ERROR
      else if (!row.role) row.problem = "Role must be Intern, Pod leader or Admin."
      else if (row.pod_name.length > 40) row.problem = "Pod name must be up to 40 characters."
      else if (seen.has(row.email)) row.problem = "This email appears twice in the sheet."
      else if (existingEmails.has(row.email)) {
        row.skip = true
        row.note = "Already on the team – will be skipped."
      } else if (row.role === "leader" && !row.pod_name) row.note = "No pod – will be added as intern for now."
      else if (row.pod_name && !podNames.has(row.pod_name.toLowerCase())) row.note = `New pod “${row.pod_name}” will be created.`
      if (typeof phone === "string" && phone !== "invalid") row.phone = phone
      seen.add(row.email)
      parsed.push(row)
    })
    if (parsed.length === 0) setReadError("No people found below the header row.")
    setRows(parsed)
  }

  const ready = rows.filter((r) => !r.problem && !r.skip)
  const problems = rows.filter((r) => r.problem)

  async function runImport() {
    setStage("importing")
    const res = await bulkImport(
      ready.map((r) => ({ full_name: r.full_name, email: r.email, phone: r.phone, role: r.role!, pod_name: r.pod_name }))
    )
    if (!res.ok) {
      toast.error(res.error)
      setStage("pick")
      return
    }
    const out = res.data!
    setResults(out)
    const created = out.filter((r) => r.status === "created").map((r) => r.email)
    let text = `Added ${created.length} ${created.length === 1 ? "person" : "people"}.`
    if (sendLinks && created.length) {
      setStage("sending")
      const outcome = await sendLinksTo(created, (done, total) => setProgress(`Sending login links ${done}/${total}…`))
      text += ` ${describeOutcome(outcome, created.length)}`
    }
    setSummary(text)
    setStage("done")
    router.refresh()
  }

  const busy = stage === "importing" || stage === "sending"

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload a team sheet</DialogTitle>
          <DialogDescription>
            Excel (.xlsx) or CSV with columns <strong>Name, Email, Phone, Role</strong> and optionally <strong>Pod</strong>.
            Role is Intern, Pod leader or Admin (blank = Intern).
          </DialogDescription>
        </DialogHeader>

        {stage === "done" ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-muted p-3 text-sm text-foreground">{summary}</p>
            {results && results.some((r) => r.status !== "created" || r.message) && (
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
                {results
                  .filter((r) => r.status !== "created" || r.message)
                  .map((r) => (
                    <li key={r.email}>
                      <Chip tone={r.status === "error" ? "red" : r.status === "exists" ? "grey" : "amber"}>{r.status}</Chip>{" "}
                      {r.email} – {r.message}
                    </li>
                  ))}
              </ul>
            )}
            <DialogFooter>
              <Button
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <Download /> Download template
              </Button>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
                <FileSpreadsheet className="size-4" /> {fileName ? "Choose another file" : "Choose file"}
                <input
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    onFile(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
              </label>
              {fileName && <span className="self-center text-sm text-muted-foreground">{fileName}</span>}
            </div>

            {readError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{readError}</p>}

            {rows.length > 0 && (
              <>
                <p className="text-sm">
                  <strong>{ready.length}</strong> ready to add
                  {rows.some((r) => r.skip) && <> · {rows.filter((r) => r.skip).length} already on the team</>}
                  {problems.length > 0 && (
                    <span className="text-red-700">
                      {" "}
                      · {problems.length} with problems (fix them in the sheet and upload again, or they’ll be left out)
                    </span>
                  )}
                </p>
                <div className="max-h-72 overflow-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Pod</th>
                        <th className="p-2">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((r) => (
                        <tr key={r.line} className={r.problem ? "bg-red-50" : r.skip ? "text-muted-foreground" : ""}>
                          <td className="p-2">{r.line}</td>
                          <td className="p-2">{r.full_name}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.phone}</td>
                          <td className="p-2">{r.role ? TEAM_ROLE_LABEL[r.role] : "?"}</td>
                          <td className="p-2">{r.pod_name}</td>
                          <td className="p-2">
                            {r.problem ? (
                              <span className="text-red-700">{r.problem}</span>
                            ) : (
                              r.note ?? <span className="text-foreground">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={sendLinks} onCheckedChange={(v) => setSendLinks(v === true)} className="mt-0.5" />
                  Email everyone their login link right after adding them
                </label>
              </>
            )}

            <DialogFooter>
              <Button disabled={busy || ready.length === 0} onClick={runImport}>
                {stage === "importing"
                  ? "Adding people…"
                  : stage === "sending"
                    ? progress || "Sending login links…"
                    : `Add ${ready.length || ""} ${ready.length === 1 ? "person" : "people"}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
