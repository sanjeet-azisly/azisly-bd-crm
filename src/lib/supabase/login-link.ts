import { createClient } from "@supabase/supabase-js"

// Login links use the "implicit" flow so they work on any device or browser,
// e.g. asked for on a laptop but opened from the Gmail app on a phone.
function linkClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export type LinkResult = "sent" | "not_invited" | "rate_limited" | "error"

/** Emails a one-tap login link. Only works for emails already on the team. */
export async function sendLoginLink(email: string): Promise<{ result: LinkResult; message?: string }> {
  const { error } = await linkClient().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirm` },
  })
  if (!error) return { result: "sent" }
  // Supabase refuses unknown emails because sign-ups are switched off.
  if (/signup|not allowed|not found/i.test(error.message)) return { result: "not_invited" }
  if (error.status === 429 || /rate|security purposes/i.test(error.message)) {
    return { result: "rate_limited", message: error.message }
  }
  return { result: "error", message: error.message }
}
