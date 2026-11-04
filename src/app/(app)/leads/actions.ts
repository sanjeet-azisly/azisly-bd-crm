"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { EMAIL_ERROR, PHONE_ERROR, isLikelyMobile, normalizeEmail, type ActionResult } from "@/lib/format"
import { LOST_REASONS, PERSONAS, SOURCES, STAGES, type BantKey, type Lead } from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)

const leadFields = z.object({
  name: z.string().trim().min(2, "Name must be 2–80 characters.").max(80, "Name must be 2–80 characters."),
  phone: z.string().refine(isLikelyMobile, PHONE_ERROR),
  email: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const e = normalizeEmail(v)
      if (e === "invalid") {
        ctx.addIssue({ code: "custom", message: EMAIL_ERROR })
        return z.NEVER
      }
      return e
    }),
  persona: z.enum(PERSONAS).nullable(),
  college: optionalText(120),
  city: optionalText(80),
  source: z.enum(SOURCES, { message: "Pick where this lead came from." }),
  course_id: z.uuid().nullable(),
})

const newLeadSchema = leadFields.extend({
  next_follow_up: z.iso.date().nullable(),
})

const dateField = z.iso.date({ message: "Pick a valid date." }).nullable()

const NOT_ALLOWED = "You can’t change this lead."

function refresh(leadId?: string) {
  revalidatePath("/leads")
  revalidatePath("/today")
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Check the form and try again."
}

async function duplicateMessage(phone: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc("find_lead_by_phone", { p_phone: phone })
  const hit = (data as { lead_id: string | null; owner_name: string; stage: string }[] | null)?.[0]
  if (!hit) return null
  return {
    message: `This number is already with ${hit.owner_name} (${hit.stage}). Ask your pod leader before working it.`,
    leadId: hit.lead_id,
  }
}

/** Flag the blocked duplicate for the admin (Admin → Flagged leads). */
async function flagDuplicate(phone: string, name: string, email: string | null, via: "add_lead" | "edit_lead") {
  const supabase = await createClient()
  await supabase.rpc("log_duplicate_attempt", { p_phone: phone, p_name: name, p_email: email, p_via: via })
  revalidatePath("/admin/flags")
}

export type AddLeadResult = ActionResult<{ id: string }> & { duplicateLeadId?: string | null }

