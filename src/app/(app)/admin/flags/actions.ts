"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

/** Dismiss flags. Pass one id, or every open flag on a lead. */
export async function dismissFlags(ids: string[]): Promise<ActionResult> {
  const me = await requireAdmin()
  if (!ids.length) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase
    .from("duplicate_attempts")
    .update({ dismissed_at: new Date().toISOString(), dismissed_by: me.profile.id })
    .in("id", ids)
    .is("dismissed_at", null)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/flags")
  revalidatePath("/", "layout")
  return { ok: true }
}
