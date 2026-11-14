"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePerm, scopePod } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { PHOTO_BUCKET } from "@/lib/id-photos"
import { createAdminClient } from "@/lib/supabase/admin"

const schema = z.object({
  id: z.uuid(),
  reason: z.string().trim().max(200, "Keep the reason under 200 characters."),
})

/** Removes someone's photo and tells them to upload a new one. */
export async function requestNewPhoto(input: unknown): Promise<ActionResult> {
  const me = await requirePerm("manage_team")
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check and try again." }
  const { id, reason } = parsed.data

  const db = createAdminClient()
  const { data: person } = await db.from("profiles").select("photo_path, pod_id, role").eq("id", id).maybeSingle()
  const pod = scopePod(me)
  if (!person || (pod && (person.pod_id !== pod || person.role !== "intern"))) {
    return { ok: false, error: "Team member not found." }
  }

  const { error } = await db.from("profiles").update({ photo_path: null, photo_updated_at: null }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  if (person.photo_path) await db.storage.from(PHOTO_BUCKET).remove([person.photo_path])
  await db.from("notifications").insert({
    user_id: id,
    text: `Please upload a new ID card photo${reason ? `: ${reason}` : "."}`,
    link: "/profile",
  })

  revalidatePath("/admin/photos")
  return { ok: true }
}
