import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Pod, Profile } from "@/lib/types"

export const NOT_INVITED_MESSAGE =
  "This account isn’t on the Azisly BD team. Ask your program admin for an invite."
export const DEACTIVATED_MESSAGE =
  "Your access to the Azisly BD CRM has been turned off. Ask your program admin if this is a mistake."

export type CurrentUser = {
  profile: Profile
  isAdmin: boolean
  /** The pod this user leads, if they are its pod leader. */
  ledPod: Pod | null
}

/** The signed-in team member for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>()
  if (!profile) return null

  let ledPod: Pod | null = null
  if (profile.pod_id) {
    const { data } = await supabase
      .from("pods")
      .select("*")
      .eq("id", profile.pod_id)
      .eq("leader_id", profile.id)
      .maybeSingle<Pod>()
    ledPod = data
  }
  return { profile, isAdmin: profile.role === "admin" && profile.active, ledPod }
})

/** Use at the top of every signed-in page. Sends strangers back to login. */
export async function requireUser(): Promise<CurrentUser> {
  const me = await getCurrentUser()
  if (!me) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    redirect(data.user ? "/auth/reject?reason=not_invited" : "/login")
  }
  if (!me.profile.active) redirect("/auth/reject?reason=deactivated")
  return me
}

export async function requireAdmin(): Promise<CurrentUser> {
  const me = await requireUser()
  if (!me.isAdmin) redirect("/today")
  return me
}

/**
 * Runs once right after a successful login (Google or email code).
 * Returns an error key when the person is not allowed in, after signing them out.
 */
export async function finishLogin(): Promise<"ok" | "not_invited" | "deactivated"> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return "not_invited"

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, active")
    .eq("id", user.id)
    .maybeSingle<{ id: string; active: boolean }>()

  if (!profile || !profile.active) {
    await supabase.auth.signOut()
    return profile ? "deactivated" : "not_invited"
  }
  const { error } = await supabase.rpc("claim_first_login")
  if (error) console.error("claim_first_login failed:", error.message)
  return "ok"
}
