import "server-only"
import writeXlsxFile from "write-excel-file/node"
import type { SheetData } from "write-excel-file/node"
import { createAdminClient } from "@/lib/supabase/admin"

export const REPORTS = {
  leads: { title: "Leads", hint: "Every lead with owner, pod, course, stage, touches and follow-up" },
  payments: { title: "Payments", hint: "Every payment with status, transaction ID, lead, intern and pod" },
  people: { title: "People", hint: "Team members with role, pod, joining status and their sales" },
} as const
export type ReportKind = keyof typeof REPORTS

type Cell = string | number | Date | null
type Col = { header: string; width: number; money?: boolean; date?: boolean }

const ist = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60_000) : null)
const day = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`) : null)

async function toXlsx(cols: Col[], rows: Cell[][], sheet: string): Promise<Buffer> {
  const data: SheetData = [
    cols.map((c) => ({ value: c.header, fontWeight: "bold" as const, backgroundColor: "#EAEEFE" })),
    ...rows.map((r) =>
      r.map((v, i) => {
        if (v === null || v === "") return null
        if (v instanceof Date) return { value: v, type: Date, format: cols[i].date ? "dd mmm yyyy" : "dd mmm yyyy hh:mm" }
        if (typeof v === "number") return { value: v, type: Number, format: cols[i].money ? "#,##0" : undefined }
        return { value: v, type: String }
      })
    ),
  ]
  return writeXlsxFile(data, { sheet, columns: cols.map((c) => ({ width: c.width })), stickyRowsCount: 1 }).toBuffer()
}

/**
 * Builds a report. `podId` limits it to one pod (managers); null = everything (admins).
 * Uses the server key, so callers must check the viewer's power first.
 */
export async function buildReport(kind: ReportKind, podId: string | null): Promise<Buffer> {
  const db = createAdminClient()

  if (kind === "leads") {
    let q = db
      .from("leads")
      .select(
        "name, phone, email, city, college, persona, source, stage, temperature, lost_reason, touches, last_touched_at, next_follow_up, created_at, owner:profiles!leads_owner_id_fkey(full_name), pod:pods(name), course:courses(short_name)"
      )
      .order("created_at")
    if (podId) q = q.eq("pod_id", podId)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    type R = Record<string, unknown> & { owner: { full_name: string } | null; pod: { name: string } | null; course: { short_name: string } | null }
    const cols: Col[] = [
      { header: "Lead", width: 24 }, { header: "Phone", width: 13 }, { header: "Email", width: 26 }, { header: "City", width: 14 },
      { header: "College / company", width: 20 }, { header: "Persona", width: 18 }, { header: "Source", width: 16 },
      { header: "Course", width: 16 }, { header: "Stage", width: 15 }, { header: "Temperature", width: 12 },
      { header: "Lost reason", width: 16 }, { header: "Touches", width: 9 }, { header: "Owner", width: 20 }, { header: "Pod", width: 14 },
      { header: "Last touched", width: 18 }, { header: "Next follow-up", width: 14, date: true }, { header: "Added", width: 18 },
    ]
    const rows = ((data ?? []) as unknown as R[]).map((l) => [
      l.name as string, l.phone as string, (l.email as string) ?? null, (l.city as string) ?? null, (l.college as string) ?? null,
      (l.persona as string) ?? null, l.source as string, l.course?.short_name ?? null, l.stage as string, l.temperature as string,
      (l.lost_reason as string) ?? null, Number(l.touches), l.owner?.full_name ?? null, l.pod?.name ?? null,
      ist(l.last_touched_at as string | null), day(l.next_follow_up as string | null), ist(l.created_at as string),
    ])
    return toXlsx(cols, rows, "Leads")
  }

  if (kind === "payments") {
    let q = db
      .from("payments")
      .select(
        "paid_on, amount, status, txn_ref, reason, created_at, verified_at, lead:leads!inner(name, phone, source, pod_id), owner:profiles!payments_owner_id_fkey(full_name, pod:pods!profiles_pod_id_fkey(name)), course:courses(short_name), assisted:profiles!payments_assisted_by_fkey(full_name)"
      )
      .order("paid_on")
    if (podId) q = q.eq("lead.pod_id", podId)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    type R = {
      paid_on: string; amount: number; status: string; txn_ref: string; reason: string | null; created_at: string; verified_at: string | null
      lead: { name: string; phone: string; source: string } | null
      owner: { full_name: string; pod: { name: string } | null } | null
      course: { short_name: string } | null
      assisted: { full_name: string } | null
    }
    const cols: Col[] = [
      { header: "Paid on", width: 13, date: true }, { header: "Amount (₹)", width: 12, money: true }, { header: "Status", width: 11 },
      { header: "Transaction ID", width: 22 }, { header: "Lead", width: 22 }, { header: "Lead phone", width: 13 },
      { header: "Source", width: 15 }, { header: "Course", width: 16 }, { header: "Intern", width: 20 }, { header: "Pod", width: 14 },
      { header: "Assisted by", width: 18 }, { header: "Reason", width: 28 }, { header: "Logged", width: 18 }, { header: "Verified", width: 18 },
    ]
    const rows = ((data ?? []) as unknown as R[]).map((p) => [
      day(p.paid_on), Number(p.amount), p.status, p.txn_ref, p.lead?.name ?? null, p.lead?.phone ?? null, p.lead?.source ?? null,
      p.course?.short_name ?? null, p.owner?.full_name ?? null, p.owner?.pod?.name ?? null, p.assisted?.full_name ?? null,
      p.reason, ist(p.created_at), ist(p.verified_at),
    ])
    return toXlsx(cols, rows, "Payments")
  }

  // People
  let q = db
    .from("profiles")
    .select("id, full_name, email, phone, role, active, first_login_at, referral_code, photo_path, pod:pods!profiles_pod_id_fkey(name)")
    .order("full_name")
  if (podId) q = q.eq("pod_id", podId).eq("role", "intern")
  const [{ data, error }, { data: pays }, { data: leads }] = await Promise.all([
    q,
    db.from("payments").select("owner_id, amount").eq("status", "Verified"),
    db.from("leads").select("owner_id, stage"),
  ])
  if (error) throw new Error(error.message)
  const revenue = new Map<string, number>()
  for (const p of pays ?? []) revenue.set(p.owner_id, (revenue.get(p.owner_id) ?? 0) + Number(p.amount))
  const leadCount = new Map<string, { all: number; won: number }>()
  for (const l of leads ?? []) {
    const c = leadCount.get(l.owner_id) ?? { all: 0, won: 0 }
    c.all++
    if (l.stage === "Won") c.won++
    leadCount.set(l.owner_id, c)
  }
  type R = {
    id: string; full_name: string; email: string; phone: string | null; role: string; active: boolean
    first_login_at: string | null; referral_code: string | null; photo_path: string | null; pod: { name: string } | null
  }
  const cols: Col[] = [
    { header: "Name", width: 22 }, { header: "Email", width: 28 }, { header: "Phone", width: 13 }, { header: "Role", width: 10 },
    { header: "Pod", width: 14 }, { header: "Status", width: 13 }, { header: "First login", width: 18 }, { header: "Referral code", width: 13 },
    { header: "ID photo", width: 9 }, { header: "Leads", width: 8 }, { header: "Won", width: 7 }, { header: "Verified sales (₹)", width: 16, money: true },
  ]
  const rows = ((data ?? []) as unknown as R[]).map((p) => [
    p.full_name, p.email, p.phone, p.role[0].toUpperCase() + p.role.slice(1), p.pod?.name ?? null,
    !p.active ? "Deactivated" : p.first_login_at ? "Joined" : "Not joined yet", ist(p.first_login_at), p.referral_code,
    p.photo_path ? "Yes" : "No", leadCount.get(p.id)?.all ?? 0, leadCount.get(p.id)?.won ?? 0, revenue.get(p.id) ?? 0,
  ])
  return toXlsx(cols, rows, "People")
}
