import { addDays, istDate } from "@/lib/leads"

/** The settings row fields that money screens need. */
export type ProgramSettings = {
  m1_start: string
  m2_start: string
  m3_start: string
  program_end: string
  milestone_m1: number
  milestone_m2: number
  milestone_m3: number
  stipend_min: number
  stipend_low_rate: number
  stipend_low_max: number
  stipend_mid_fixed: number
  stipend_mid_max: number
  stipend_high_fixed: number
  stipend_high_rate: number
}

export const PROGRAM_SETTINGS_COLUMNS =
  "m1_start, m2_start, m3_start, program_end, milestone_m1, milestone_m2, milestone_m3, stipend_min, stipend_low_rate, stipend_low_max, stipend_mid_fixed, stipend_mid_max, stipend_high_fixed, stipend_high_rate"

export type MonthKey = "M1" | "M2" | "M3"
export type Period = MonthKey | "month" | "all"

export type ProgramMonth = { key: MonthKey; start: string; end: string; milestone: number }

export function normalizeSettings(raw: Record<string, unknown>): ProgramSettings {
  const n = (k: string) => Number(raw[k])
  return {
    m1_start: String(raw.m1_start),
    m2_start: String(raw.m2_start),
    m3_start: String(raw.m3_start),
    program_end: String(raw.program_end),
    milestone_m1: n("milestone_m1"),
    milestone_m2: n("milestone_m2"),
    milestone_m3: n("milestone_m3"),
    stipend_min: n("stipend_min"),
    stipend_low_rate: n("stipend_low_rate"),
    stipend_low_max: n("stipend_low_max"),
    stipend_mid_fixed: n("stipend_mid_fixed"),
    stipend_mid_max: n("stipend_mid_max"),
    stipend_high_fixed: n("stipend_high_fixed"),
    stipend_high_rate: n("stipend_high_rate"),
  }
}

/** M1, M2, M3 with inclusive start and end dates (YYYY-MM-DD). */
export function programMonths(s: ProgramSettings): ProgramMonth[] {
  return [
    { key: "M1", start: s.m1_start, end: addDays(s.m2_start, -1), milestone: s.milestone_m1 },
    { key: "M2", start: s.m2_start, end: addDays(s.m3_start, -1), milestone: s.milestone_m2 },
    { key: "M3", start: s.m3_start, end: s.program_end, milestone: s.milestone_m3 },
  ]
}

/** The program month a date falls in. Before the start counts as M1, after the end as M3. */
export function monthFor(s: ProgramSettings, date = istDate()): ProgramMonth {
  const months = programMonths(s)
  if (date < months[1].start) return months[0]
  if (date < months[2].start) return months[1]
  return months[2]
}

/** Date range (inclusive) for a leaderboard period. "all" = the whole 90 days. */
export function periodRange(s: ProgramSettings, period: Period, today = istDate()): { start: string; end: string } {
  const months = programMonths(s)
  if (period === "all") return { start: "0000-01-01", end: "9999-12-31" }
  const m = period === "month" ? monthFor(s, today) : months.find((x) => x.key === period)!
  // M1 also counts anything dated before the program officially started.
  return { start: m.key === "M1" ? "0000-01-01" : m.start, end: m.key === "M3" ? "9999-12-31" : m.end }
}

export const inRange = (date: string, r: { start: string; end: string }) => date >= r.start && date <= r.end

/** Spec 6.4: estimated stipend for one program month of verified revenue. */
export function stipendFor(revenue: number, s: ProgramSettings): number {
  if (revenue < s.stipend_min) return 0
  if (revenue <= s.stipend_low_max) return Math.round(revenue * s.stipend_low_rate)
  if (revenue <= s.stipend_mid_max) return s.stipend_mid_fixed
  return Math.max(s.stipend_high_fixed, Math.round(revenue * s.stipend_high_rate))
}

/** The ₹65K / ₹80K / ₹1L marks on the meter. */
export function slabMarks(s: ProgramSettings): number[] {
  return [...new Set([s.stipend_low_max, s.stipend_mid_max, s.milestone_m3])].sort((a, b) => a - b)
}

/** The next mark above this revenue, or null once past them all. */
export function nextSlab(revenue: number, s: ProgramSettings): number | null {
  return slabMarks(s).find((m) => revenue < m) ?? null
}

/** Pro-rata status vs the month's milestone (spec 6.5). */
export function milestoneStatus(revenue: number, month: ProgramMonth, today = istDate()) {
  if (revenue >= month.milestone) return "Milestone hit" as const
  const elapsed = Math.min(30, Math.max(0, daysBetween(month.start, today) + 1))
  return revenue < (month.milestone * elapsed) / 30 ? ("Behind" as const) : ("On track" as const)
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Monday of the current Monday–Sunday week, in India time. */
export function istStartOfWeek(today = istDate()): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(today, dow === 0 ? -6 : 1 - dow)
}
