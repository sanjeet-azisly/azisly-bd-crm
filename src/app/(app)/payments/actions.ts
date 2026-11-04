"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin, requireUser } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { istDate } from "@/lib/leads"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const BUCKET = "payment-screenshots"
const MAX_BYTES = 3 * 1024 * 1024
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }

const paymentSchema = z.object({
  lead_id: z.uuid(),
  course_id: z.uuid().nullable(),
  amount: z.coerce
    .number({ message: "Enter the amount." })
    .positive("Enter the amount.")
    .max(1000000, "That amount looks too large."),
  paid_on: z.iso.date({ message: "Pick the payment date." }),
  txn_ref: z
    .string()
    .trim()
    .min(3, "Enter the transaction / reference ID.")
    .max(100, "The transaction ID is too long."),
  assisted_by: z.uuid().nullable(),
})

function refresh(leadId?: string) {
  revalidatePath("/today")
  revalidatePath("/leads")
  revalidatePath("/leaderboard")
  revalidatePath("/admin/verify")
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

/** Log payment (spec 5.7.1). Takes a form so a screenshot can come along. */
export async function logPayment(form: FormData): Promise<ActionResult> {
  await requireUser()
  const parsed = paymentSchema.safeParse({
    lead_id: form.get("lead_id"),
    course_id: form.get("course_id") || null,
    amount: String(form.get("amount") ?? "").replace(/[,\s₹]/g, ""),
    paid_on: form.get("paid_on"),
    txn_ref: form.get("txn_ref") ?? "",
    assisted_by: form.get("assisted_by") || null,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (parsed.data.paid_on > istDate()) return { ok: false, error: "The payment date can’t be in the future." }

  const supabase = await createClient()
  // Row level security only shows leads this person may log payments for.
  const { data: lead } = await supabase.from("leads").select("id").eq("id", parsed.data.lead_id).maybeSingle()
  if (!lead) return { ok: false, error: "You can’t log a payment on this lead." }

  let screenshot_path: string | null = null
  const file = form.get("screenshot")
  if (file instanceof File && file.size > 0) {
    if (!TYPES[file.type]) return { ok: false, error: "The screenshot must be a JPG, PNG or WebP image." }
    if (file.size > MAX_BYTES) return { ok: false, error: "The screenshot is too big (max 3 MB)." }
    screenshot_path = `${lead.id}/${randomUUID()}.${TYPES[file.type]}`
    const { error } = await createAdminClient()
      .storage.from(BUCKET)
      .upload(screenshot_path, file, { contentType: file.type })
    if (error) return { ok: false, error: `Couldn’t upload the screenshot: ${error.message}` }
  }

  const { error } = await supabase.from("payments").insert({ ...parsed.data, screenshot_path })
  if (error) {
    if (screenshot_path) await createAdminClient().storage.from(BUCKET).remove([screenshot_path])
    if (error.code === "23505") return { ok: false, error: "This transaction ID was already logged." }
    return { ok: false, error: error.message }
  }
  refresh(lead.id)
  return { ok: true }
}

const reasonSchema = z.string().trim().min(3, "Write a short reason.").max(500)

async function changeStatus(id: string, status: "Verified" | "Rejected" | "Refunded", reason: string | null) {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .update({ status, reason })
    .eq("id", id)
    .select("lead_id")
    .maybeSingle()
  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: "Payment not found." }
  refresh(data.lead_id)
  return { ok: true as const }
}

export async function verifyPayment(id: string): Promise<ActionResult> {
  return changeStatus(id, "Verified", null)
}

export async function rejectPayment(id: string, reason: string): Promise<ActionResult> {
  const r = reasonSchema.safeParse(reason)
  if (!r.success) return { ok: false, error: r.error.issues[0].message }
  return changeStatus(id, "Rejected", r.data)
}

export async function refundPayment(id: string, reason: string): Promise<ActionResult> {
  const r = reasonSchema.safeParse(reason)
  if (!r.success) return { ok: false, error: r.error.issues[0].message }
  return changeStatus(id, "Refunded", r.data)
}
