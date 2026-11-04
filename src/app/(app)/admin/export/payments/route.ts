import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { toCsv } from "@/lib/csv"
import { createClient } from "@/lib/supabase/server"

/** Payments CSV for the weekly report (admins only). */
export async function GET() {
  const me = await getCurrentUser()
  if (!me?.isAdmin) return new NextResponse("Not allowed", { status: 403 })
  const supabase = await createClient()
  const { data } = await supabase
    .from("payments")
    .select(
      "paid_on, amount, status, txn_ref, reason, created_at, verified_at, lead:leads(name, phone, source), owner:profiles!payments_owner_id_fkey(full_name, pod:pods!profiles_pod_id_fkey(name)), course:courses(name), assisted:profiles!payments_assisted_by_fkey(full_name)"
    )
    .order("paid_on")
  type Row = {
    paid_on: string
    amount: number
    status: string
    txn_ref: string
    reason: string | null
    created_at: string
    verified_at: string | null
    lead: { name: string; phone: string; source: string } | null
    owner: { full_name: string; pod: { name: string } | null } | null
    course: { name: string } | null
    assisted: { full_name: string } | null
  }
  const rows = ((data ?? []) as unknown as Row[]).map((p) => ({
    "Payment date": p.paid_on,
    "Amount (INR)": Number(p.amount),
    Status: p.status,
    "Transaction ID": p.txn_ref,
    Intern: p.owner?.full_name ?? "",
    Pod: p.owner?.pod?.name ?? "",
    Lead: p.lead?.name ?? "",
    "Lead phone": p.lead?.phone ?? "",
    Source: p.lead?.source ?? "",
    Course: p.course?.name ?? "",
    "Assisted by": p.assisted?.full_name ?? "",
    Reason: p.reason ?? "",
    "Logged at": p.created_at,
    "Verified at": p.verified_at ?? "",
  }))
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="azisly-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
