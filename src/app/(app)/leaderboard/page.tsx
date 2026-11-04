import Link from "next/link"
import { Flame, TrendingUp, UserPlus } from "lucide-react"
import { Chip } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { Avatar, RankBadge } from "@/components/people"
import { requireUser } from "@/lib/auth"
import { formatINR } from "@/lib/format"
import { buildLeaderboard, loadLeaderboardData, weeklyHighlights } from "@/lib/leaderboard"
import { istDate } from "@/lib/leads"
import { monthFor, type Period } from "@/lib/program"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Leaderboard · Azisly BD CRM" }

const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "M1", label: "M1" },
  { key: "M2", label: "M2" },
  { key: "M3", label: "M3" },
  { key: "all", label: "All 90 days" },
]

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const sp = await searchParams
  const period = PERIODS.find((p) => p.key === sp.period)?.key ?? "month"
  const view = sp.view === "pods" ? "pods" : "people"
  const me = await requireUser()
  const supabase = await createClient()
  const today = istDate()
  const data = await loadLeaderboardData(supabase)
  const { individuals, pods } = buildLeaderboard(data, period, today)
  const highlights = weeklyHighlights(data, today)
  const current = monthFor(data.settings, today)
  const href = (p: Period, v = view) => `/leaderboard?period=${p}&view=${v}`

  return (
    <>
      <PageHeader title="Leaderboard" description="Only verified payments count." />

      {/* Weekly highlights (Monday–Sunday) */}
      <section aria-label="This week" className="mb-5 grid gap-2 sm:grid-cols-3">
        <Highlight
          tint="bg-[#fff1e6]"
          icon={<Flame className="size-5 text-[#f97316]" />}
          label="Top seller this week"
          value={highlights.topSeller ? highlights.topSeller.name : "–"}
          detail={highlights.topSeller ? formatINR(highlights.topSeller.revenue) : "No verified sales yet"}
        />
        <Highlight
          tint="bg-[#e1f6e8]"
          icon={<TrendingUp className="size-5 text-[#16a34a]" />}
          label="Biggest climber"
          value={highlights.climber ? highlights.climber.name : "–"}
          detail={highlights.climber ? `#${highlights.climber.from} → #${highlights.climber.to}` : "No rank changes yet"}
        />
        <Highlight
          tint="bg-brand-soft"
          icon={<UserPlus className="size-5 text-brand" />}
          label="Most leads added"
          value={highlights.mostLeads ? highlights.mostLeads.name : "–"}
          detail={highlights.mostLeads ? `${highlights.mostLeads.count} leads` : "No leads yet this week"}
        />
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex rounded-full bg-surface p-1 text-sm" aria-label="People or pods">
          <Link href={href(period, "people")} className={cn("rounded-full px-4 py-2", view === "people" && "bg-brand-soft font-medium text-brand")}>
            Individuals
          </Link>
          <Link href={href(period, "pods")} className={cn("rounded-full px-4 py-2", view === "pods" && "bg-brand-soft font-medium text-brand")}>
            Pods
          </Link>
        </nav>
        <nav className="flex gap-1 overflow-x-auto text-sm" aria-label="Period">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href(p.key)}
              className={cn(
                "rounded-full border px-3 py-1 whitespace-nowrap",
                period === p.key ? "border-brand bg-brand text-white" : "bg-white hover:bg-muted"
              )}
            >
              {p.label}
              {p.key === "month" && ` (${current.key})`}
            </Link>
          ))}
        </nav>
      </div>

      {view === "people" ? (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-4 pr-2 pl-6 font-medium">Rank</th>
                <th className="px-3 py-4 font-medium">Intern</th>
                <th className="px-3 py-4 text-right font-medium">Verified revenue</th>
                <th className="px-3 py-4 text-right font-medium">Deals</th>
                <th className="px-3 py-4 text-right font-medium">Conversion</th>
                <th className="py-4 pr-6 pl-3 font-medium">Next slab</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {individuals.map((r) => {
                const isMe = r.id === me.profile.id
                return (
                  <tr key={r.id} className={cn(isMe && "bg-brand-soft/60")}>
                    <td className="py-4 pr-2 pl-6">
                      <RankBadge rank={r.rank} />
                    </td>
                    <td className="px-3 py-4">
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} colour={r.podColour} />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {r.name} {isMe && <span className="text-xs font-normal text-brand">(you)</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{r.podName ?? "No pod"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right text-base font-semibold">{formatINR(r.revenue)}</td>
                    <td className="px-3 py-4 text-right">{r.deals}</td>
                    <td className="px-3 py-4 text-right">{r.conversion === null ? "–" : `${r.conversion}%`}</td>
                    <td className="py-4 pr-6 pl-3">
                      {r.gap ? (
                        <span className="block min-w-40">
                          <span className="flex justify-between text-xs">
                            <span className="font-medium">{formatINR(r.gap.amount)} to go</span>
                            <span className="text-muted-foreground">{formatINR(r.gap.slab)}</span>
                          </span>
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                            <span
                              className="block h-full rounded-full bg-brand"
                              style={{ width: `${Math.min(100, (r.revenue / r.gap.slab) * 100)}%` }}
                            />
                          </span>
                        </span>
                      ) : period === "all" ? (
                        <span className="text-muted-foreground">–</span>
                      ) : (
                        <Chip tone="green">All slabs hit</Chip>
                      )}
                    </td>
                  </tr>
                )
              })}
              {individuals.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No interns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-4 pr-2 pl-6 font-medium">Rank</th>
                <th className="px-3 py-4 font-medium">Pod</th>
                <th className="px-3 py-4 text-right font-medium">Members</th>
                <th className="px-3 py-4 text-right font-medium">Verified revenue</th>
                <th className="px-3 py-4 text-right font-medium">Per member</th>
                <th className="py-4 pr-6 pl-3 text-right font-medium">Deals</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pods.map((p) => (
                <tr key={p.id} className={cn(p.id === me.profile.pod_id && "bg-brand-soft/60")}>
                  <td className="py-4 pr-2 pl-6">
                    <RankBadge rank={p.rank} />
                  </td>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-3">
                      <Avatar name={p.name} colour={p.colour} />
                      <span className="font-medium">{p.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right">{p.members}</td>
                  <td className="px-3 py-4 text-right text-base font-semibold">{formatINR(p.revenue)}</td>
                  <td className="px-3 py-4 text-right">{formatINR(p.perMember)}</td>
                  <td className="py-4 pr-6 pl-3 text-right">{p.deals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Conversion = won ÷ leads added in the period. Revenue counts by payment date, net of refunds.
      </p>
    </>
  )
}

function Highlight({
  icon,
  tint,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-surface p-6">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", tint)}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="mt-0.5 block truncate text-lg font-semibold">{value}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
    </div>
  )
}
