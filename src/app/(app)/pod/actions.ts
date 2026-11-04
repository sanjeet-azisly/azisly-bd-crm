"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

const HELP_REASONS = ["Parent call", "Price objection", "Demo needed", "Other"] as const

function refresh(leadId?: string) {
  revalidatePath("/pod")
  revalidatePath("/pool")
  revalidatePath("/leads")
  revalidatePath("/today")
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

/** Spec 5.4.7: ask your pod leader for help on a lead. */
export async function askForHelp(leadId: string, input: unknown): Promise<ActionResult> {
  const me = await requireUser()
  const parsed = z
    .object({ reason: z.enum(HELP_REASONS, { message: "Pick what you need help with." }), note: z.string().trim().max(1000) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.from("help_requests").insert({
    lead_id: leadId,
    requested_by: me.profile.id,
    reason: parsed.data.reason,
    note: parsed.data.note || null,
  })
  if (error) return { ok: false, error: error.message }
  refresh(leadId)
  return { ok: true }
}

async function setHelpStatus(id: string, status: "Taken" | "Handled"): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from("help_requests").update({ status }).eq("id", id).select("lead_id").maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Only the pod leader or an admin can do this." }
  refresh(data.lead_id)
  return { ok: true }
}

/** "Take it": the pod leader becomes the helper. */
export async function takeHelp(id: string) {
  return setHelpStatus(id, "Taken")
}

export async function markHelpHandled(id: string) {
  return setHelpStatus(id, "Handled")
}

/** Rule 6.2: claim a lead from your pod's pool. */
export async function claimLead(leadId: string): Promise<ActionResult> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("claim_lead", { p_lead: leadId })
  if (error) return { ok: false, error: error.message }
  refresh(leadId)
  return { ok: true }
}
