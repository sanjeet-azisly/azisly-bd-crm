const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

/** ₹1,50,000 style (Indian grouping). */
export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–"
  return inr.format(value)
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** URL paths the app itself uses, so a course page can never take them. */
export const RESERVED_SLUGS = new Set([
  "login", "logout", "auth", "api", "today", "leads", "courses", "admin", "leaderboard", "leaderboards",
  "pod", "pods", "pool", "team", "settings", "dashboard", "payments", "help", "profile", "c",
])

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string }

/**
 * Indian mobile number → 10 digits. Accepts "+91 98765 43210", "098765-43210" etc.
 * Returns null for empty input and "invalid" when it isn't a believable mobile number.
 */
export function normalizePhone(raw: unknown): string | null | "invalid" {
  let digits = String(raw ?? "").replace(/\D/g, "")
  if (!digits) return null
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  return isLikelyMobile(digits) ? digits : "invalid"
}

/**
 * Cuts junk entries: Indian mobiles are 10 digits starting 6–9, and numbers like
 * 9999999999 or 9876543210 are almost always made up.
 */
export function isLikelyMobile(digits: string): boolean {
  if (!/^[6-9][0-9]{9}$/.test(digits)) return false
  if (/^(\d)\1{9}$/.test(digits)) return false
  if (digits === "9876543210" || digits === "6789012345") return false
  return true
}

/** Optional email: empty → null, otherwise trimmed + lower-cased, or "invalid". */
export function normalizeEmail(raw: unknown): string | null | "invalid" {
  const email = String(raw ?? "").trim().toLowerCase()
  if (!email) return null
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) ? email : "invalid"
}

export const EMAIL_ERROR = "Enter a valid email address, or leave it empty."

export const PHONE_ERROR = "Enter a valid 10-digit mobile number."

/** True for the "[To be filled in by admin]" / "[TBD]" placeholders in seeded course content. */
export function isPlaceholder(text: string | null | undefined): boolean {
  return !text || !text.trim() || /^\s*\[(to be filled|tbd|confirm)/i.test(text)
}

/** Spec 6.6 – shown at the bottom of the Courses hub. */
export const SELLING_RULES = [
  "Never promise a job, placement or salary.",
  "Only quote official prices and share official payment links.",
  "Never collect money personally.",
]
