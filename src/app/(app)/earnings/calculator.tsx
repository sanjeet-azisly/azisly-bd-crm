"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Chip } from "@/components/chip"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatINR } from "@/lib/format"
import { nextSlab, stipendFor, type ProgramSettings } from "@/lib/program"
import { cn } from "@/lib/utils"

export type CalcCourse = { id: string; short_name: string; name: string; offer_price: number; tier: string }

type Props = {
  mode: "intern" | "manager" | "both"
  courses: CalcCourse[]
  settings: ProgramSettings
  monthLabel: string
  milestone: number
  verifiedSoFar: number
  commissionPct: number | null
  internCount: number
  podName: string | null
}

const pct = (r: number) => `${Math.round(r * 1000) / 10}%`

export function Calculator(props: Props) {
  const { courses, settings, verifiedSoFar } = props
  const [view, setView] = useState<"intern" | "manager">(props.mode === "manager" ? "manager" : "intern")
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [includeSoFar, setIncludeSoFar] = useState(verifiedSoFar > 0)
  const [share, setShare] = useState(props.commissionPct === null ? "" : String(props.commissionPct))

  const planned = courses.reduce((s, c) => s + (counts[c.id] ?? 0) * c.offer_price, 0)
  const deals = Object.values(counts).reduce((s, n) => s + n, 0)
  const base = includeSoFar && props.mode !== "both" ? verifiedSoFar : 0
  const total = base + planned
  const set = (id: string, n: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(999, n)) }))

  const stipend = stipendFor(total, settings)
  // The first goal is the stipend's starting line, then the slab marks.
  const slab = total < settings.stipend_min ? settings.stipend_min : nextSlab(total, settings)
  const shareNum = Number(share) || 0
  const managerEarning = Math.round((total * shareNum) / 100)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        {props.mode === "both" && (
          <nav className="flex gap-1 rounded-full bg-surface p-1 text-sm" aria-label="Calculator for">
            {(["intern", "manager"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 rounded-full px-4 py-2",
                  view === v ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "intern" ? "Intern’s stipend" : "Manager’s share"}
              </button>
            ))}
          </nav>
        )}

        <ul className="divide-y rounded-2xl bg-surface">
          {courses.map((c) => {
            const n = counts[c.id] ?? 0
            return (
              <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.short_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatINR(c.offer_price)}
                    {n > 0 && <span className="text-foreground"> · {formatINR(n * c.offer_price)}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`One less ${c.short_name}`}
                    onClick={() => set(c.id, n - 1)}
                    disabled={n === 0}
                    className="flex size-9 items-center justify-center rounded-full bg-muted hover:bg-black/10 disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    aria-label={`${c.short_name} sales`}
                    inputMode="numeric"
                    value={n}
                    onChange={(e) => set(c.id, Number(e.target.value.replace(/\D/g, "")) || 0)}
                    className="w-12 rounded-lg bg-transparent text-center text-lg font-semibold tabular-nums outline-none focus:bg-muted"
                  />
                  <button
                    type="button"
                    aria-label={`One more ${c.short_name}`}
                    onClick={() => set(c.id, n + 1)}
                    className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand hover:bg-brand hover:text-white"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
          {courses.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No active courses yet.</li>}
        </ul>
        {deals > 0 && (
          <button type="button" onClick={() => setCounts({})} className="text-sm text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl bg-surface p-6">
          <p className="text-xs text-muted-foreground">{props.monthLabel}</p>
          {props.mode !== "both" && verifiedSoFar > 0 && (
            <label className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span>
                Add {view === "manager" ? `${props.podName ?? "pod"}’s` : "my"} verified sales so far
                <span className="block text-muted-foreground">{formatINR(verifiedSoFar)} this month</span>
              </span>
              <Switch checked={includeSoFar} onCheckedChange={setIncludeSoFar} aria-label="Include verified sales so far" />
            </label>
          )}
          <dl className="mt-5 space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">
                {deals} {deals === 1 ? "sale" : "sales"} planned
              </dt>
              <dd className="font-medium tabular-nums">{formatINR(planned)}</dd>
            </div>
            <div className="flex items-end justify-between border-t pt-3">
              <dt className="text-sm text-muted-foreground">Month revenue</dt>
              <dd className="font-heading text-2xl font-semibold tabular-nums">{formatINR(total)}</dd>
            </div>
          </dl>
        </div>

        {view === "intern" ? (
          <div className="rounded-2xl bg-[#e1f6e8] p-6 text-[#14532d]">
            <p className="text-sm">Estimated stipend</p>
            <p className="font-heading text-4xl font-semibold tabular-nums">{formatINR(stipend)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {total >= props.milestone && <Chip tone="green">Month milestone hit</Chip>}
              {slab && total > 0 && (
                <span className="text-sm">
                  {formatINR(slab - total)} more reaches the {formatINR(slab)} slab ({formatINR(stipendFor(slab, settings))}).
                </span>
              )}
            </div>
            <p className="mt-3 text-xs opacity-75">Only verified payments count. Final after verification.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#eaeefe] p-6 text-[#1e2f8f]">
            <p className="text-sm">Your share{props.mode === "manager" && props.podName ? ` of ${props.podName}` : ""}</p>
            <p className="font-heading text-4xl font-semibold tabular-nums">{formatINR(managerEarning)}</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              at
              <Input
                inputMode="decimal"
                value={share}
                disabled={props.mode === "manager"}
                onChange={(e) => setShare(e.target.value.replace(/[^0-9.]/g, ""))}
                className="h-8 w-16 bg-white text-center"
                aria-label="Share in percent"
              />
              % of the pod’s verified revenue
            </label>
            {props.mode === "manager" && props.commissionPct === null && (
              <p className="mt-2 text-xs">Your share hasn’t been set yet – ask the admin.</p>
            )}
            {props.internCount > 0 && total > 0 && (
              <p className="mt-3 text-sm">
                That’s about {formatINR(Math.round(total / props.internCount))} per intern across {props.internCount}{" "}
                {props.internCount === 1 ? "intern" : "interns"}.
              </p>
            )}
          </div>
        )}

        {view === "intern" && (
          <div className="rounded-2xl bg-surface p-6 text-sm">
            <p className="mb-3 font-medium">How the stipend works (per month)</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>Below {formatINR(settings.stipend_min)}: no stipend</li>
              <li>
                Up to {formatINR(settings.stipend_low_max)}: {pct(settings.stipend_low_rate)} of revenue
              </li>
              <li>
                Up to {formatINR(settings.stipend_mid_max)}: {formatINR(settings.stipend_mid_fixed)} fixed
              </li>
              <li>
                Above that: {formatINR(settings.stipend_high_fixed)} or {pct(settings.stipend_high_rate)}, whichever is higher
              </li>
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
