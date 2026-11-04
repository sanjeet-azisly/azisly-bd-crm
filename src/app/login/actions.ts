"use server"

import { finishLogin } from "@/lib/auth"
import { devLoginEnabled } from "@/lib/dev-login"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/** Called by the login link landing page once the session is set. */
export async function completeEmailLogin() {
  return finishLogin()
}

/** Local testing only: log in as any active team member without an email. */
export async function devLogin(email: string) {
  if (!devLoginEnabled()) return "not_invited" as const
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email })
  if (error) return "not_invited" as const
  const supabase = await createClient()
  const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" })
  if (vErr) return "not_invited" as const
  return finishLogin()
}
