import Link from "next/link"
import { Download } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { formatINR } from "@/lib/format"
import { buildLeaderboard, loadLeaderboardData } from "@/lib/leaderboard"
import { OPEN_STAGES, istDate } from "@/lib/leads"
import { inRange, monthFor, periodRange, programMonths } from "@/lib/program"
import { createClient } from "@/lib/supabase/server"
import { MonthColumns, RankedBars } from "./charts"

export const metadata = { title: "Dashboard · Azisly BD CRM" }

// Hot / Warm / Cold, checked for colour-blind separation; always shown with text labels.
const TEMP_COLOURS = { Hot: "#DC2626", Warm: "#F59E0B", Cold: "#2563EB" } as const

type VerifiedPayment = {
  amount: number
  paid_on: string
  owner_id: string
  course: { short_name: string } | null
  lead: { source: string } | null
}

/** Spec 5.10.1: the admin's view of the whole program. */
export default async function DashboardPage() {
  const supabase = await createClient()
  const today = istDate()
  const [data, { data: payRows }, { data: pending }, { data: leads }, { data: settings }] = await Promise.all([
    loadLeaderboardData(supabase),
    supabase.from("payments").select("amount, paid_on, owner_id, course:courses(short_name), lead:leads(source)").eq("status", "Verified"),
    supabase.from("payments").select("amount").eq("status", "Pending"),
    supabase.from("leads").select("stage, temperature"),
    supabase.from("settings").select("business_target, stretch_target, monthly_targets").eq("id", 1).single(),
  ])
  const payments = ((payRows ?? []) as unknown as VerifiedPayment[]).map((p) => ({ ...p, amount: Number(p.amount) }))
  const total = payments.reduce((s, p) => s + p.amount, 0)
  const business = Number(settings?.business_target ?? 1000000)
  const stretch = Number(settings?.stretch_target ?? 2000000)
  const monthly = (settings?.monthly_targets ?? {}) as Partial<Record<"M1" | "M2" | "M3", number>>

  const month = monthFor(data.settings, today)
  const monthRange = periodRange(data.settings, "month", today)
  const thisMonth = payments.filter((p) => inRange(p.paid_on, monthRange))
  const monthRevenue = thisMonth.reduce((s, p) => s + p.amount, 0)
  const interns = new Set(data.people.map((p) => p.id))
  const sellers = new Set(thisMonth.map((p) => p.owner_id).filter((id) => interns.has(id)))
  const pendingAmount = (pending ?? []).reduce((s, p) => s + Number(p.amount), 0)

  const byMonth = programMonths(data.settings).map((m) => {
    const r = periodRange(data.settings, m.key, today)
    return {
      month: m.key,
      revenue: payments.filter((p) => inRange(p.paid_on, r)).reduce((s, p) => s + p.amount, 0),
      target: monthly[m.key] ? Number(monthly[m.key]) : null,
    }
  })
  const groupSum = (key: (p: VerifiedPayment) => string) => {
    const m = new Map<string, number>()
    for (const p of payments) m.set(key(p), (m.get(key(p)) ?? 0) + p.amount)
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }
  const byCourse = groupSum((p) => p.course?.short_name ?? "No course")
  const bySource = groupSum((p) => p.lead?.source ?? "Unknown")
  const byPod = buildLeaderboard(data, "all", today)
    .pods.map((p) => ({ name: p.name, value: p.revenue }))
    .filter((p) => p.value > 0)

  // Funnel (spec 5.10.1d), on the 4-step pipeline: qualified = BANT Warm/Hot or further along.
  const all = leads ?? []
  const reached = (stages: string[]) => all.filter((l) => stages.includes(l.stage)).length
  const funnel = [
    { name: "Leads", value: all.length },
    {
      name: "Qualified",
      value: all.filter((l) => l.temperature === "Hot" || l.temperature === "Warm" || ["Demo done", "Payment pending", "Won"].includes(l.stage)).length,
    },
    { name: "Demo done", value: reached(["Demo done", "Payment pending", "Won"]) },
    { name: "Payment pending", value: reached(["Payment pending", "Won"]) },
    { name: "Won", value: reached(["Won"]) },
  ]
  const open = all.filter((l) => OPEN_STAGES.includes(l.stage))
  const temps = (["Hot", "Warm", "Cold"] as const).map((t) => ({ t, n: open.filter((l) => l.temperature === t).length }))

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Verified revenue only, by payment date, net of refunds."
        action={
          <div className="flex gap-2">
            <a href="/admin/export/payments" download className={buttonVariants({ variant: "outline", className: "h-10" })}>
              <Download /> Payments CSV
            </a>
            <Link href="/leads" className={buttonVariants({ variant: "outline", className: "h-10" })}>
              All leads
            </Link>
          </div>
        }
      />

      {/* Cards (5.10.1a) */}
      <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-surface p-6 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Verified revenue · 90 days</p>
          <p className="font-heading text-3xl font-bold">{formatINR(total)}</p>
          <div className="relative mt-3 h-2.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, (total / stretch) * 100)}%` }} />
            <span className="absolute -top-1 h-4.5 w-0.5 bg-[#86868b]" style={{ left: `${(business / stretch) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              {Math.round((total / business) * 100)}% of {formatINR(business)} business target
            </span>
            <span>Stretch {formatINR(stretch)}</span>
          </p>
        </div>
        <Stat label={`This month (${month.key})`} value={formatINR(monthRevenue)} />
        <Stat
          label="Pending verification"
          value={formatINR(pendingAmount)}
          detail={
            <Link href="/admin/verify" className="text-brand underline">
              {(pending ?? []).length} to verify
            </Link>
          }
        />
        <Stat label="Interns with a sale this month" value={`${sellers.size} of ${interns.size}`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Revenue by program month"
          note={byMonth.some((m) => m.target) ? "Dark tick = that month’s target." : "Set monthly targets in Settings to compare."}
        >
          <MonthColumns data={byMonth} />
        </Panel>
        <Panel title="Funnel" note="Leads that reached each step (all time).">
          <RankedBars data={funnel} unit="count" />
        </Panel>
        <Panel title="Revenue by course">
          <RankedBars data={byCourse} unit="inr" />
        </Panel>
        <Panel title="Revenue by source">
          <RankedBars data={bySource} unit="inr" />
        </Panel>
        <Panel title="Revenue by pod">
          <RankedBars data={byPod} unit="inr" />
        </Panel>
        <Panel title="Open leads by temperature" note={`${open.length} open leads`}>
          <div className="flex h-6 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={temps.map((x) => `${x.t} ${x.n}`).join(", ")}>
            {temps
              .filter((x) => x.n > 0)
              .map((x) => (
                <div key={x.t} style={{ width: `${(x.n / Math.max(1, open.length)) * 100}%`, background: TEMP_COLOURS[x.t] }} title={`${x.t}: ${x.n}`} />
              ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-4 text-sm">
            {temps.map((x) => (
              <li key={x.t} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: TEMP_COLOURS[x.t] }} />
                {x.t} <span className="font-medium">{x.n}</span>
                <span className="text-muted-foreground">({open.length ? Math.round((x.n / open.length) * 100) : 0}%)</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-6">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-xs">{detail}</p>}
    </div>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-6">
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      <div className={note ? "" : "mt-2"}>{children}</div>
    </section>
  )
}
