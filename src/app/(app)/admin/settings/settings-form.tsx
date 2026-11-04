"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatINR } from "@/lib/format"
import { saveSettings } from "./actions"

export type SettingsValues = Record<
  | "m1_start" | "m2_start" | "m3_start" | "program_end"
  | "milestone_m1" | "milestone_m2" | "milestone_m3"
  | "stipend_min" | "stipend_low_rate" | "stipend_low_max" | "stipend_mid_fixed" | "stipend_mid_max"
  | "stipend_high_fixed" | "stipend_high_rate"
  | "target_outreach" | "target_followups" | "target_demos"
  | "business_target" | "stretch_target" | "monthly_m1" | "monthly_m2" | "monthly_m3"
  | "pool_hours",
  string
>

const DATE_KEYS = ["m1_start", "m2_start", "m3_start", "program_end"]
const OPTIONAL_KEYS = ["monthly_m1", "monthly_m2", "monthly_m3"]

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const field = (key: keyof SettingsValues, label: string, opts: { suffix?: string; type?: "date" | "number" } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <div className="relative">
        <Input
          id={key}
          type={opts.type === "date" ? "date" : "text"}
          inputMode={opts.type === "date" ? undefined : "decimal"}
          value={v[key]}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
          className={opts.suffix ? "pr-10" : ""}
        />
        {opts.suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            {opts.suffix}
          </span>
        )}
      </div>
    </div>
  )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload: Record<string, string | number | null> = {}
    for (const [k, raw] of Object.entries(v)) {
      if (DATE_KEYS.includes(k)) {
        payload[k] = raw
        continue
      }
      const clean = raw.replace(/[,\s₹%]/g, "")
      if (!clean && OPTIONAL_KEYS.includes(k)) {
        payload[k] = null
        continue
      }
      if (!/^\d+(\.\d+)?$/.test(clean)) return setError("Use plain numbers only (no letters).")
      payload[k] = Number(clean)
    }
    setBusy(true)
    const res = await saveSettings(payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Settings saved")
    router.refresh()
  }

  const num = (k: keyof SettingsValues) => Number(v[k].replace(/[,\s₹%]/g, "")) || 0

  return (
    <form onSubmit={save} className="space-y-6 pb-4" noValidate>
      <Section title="Program dates" note="Program months run from each start date to the day before the next.">
        <div className="grid gap-3 sm:grid-cols-4">
          {field("m1_start", "M1 starts", { type: "date" })}
          {field("m2_start", "M2 starts", { type: "date" })}
          {field("m3_start", "M3 starts", { type: "date" })}
          {field("program_end", "Program ends", { type: "date" })}
        </div>
      </Section>

      <Section title="Intern milestones (₹ per month)">
        <div className="grid gap-3 sm:grid-cols-3">
          {field("milestone_m1", "M1 (own leads)")}
          {field("milestone_m2", "M2 (company leads)")}
          {field("milestone_m3", "M3 (incl. B2B)")}
        </div>
      </Section>

      <Section title="Stipend slabs (per program month, on verified revenue)">
        <div className="grid gap-5 sm:grid-cols-2">
          {field("stipend_min", "No stipend below (₹)")}
          {field("stipend_low_rate", "First slab: % of revenue", { suffix: "%" })}
          {field("stipend_low_max", "First slab: up to (₹)")}
          {field("stipend_mid_fixed", "Middle slab: fixed stipend (₹)")}
          {field("stipend_mid_max", "Middle slab: up to (₹)")}
          {field("stipend_high_fixed", "Top slab: at least (₹)")}
          {field("stipend_high_rate", "Top slab: or % of revenue, if higher", { suffix: "%" })}
        </div>
        <ul className="mt-3 space-y-0.5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <li>Below {formatINR(num("stipend_min"))} → ₹0</li>
          <li>
            {formatINR(num("stipend_min"))} – {formatINR(num("stipend_low_max"))} → {num("stipend_low_rate")}% of revenue
          </li>
          <li>
            {formatINR(num("stipend_low_max") + 1)} – {formatINR(num("stipend_mid_max"))} → {formatINR(num("stipend_mid_fixed"))} fixed
          </li>
          <li>
            {formatINR(num("stipend_mid_max") + 1)} and above → higher of {formatINR(num("stipend_high_fixed"))} or{" "}
            {num("stipend_high_rate")}% of revenue
          </li>
        </ul>
      </Section>

      <Section title="Daily activity targets">
        <div className="grid grid-cols-3 gap-3">
          {field("target_outreach", "Outreach")}
          {field("target_followups", "Follow-ups")}
          {field("target_demos", "Demos")}
        </div>
      </Section>

      <Section title="Cohort targets (₹)" note="Monthly split is optional; when set, the dashboard shows it against each month.">
        <div className="grid gap-5 sm:grid-cols-2">
          {field("business_target", "Business target (90 days)")}
          {field("stretch_target", "Stretch target (90 days)")}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {field("monthly_m1", "M1 target (optional)")}
          {field("monthly_m2", "M2 target (optional)")}
          {field("monthly_m3", "M3 target (optional)")}
        </div>
      </Section>

      <Section title="Pool" note="Open leads with no touch for this long move to the pod’s pool.">
        <div className="max-w-40">{field("pool_hours", "Pool after", { suffix: "hrs" })}</div>
      </Section>

      {error && (
        <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </p>
      )}
      <div className="sticky bottom-16 rounded-xl border bg-white/90 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Button type="submit" className="h-10" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-6">
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mb-3 text-xs text-muted-foreground">{note}</p>}
      <div className={note ? "" : "mt-3"}>{children}</div>
    </section>
  )
}
