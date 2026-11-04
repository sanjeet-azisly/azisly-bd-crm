"use server"

import { z } from "zod"
import { EMAIL_ERROR, PHONE_ERROR, firstName, normalizeEmail, normalizePhone } from "@/lib/format"
import { istDate } from "@/lib/leads"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPublicCourse, getReferrer } from "./data"

const schema = z.object({
  slug: z.string(),
  ref: z.string().optional(),
  name: z.string().trim().min(2, "Please enter your name.").max(80, "That name is too long."),
  phone: z.string(),
  email: z.string().optional(),
  city: z.string().trim().max(80, "That city name is too long."),
  consent: z.literal(true, { message: "Please tick the box so we can contact you." }),
  // Honeypot: real people never see or fill this field.
  website: z.string().optional(),
})

export type InterestResult = { ok: true; referrerFirstName: string | null } | { ok: false; error: string }

/**
 * "I'm interested" (spec 5.6). The only way a logged-out visitor can write to the CRM:
 * it creates a New lead for the referring intern, or notes repeat interest on the existing lead.
 */
export async function submitInterest(input: unknown): Promise<InterestResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  const phone = normalizePhone(v.phone)
  if (!phone || phone === "invalid") return { ok: false, error: PHONE_ERROR }
  const email = normalizeEmail(v.email)
  if (email === "invalid") return { ok: false, error: EMAIL_ERROR }

  const course = await getPublicCourse(v.slug)
  if (!course) return { ok: false, error: "This course page is no longer available." }
  const referrer = await getReferrer(v.ref)
  const referrerFirstName = referrer ? firstName(referrer.full_name) : null
  if (v.website) return { ok: true, referrerFirstName } // bot: pretend it worked

  const db = createAdminClient()
  // No (valid) referral code: the lead goes to the program admin so it isn't lost.
  let ownerId = referrer?.id ?? null
  if (!ownerId) {
    const { data: admin } = await db
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle()
    ownerId = admin?.id ?? null
  }
  if (!ownerId) return { ok: false, error: "Something went wrong. Please try again later." }

  const via = referrerFirstName ? `${referrerFirstName}'s link` : "the course page"
  const { data: existing } = await db.from("leads").select("id, owner_id, email").eq("phone", phone).maybeSingle()
  if (existing) {
    // Keep a newly given email if the lead didn't have one yet.
    if (email && !existing.email) await db.from("leads").update({ email }).eq("id", existing.id)
    // Spec 5.6.4: no duplicate; the existing owner gets a timeline entry instead.
    const since = new Date(Date.now() - 60 * 60_000).toISOString()
    const { count } = await db
      .from("lead_events")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", existing.id)
      .eq("type", "interest_again")
      .gte("created_at", since)
    if (!count) {
      // Flag it for the admin too (Admin → Flagged leads).
      await db.from("duplicate_attempts").insert({
        lead_id: existing.id,
        phone,
        attempted_name: v.name,
        attempted_email: email,
        via: "course_page",
        referrer_id: referrer?.id ?? null,
      })
      await db.from("lead_events").insert({
        lead_id: existing.id,
        type: "interest_again",
        note: `Submitted interest again via ${via}`,
      })
      await db.from("notifications").insert({
        user_id: existing.owner_id,
        text: `${v.name} submitted interest again via ${via} (${course.short_name})`,
        link: `/leads/${existing.id}`,
      })
    }
    return { ok: true, referrerFirstName }
  }

  const { data: lead, error } = await db
    .from("leads")
    .insert({
      owner_id: ownerId,
      name: v.name,
      phone,
      email,
      city: v.city || null,
      source: "Course page",
      course_id: course.id,
      stage: "New",
      next_follow_up: istDate(),
    })
    .select("id")
    .single()
  if (error) {
    // Someone else submitted the same number a moment ago.
    if (error.code === "23505") return { ok: true, referrerFirstName }
    return { ok: false, error: "Something went wrong. Please try again." }
  }
  await db.from("notifications").insert({
    user_id: ownerId,
    text: `New lead from your ${course.short_name} page: ${v.name}`,
    link: `/leads/${lead.id}`,
  })
  return { ok: true, referrerFirstName }
}
