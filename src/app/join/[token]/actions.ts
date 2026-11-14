"use server"

import { z } from "zod"
import { finishLogin } from "@/lib/auth"
import type { ActionResult } from "@/lib/format"
import { readJoinLink, spendJoinLink } from "@/lib/join-links"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "That password is too long.")
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), "Use letters and at least one number.")

/** Sets the person's password from their joining link, then logs them in. */
export async function completeJoin(token: string, password: string): Promise<ActionResult> {
  const pw = passwordSchema.safeParse(password)
  if (!pw.success) return { ok: false, error: pw.error.issues[0].message }

  const invite = await readJoinLink(token)
  if (invite === "expired") return { ok: false, error: "This link has expired. Ask your manager or admin for a new one." }
  if (invite === "inactive") return { ok: false, error: "Your access is turned off. Ask your admin." }
  if (invite === "invalid") return { ok: false, error: "This link was already used or isn’t valid. Ask for a new one." }

  const { error } = await createAdminClient().auth.admin.updateUserById(invite.profileId, { password: pw.data })
  if (error) return { ok: false, error: /weak|pwned|leaked/i.test(error.message) ? "That password is too easy to guess. Try another." : error.message }
  await spendJoinLink(token)

  const supabase = await createClient()
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: invite.email, password: pw.data })
  if (loginError) return { ok: false, error: "Password saved. Log in with your email and new password." }
  const result = await finishLogin()
  if (result !== "ok") return { ok: false, error: "Your account isn’t active. Ask your admin." }
  return { ok: true }
}
