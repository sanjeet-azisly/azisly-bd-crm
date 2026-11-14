import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"

/** Joining links last a week, so they survive being forwarded on WhatsApp. */
export const JOIN_LINK_DAYS = 7

const hash = (token: string) => createHash("sha256").update(token).digest("hex")

/** The site address this request came in on (falls back to the configured one). */
export async function siteOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

/**
 * A fresh personal link where this person sets their password (first time, or a
 * new one if they forgot it). Making a new link cancels the old one.
 * Callers must already have checked the viewer may manage this person.
 */
export async function createJoinLink(profileId: string): Promise<{ link: string; expiresAt: string }> {
  const db = createAdminClient()
  const { data: p, error } = await db
    .from("profiles")
    .select("email, full_name, phone, role, pod_id, active")
    .eq("id", profileId)
    .single()
  if (error || !p) throw new Error("Team member not found.")
  if (!p.active) throw new Error("This person is deactivated. Reactivate them first.")

  const token = randomBytes(24).toString("base64url")
  const expiresAt = new Date(Date.now() + JOIN_LINK_DAYS * 86_400_000).toISOString()
  const { error: saveError } = await db.from("invites").upsert(
    {
      email: p.email,
      full_name: p.full_name,
      phone: p.phone,
      role: p.role === "admin" ? "admin" : "intern",
      pod_id: p.pod_id,
      join_token_hash: hash(token),
      join_expires_at: expiresAt,
      link_sent_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  )
  if (saveError) throw new Error(`Couldn’t create the link: ${saveError.message}`)
  return { link: `${await siteOrigin()}/join/${token}`, expiresAt }
}

export type JoinInvite = { email: string; fullName: string; profileId: string; returning: boolean }

/** Who a joining link belongs to, or why it can't be used. */
export async function readJoinLink(token: string): Promise<JoinInvite | "invalid" | "expired" | "inactive"> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return "invalid"
  const db = createAdminClient()
  const { data: inv } = await db
    .from("invites")
    .select("email, join_expires_at")
    .eq("join_token_hash", hash(token))
    .maybeSingle()
  if (!inv) return "invalid"
  if (!inv.join_expires_at || new Date(inv.join_expires_at) < new Date()) return "expired"
  const { data: p } = await db
    .from("profiles")
    .select("id, full_name, active, first_login_at")
    .eq("email", inv.email)
    .maybeSingle()
  if (!p) return "invalid"
  if (!p.active) return "inactive"
  return { email: String(inv.email), fullName: p.full_name, profileId: p.id, returning: !!p.first_login_at }
}

/** Links work once: called after the password is set. */
export async function spendJoinLink(token: string) {
  await createAdminClient()
    .from("invites")
    .update({ join_token_hash: null, join_expires_at: null })
    .eq("join_token_hash", hash(token))
}

/** The WhatsApp message that goes with a joining link. */
export function joinMessage(fullName: string, link: string, returning: boolean) {
  const first = fullName.trim().split(/\s+/)[0]
  return returning
    ? `Hi ${first}, here’s your link to set a new password for the Azisly BD CRM: ${link}\n(Works once, valid for ${JOIN_LINK_DAYS} days.)`
    : `Hi ${first}, welcome to the Azisly BD team! Tap this link to set your password and open the CRM: ${link}\n(Works once, valid for ${JOIN_LINK_DAYS} days. After that, log in at the same site with your email and password.)`
}