export async function createLead(input: unknown): Promise<AddLeadResult> {
  await requireUser()
  const parsed = newLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const dup = await duplicateMessage(parsed.data.phone)
  if (dup) {
    await flagDuplicate(parsed.data.phone, parsed.data.name, parsed.data.email, "add_lead")
    return { ok: false, error: dup.message, duplicateLeadId: dup.leadId }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from("leads").insert(parsed.data).select("id").single()
  if (error) {
    if (error.code === "23505") {
      await flagDuplicate(parsed.data.phone, parsed.data.name, parsed.data.email, "add_lead")
      const again = await duplicateMessage(parsed.data.phone)
      return { ok: false, error: again?.message ?? "This number is already in the CRM.", duplicateLeadId: again?.leadId }
    }
    return { ok: false, error: error.message }
  }
  refresh()
  return { ok: true, data: { id: data.id } }
}

export async function updateLeadDetails(id: string, input: unknown): Promise<AddLeadResult> {
  await requireUser()
  const parsed = leadFields.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const supabase = await createClient()
  const { data: current } = await supabase.from("leads").select("phone").eq("id", id).single()
  if (current && current.phone !== parsed.data.phone) {
    const dup = await duplicateMessage(parsed.data.phone)
    if (dup) {
      await flagDuplicate(parsed.data.phone, parsed.data.name, parsed.data.email, "edit_lead")
      return { ok: false, error: dup.message, duplicateLeadId: dup.leadId }
    }
  }
  const { data: rows, error } = await supabase.from("leads").update(parsed.data).eq("id", id).select("id")
  if (error) return { ok: false, error: error.code === "23505" ? "This number is already in the CRM." : error.message }
  if (!rows?.length) return { ok: false, error: NOT_ALLOWED }
  refresh(id)
  return { ok: true }
}

const BANT_KEYS = ["bant_b", "bant_a", "bant_n", "bant_t"] as const

export async function setBant(id: string, key: BantKey, value: boolean): Promise<ActionResult> {
  await requireUser()
  if (!BANT_KEYS.includes(key)) return { ok: false, error: "Unknown BANT item." }
  const supabase = await createClient()
  const { data: rows, error } = await supabase.from("leads").update({ [key]: value }).eq("id", id).select("id")
  if (error) return { ok: false, error: error.message }
  if (!rows?.length) return { ok: false, error: NOT_ALLOWED }
  refresh(id)
  return { ok: true }
}

const stageSchema = z
  .object({
    stage: z.enum(STAGES),
    lost_reason: z.enum(LOST_REASONS).nullable(),
  })
  .refine((s) => s.stage !== "Lost" || s.lost_reason, "Pick why this lead was lost.")

export async function setStage(id: string, input: unknown): Promise<ActionResult> {
  const me = await requireUser()
  const parsed = stageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  if (parsed.data.stage === "Won" && !me.isAdmin) {
    return { ok: false, error: "A lead becomes Won when its payment is verified." }
  }
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from("leads")
    .update({ stage: parsed.data.stage, lost_reason: parsed.data.stage === "Lost" ? parsed.data.lost_reason : null })
    .eq("id", id)
    .select("id")
  if (error) return { ok: false, error: error.message }
  if (!rows?.length) return { ok: false, error: NOT_ALLOWED }
  refresh(id)
  return { ok: true }
}

/** Lost / Nurture → back into the pipeline. */
export async function reopenLead(id: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()
  const { data: lead } = await supabase.from("leads").select("touches").eq("id", id).single()
  const { data: rows, error } = await supabase
    .from("leads")
    .update({ stage: lead && lead.touches > 0 ? "Talking" : "New", lost_reason: null })
    .eq("id", id)
    .select("id")
  if (error) return { ok: false, error: error.message }
  if (!rows?.length) return { ok: false, error: NOT_ALLOWED }
  refresh(id)
  return { ok: true }
}

const touchSchema = z.object({
  type: z.enum(["call", "whatsapp", "demo", "note"]),
  note: z.string().trim().max(2000, "Keep the note under 2,000 characters."),
  next_follow_up: dateField,
})

export async function logTouch(id: string, input: unknown): Promise<ActionResult<{ touches: number }>> {
  await requireUser()
  const parsed = touchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  if (parsed.data.type === "note" && !parsed.data.note) return { ok: false, error: "Write the note." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("log_touch", {
    p_lead: id,
    p_type: parsed.data.type,
    p_note: parsed.data.note,
    p_next: parsed.data.next_follow_up,
  })
  if (error) return { ok: false, error: error.message }
  refresh(id)
  return { ok: true, data: { touches: (data as Lead).touches } }
}

export async function setFollowUp(id: string, date: string | null): Promise<ActionResult> {
  await requireUser()
  const parsed = dateField.safeParse(date)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const supabase = await createClient()
  const { data: rows, error } = await supabase.from("leads").update({ next_follow_up: parsed.data }).eq("id", id).select("id")
  if (error) return { ok: false, error: error.message }
  if (!rows?.length) return { ok: false, error: NOT_ALLOWED }
  refresh(id)
  return { ok: true }
}

export async function reassignLead(id: string, ownerId: string): Promise<ActionResult> {
  await requireUser()
  if (!z.uuid().safeParse(ownerId).success) return { ok: false, error: "Pick a team member." }
  const supabase = await createClient()
  // The database only allows admins, or a pod leader moving a lead within their pod.
  const { data: rows, error } = await supabase.from("leads").update({ owner_id: ownerId }).eq("id", id).select("id")
  if (error) return { ok: false, error: error.message }
  if (!rows?.length) return { ok: false, error: NOT_ALLOWED }
  refresh(id)
  return { ok: true }
}

/** Admin: hand many leads to one person at once (spec 5.10.6). */
export async function bulkReassign(ids: string[], ownerId: string): Promise<ActionResult<{ moved: number }>> {
  const me = await requireUser()
  if (!me.isAdmin) return { ok: false, error: "Only admins can bulk reassign." }
  const parsedIds = z.array(z.uuid()).min(1, "Tick at least one lead.").max(500).safeParse(ids)
  if (!parsedIds.success) return { ok: false, error: parsedIds.error.issues[0].message }
  if (!z.uuid().safeParse(ownerId).success) return { ok: false, error: "Pick a team member." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .update({ owner_id: ownerId })
    .in("id", parsedIds.data)
    .neq("owner_id", ownerId)
    .select("id")
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true, data: { moved: data?.length ?? 0 } }
}
