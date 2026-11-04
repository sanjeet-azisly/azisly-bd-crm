import Link from "next/link"
import { ChevronRight, Trophy } from "lucide-react"
import { formatINR } from "@/lib/format"
import { formatDay } from "@/lib/leads"
import { nextSlab, slabMarks, stipendFor, type ProgramMonth, type ProgramSettings } from "@/lib/program"
import { cn } from "@/lib/utils"

const short = (n: number) => (n >= 100000 ? `₹${n / 100000}L` : `₹${Math.round(n / 1000)}K`)

/** Spec 5.2.1: the most prominent thing on Today. */
export function RevenueMeter({
  revenue,
  month,
  settings,
  pending,
  rank,
}: {
  revenue: number
  month: ProgramMonth
  settings: ProgramSettings
  pending: { count: number; amount: number }
  rank: { rank: number; of: number } | null
}) {
  const marks = slabMarks(settings)
  const top = Math.max(marks[marks.length - 1], month.milestone) * 1.08
  const scaleMax = Math.max(top, revenue * 1.05)
  const pct = (n: number) => Math.min(100, (n / scaleMax) * 100)
  const hit = revenue >= month.milestone
  const slab = nextSlab(revenue, settings)
  const stipend = stipendFor(revenue, settings)

  return (
    <section className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#eef2ff_0%,#f7f9ff_55%,#ffffff_100%)] p-7 ring-1 ring-[#e1e7fd] sm:p-9" aria-label="Revenue this month">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Verified revenue · {month.key} ({formatDay(month.start)} – {formatDay(month.end)})
          </p>
          <p className="mt-1 font-heading text-5xl font-semibold tracking-tight sm:text-6xl">{formatINR(revenue)}</p>
        </div>
        {rank && (
          <Link
            href="/leaderboard"
            className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm hover:bg-white/80"
          >
            <Trophy className="size-4 text-[#d97706]" /> #{rank.rank} of {rank.of} this month
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        )}
      </div>

      {/* Progress bar with the milestone and slab marks */}
      <div className="relative mt-5 mb-7">
        <div className="h-3 overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className={cn("h-full rounded-full transition-all", hit ? "bg-[#16a34a]" : "bg-brand")}
            style={{ width: `${pct(revenue)}%` }}
          />
        </div>
        {marks.map((m) => (
          <div key={m} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pct(m)}%` }}>
            <span className={cn("h-3 w-0.5", revenue >= m ? "bg-black/15" : "bg-black/35")} />
            <span
              className={cn(
                "mt-1 text-[11px] whitespace-nowrap",
                m === month.milestone ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {short(m)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm font-medium">
        {hit ? (
          <>
            Milestone hit 🎉
            {slab && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {formatINR(slab - revenue)} to the {formatINR(slab)} slab
              </span>
            )}
          </>
        ) : slab ? (
          `${formatINR(slab - revenue)} to the ${formatINR(slab)} slab`
        ) : null}
      </p>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-black/10 pt-3">
        <div>
          <p className="text-xs text-muted-foreground">Estimated stipend</p>
          <p className="font-heading text-xl font-semibold">{formatINR(stipend)}</p>
          <p className="text-[11px] text-muted-foreground">Estimated – final after verification</p>
        </div>
        {pending.count > 0 && (
          <p className="rounded-full bg-[#fdf1d6] px-3 py-1 text-xs font-medium text-[#8a5300]">
            {pending.count} {pending.count === 1 ? "payment" : "payments"} pending verification ({formatINR(pending.amount)})
          </p>
        )}
      </div>
    </section>
  )
}
