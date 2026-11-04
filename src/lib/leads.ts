import type { ChipTone } from "@/components/chip"

/** New → Talking → Demo done → Payment pending, then an outcome: Won / Lost / Nurture. */
export const STAGES = ["New", "Talking", "Demo done", "Payment pending", "Won", "Lost", "Nurture"] as const
export type Stage = (typeof STAGES)[number]

export const OPEN_STAGES: Stage[] = ["New", "Talking", "Demo done", "Payment pending"]
export const CLOSED_STAGES: Stage[] = ["Won", "Lost", "Nurture"]
export const isOpen = (stage: Stage) => OPEN_STAGES.includes(stage)

/** What each step means, shown as a hint on the lead page. */
export const STAGE_HINT: Record<Stage, string> = {
  New: "Not contacted yet",
  Talking: "In conversation – moves here on the first call or WhatsApp",
  "Demo done": "Had a demo or webinar – moves here when you log one",
  "Payment pending": "Payment link sent – waiting for the payment",
  Won: "Payment verified",
  Lost: "Not buying",
  Nurture: "Not now – keep warm for later",
}

export const PERSONAS = [
  "Student",
  "Fresh graduate",
  "Working professional",
  "Parent",
  "College (B2B)",
  "Corporate (B2B)",
] as const
export type Persona = (typeof PERSONAS)[number]

export const SOURCES = [
  "Campus",
  "WhatsApp",
  "LinkedIn",
  "Instagram",
  "Fests & events",
  "Alumni",
  "Referral",
  "Webinar",
  "Course page",
  "Company-provided",
  "B2B meeting",
] as const
export type Source = (typeof SOURCES)[number]

export const LOST_REASONS = ["Price", "Not interested", "No response", "Chose another option", "Other"] as const
export type LostReason = (typeof LOST_REASONS)[number]

export const TEMPERATURES = ["Hot", "Warm", "Cold", "Won", "Closed"] as const
export type Temperature = (typeof TEMPERATURES)[number]

/** Each stage has its own soft colour so a list reads at a glance. */
export const STAGE_TONE: Record<Stage, ChipTone> = {
  New: "violet",
  Talking: "teal",
  "Demo done": "pink",
  "Payment pending": "amber",
  Won: "green",
  Lost: "red",
  Nurture: "grey",
}

export const TEMPERATURE_TONE: Record<Temperature, ChipTone> = {
  Hot: "red",
  Warm: "amber",
  Cold: "blue",
  Won: "green",
  Closed: "grey",
}

const TEMPERATURE_ORDER: Record<Temperature, number> = { Hot: 0, Warm: 1, Cold: 2, Won: 3, Closed: 4 }
export const temperatureRank = (t: Temperature) => TEMPERATURE_ORDER[t]

export const BANT = [
  { key: "bant_b", label: "Budget", hint: "Can pay the offer price, or someone will pay for them." },
  { key: "bant_a", label: "Authority", hint: "Decides alone, or the decider (often a parent) is in the conversation." },
  { key: "bant_n", label: "Need", hint: "Has a clear goal this course serves." },
  { key: "bant_t", label: "Timeline", hint: "Ready to decide within 7 days." },
] as const
export type BantKey = (typeof BANT)[number]["key"]

export const TOUCH_TYPES = [
  { type: "call", label: "Called" },
  { type: "whatsapp", label: "WhatsApp" },
  { type: "demo", label: "Demo / webinar" },
  { type: "note", label: "Note" },
] as const
export type TouchType = (typeof TOUCH_TYPES)[number]["type"]

export const TOUCH_LIMIT = 7
export const SEVEN_TOUCH_BANNER = "7 touches done. Move this lead to Nurture or Lost, or log a payment."

export type Lead = {
  id: string
  owner_id: string
  pod_id: string | null
  name: string
  phone: string
  email: string | null
  persona: Persona | null
  college: string | null
  city: string | null
  source: Source
  course_id: string | null
  bant_b: boolean
  bant_a: boolean
  bant_n: boolean
  bant_t: boolean
  stage: Stage
  lost_reason: LostReason | null
  touches: number
  last_touched_at: string | null
  next_follow_up: string | null
  help_requested: boolean
  stage_changed_at: string
  created_at: string
  assigned_at?: string
  temperature: Temperature
}

export type LeadEvent = {
  id: string
  lead_id: string
  user_id: string | null
  type: string
  note: string | null
  counts_as: string | null
  created_at: string
}

// --- Dates: "today" always means today in India, whatever the phone's clock zone.

const IST_OFFSET_MIN = 330

/** YYYY-MM-DD for a date in India time. */
export function istDate(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Midnight today in India, as an ISO timestamp (for "today's activity"). */
export function istStartOfToday(): string {
  return new Date(`${istDate()}T00:00:00+05:30`).toISOString()
}

/** Sunday that ends this Monday–Sunday week, in India time. */
export function istEndOfWeek(today = istDate()): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(today, dow === 0 ? 0 : 7 - dow)
}

export type FollowUpFilter = "overdue" | "today" | "week" | "none"

export function followUpBucket(next: string | null, today = istDate()): FollowUpFilter | "later" {
  if (!next) return "none"
  if (next < today) return "overdue"
  if (next === today) return "today"
  if (next <= istEndOfWeek(today)) return "week"
  return "later"
}

export function formatDay(isoDate: string | null, today = istDate()): string {
  if (!isoDate) return "No follow-up"
  if (isoDate === today) return "Today"
  if (isoDate === addDays(today, 1)) return "Tomorrow"
  if (isoDate === addDays(today, -1)) return "Yesterday"
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  })
}

export function whatsappUrl(phone: string, text?: string) {
  return `https://wa.me/91${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

export function callUrl(phone: string) {
  return `tel:+91${phone}`
}

/** "Due today": open leads with a follow-up today or earlier, Hot first, then the oldest due date. */
export function sortDue<T extends Pick<Lead, "temperature" | "next_follow_up">>(leads: T[]): T[] {
  return [...leads].sort(
    (a, b) =>
      temperatureRank(a.temperature) - temperatureRank(b.temperature) ||
      (a.next_follow_up ?? "").localeCompare(b.next_follow_up ?? "")
  )
}

export function courseLink(origin: string, slug: string, referralCode: string | null) {
  return `${origin}/${slug}${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ""}`
}

export const HELP_REASONS = ["Parent call", "Price objection", "Demo needed", "Other"] as const

/**
 * Rule 6.2: an open lead untouched for the pool hours (or whose owner was deactivated)
 * sits in its pod's pool. Same rule as the database's lead_in_pool().
 */
export function isInPool(
  lead: Pick<Lead, "stage" | "last_touched_at" | "created_at"> & { assigned_at?: string | null },
  poolHours: number,
  ownerActive = true,
  now = Date.now()
): boolean {
  if (!isOpen(lead.stage)) return false
  if (!ownerActive) return true
  const lastActivity = Math.max(
    Date.parse(lead.last_touched_at ?? lead.created_at),
    lead.assigned_at ? Date.parse(lead.assigned_at) : 0
  )
  return now - lastActivity > poolHours * 3_600_000
}
