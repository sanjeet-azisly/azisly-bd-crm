"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

const podSchema = z.object({
  name: z.string().trim().min(2, "Pod name must be 2–40 characters.").max(40, "Pod name must be 2–40 characters."),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour."),
  target_override: z
    .union([z.number().min(0, "Target can’t be negative."), z.null()])
    .default(null),
})

function refresh() {
  revalidatePath("/admin/pods")
  revalidatePath("/admin/team")
}

function friendly(message: string, code?: string) {
  if (code === "23505") return "A pod with that name already exists."
  return message
}

export async function createPod(input: unknown): Promise<ActionResult> {
  await requireAdmin()
  const parsed = podSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.from("pods").insert(parsed.data)
  if (error) return { ok: false, error: friendly(error.message, error.code) }
  refresh()
  return { ok: true }
}

export async function updatePod(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin()
  const parsed = podSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.from("pods").update(parsed.data).eq("id", id)
  if (error) return { ok: false, error: friendly(error.message, error.code) }
  refresh()
  return { ok: true }
}

export async function deletePod(id: string): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("pods").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

/** One leader per pod: setting a new one replaces the old one. Pass null to clear. */
export async function setPodLeader(podId: string, profileId: string | null): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("pods").update({ leader_id: profileId }).eq("id", podId)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

/** Moves a person into a pod (or out of every pod with null). */
export async function assignToPod(profileId: string, podId: string | null): Promise<ActionResult> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ pod_id: podId }).eq("id", profileId)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}
