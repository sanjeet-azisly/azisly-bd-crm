import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { formatINR } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import { screenshotLinks } from "@/lib/screenshots"
import { cn } from "@/lib/utils"
import { VerifyList, type QueueRow } from "./verify-list"

export const metadata = { title: "Verify payments · Azisly BD CRM" }

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "closed", label: "Rejected & refunded" },
] as const

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams
  const tab = TABS.find((t) => t.key === raw)?.key ?? "pending"
  const supabase = await createClient()

  let query = supabase
    .from("payments")
    .select(
      "id, amount, paid_on, txn_ref, status, reason, created_at, verified_at, screenshot_path, lead:leads(id, name, phone), owner:profiles!payments_owner_id_fkey(full_name), course:courses(short_name), assisted:profiles!payments_assisted_by_fkey(full_name)"
    )
  query =
    tab === "pending"
      ? query.eq("status", "Pending").order("created_at", { ascending: true })
      : tab === "verified"
        ? query.eq("status", "Verified").order("verified_at", { ascending: false }).limit(100)
        : query.in("status", ["Rejected", "Refunded"]).order("updated_at", { ascending: false }).limit(100)
  const [{ data }, { count: pendingCount }] = await Promise.all([
    query,
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "Pending"),
  ])
  const links = await screenshotLinks((data ?? []).map((p) => p.screenshot_path))

  const rows: QueueRow[] = (data ?? []).map((p) => {
    const lead = p.lead as unknown as { id: string; name: string; phone: string } | null
    return {
      id: p.id,
      amount: Number(p.amount),
      paid_on: p.paid_on,
      txn_ref: p.txn_ref,
      status: p.status,
      reason: p.reason,
      logged_at: p.created_at,
      lead_id: lead?.id ?? "",
      lead_name: lead?.name ?? "–",
      intern: (p.owner as unknown as { full_name: string } | null)?.full_name ?? "–",
      course: (p.course as unknown as { short_name: string } | null)?.short_name ?? "–",
      assisted: (p.assisted as unknown as { full_name: string } | null)?.full_name ?? null,
      screenshot_url: p.screenshot_path ? (links[p.screenshot_path] ?? null) : null,
    }
  })
  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <>
      <PageHeader
        title="Verify payments"
        description="Check each payment against the official Azisly account before verifying. Only verified payments count."
      />
      <nav className="mb-8 flex gap-1 rounded-full bg-surface p-1 text-sm" aria-label="Payment status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/verify?tab=${t.key}`}
            className={cn("flex-1 rounded-full px-4 py-2 text-center", tab === t.key ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.key === "pending" && pendingCount ? ` (${pendingCount})` : ""}
          </Link>
        ))}
      </nav>
      {tab === "pending" && rows.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          {rows.length} waiting · {formatINR(total)} · oldest first
        </p>
      )}
      <VerifyList rows={rows} tab={tab} />
    </>
  )
}
