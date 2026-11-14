"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { PHOTO_BUCKET } from "@/lib/id-photos"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const MAX_BYTES = 2 * 1024 * 1024

/** Saves the signed-in person's ID card photo (already cropped to 35:45 JPEG in the browser). */
export async function uploadIdPhoto(form: FormData): Promise<ActionResult> {
  const me = await requireUser()
  const file = form.get("photo")
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first." }
  if (file.size > MAX_BYTES) return { ok: false, error: "That photo is too large. Try a smaller one." }
  const bytes = new Uint8Array(await file.arrayBuffer())
  // JPEG files start with FF D8 FF.
  if (file.type !== "image/jpeg" || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, error: "That file isn’t a photo we can use. Try a JPG or PNG." }
  }

  const admin = createAdminClient()
  const path = `${me.profile.id}/${Date.now()}.jpg`
  const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: "image/jpeg" })
  if (error) return { ok: false, error: `Couldn’t upload the photo: ${error.message}` }

  const { error: saveError } = await admin
    .from("profiles")
    .update({ photo_path: path, photo_updated_at: new Date().toISOString() })
    .eq("id", me.profile.id)
  if (saveError) {
    await admin.storage.from(PHOTO_BUCKET).remove([path])
    return { ok: false, error: `Couldn’t save the photo: ${saveError.message}` }
  }
  if (me.profile.photo_path) await admin.storage.from(PHOTO_BUCKET).remove([me.profile.photo_path])

  revalidatePath("/profile")
  revalidatePath("/today")
  revalidatePath("/admin/photos")
  return { ok: true }
}

/** Lets the signed-in person choose a new password (needs the current one). */
export async function changePassword(current: string, next: string): Promise<ActionResult> {
  const me = await requireUser()
  if (next.length < 8 || next.length > 72) return { ok: false, error: "Use 8 to 72 characters." }
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) return { ok: false, error: "Use letters and at least one number." }
  const supabase = await createClient()
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: me.profile.email, password: current })
  if (wrong) return { ok: false, error: "Your current password is wrong." }
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return { ok: false, error: /same/i.test(error.message) ? "Pick a password you haven’t used." : error.message }
  return { ok: true }
}
