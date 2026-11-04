"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { inviteBody } from "@/lib/email"
import { PHONE_ERROR, normalizePhone, type ActionResult } from "@/lib/format"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { TeamRole } from "@/lib/types"

const phoneField = z
  .unknown()
  .transform((v, ctx) => {
    const p = normalizePhone(v)
    if (p === "invalid") {
      ctx.addIssue({ code: "custom", message: PHONE_ERROR })
      return z.NEVER
    }
    return p
  })

const memberSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be 2–80 characters.").max(80, "Name must be 2–80 characters."),
  phone: phoneField,
  role: z.enum(["admin", "leader", "intern"]),
  pod_id: z.uuid().nullable(),
})

const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."))

const inviteSchema = memberSchema.extend({ email: emailField })

const editSchema = memberSchema.extend({
  id: z.uuid(),
  referral_code: z
    .string()
    .trim()
    .regex(/^([A-Za-z0-9]{3,20})?$/, "Referral code: 3–20 letters or digits, no spaces.")
    .transform((c) => c || null),
})

const bulkRowSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be 2–80 characters.").max(80, "Name must be 2–80 characters."),
  email: emailField,
  phone: phoneField,
  role: z.enum(["admin", "leader", "intern"]),
  pod_name: z.string().trim().max(40, "Pod name must be up to 40 characters.").transform((v) => v || null),
})

export type BulkRow = z.input<typeof bulkRowSchema>
export type BulkRowResult = { email: string; status: "created" | "exists" | "error"; message?: string }

const POD_COLOURS = ["#2346F5", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9", "#EC4899"]

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Check the form and try again."
}

function refresh() {
  revalidatePath("/admin/team")
  revalidatePath("/admin/pods")
}

/** Makes `userId` the leader of `podId`, or clears any pod they lead. */
async function applyLeader(userId: string, role: TeamRole, podId: string | null) {
  const supabase = await createClient()
  const { error } =
    role === "leader" && podId
      ? await supabase.from("pods").update({ leader_id: userId }).eq("id", podId)
      : await supabase.from("pods").update({ leader_id: null }).eq("leader_id", userId)
  return error?.message ?? null
}

/**
 * Creates the login account and team profile. Sign-ups are switched off in
 * Supabase, so only people created here can ever log in.
 */
async function createMember(
  m: { full_name: string; email: string; phone: string | null; role: TeamRole; pod_id: string | null },
  invitedBy: string
): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient()
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: m.email,
    email_confirm: true,
    user_metadata: { full_name: m.full_name },
  })
  if (authError || !created.user) {
    return {
      error: /already been registered|exists/i.test(authError?.message ?? "")
        ? "This email already has a login but no team profile. Ask your developer to remove the old login."
        : `Couldn’t create the login: ${authError?.message ?? "unknown error"}`,
    }
  }
  const dbRole = m.role === "admin" ? "admin" : "intern"
  const supabase = await createClient()
  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    email: m.email,
    full_name: m.full_name,
    phone: m.phone,
    role: dbRole,
    pod_id: m.pod_id,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: `Couldn’t save the team member: ${profileError.message}` }
  }
  await supabase.from("invites").upsert(
    {
      email: m.email,
      full_name: m.full_name,
      phone: m.phone,
      role: dbRole,
      pod_id: m.pod_id,
      make_leader: m.role === "leader",
      invited_by: invitedBy,
      accepted_at: null,
      link_sent_at: null,
    },
    { onConflict: "email" }
  )
  return { id: created.user.id }
}

export async function inviteMember(input: unknown): Promise<ActionResult<{ inviteText: string }>> {
  const me = await requireAdmin()
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const m = parsed.data
  if (m.role === "leader" && !m.pod_id) return { ok: false, error: "Pick the pod this person will lead." }

  const supabase = await createClient()
  const { data: existing } = await supabase.from("profiles").select("full_name").eq("email", m.email).maybeSingle()
  if (existing) return { ok: false, error: `${m.email} is already on the team (${existing.full_name}).` }

  const created = await createMember(m, me.profile.id)
  if ("error" in created) return { ok: false, error: created.error }
  const leaderError = await applyLeader(created.id, m.role, m.pod_id)

  refresh()
  return {
    ok: true,
    data: { inviteText: inviteBody(m.full_name) },
    message: leaderError ? `Added, but couldn’t mark as pod leader: ${leaderError}` : undefined,
  }
}

/** Creates everyone in an uploaded sheet. Unknown pod names become new pods. */
export async function bulkImport(rows: BulkRow[]): Promise<ActionResult<BulkRowResult[]>> {
  const me = await requireAdmin()
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "The sheet has no rows." }
  if (rows.length > 300) return { ok: false, error: "Upload up to 300 people at a time." }

  const supabase = await createClient()
  const [{ data: profiles }, { data: pods }] = await Promise.all([
    supabase.from("profiles").select("email"),
    supabase.from("pods").select("id, name"),
  ])
  const onTeam = new Set((profiles ?? []).map((p) => String(p.email).toLowerCase()))
  const podIds = new Map((pods ?? []).map((p) => [p.name.toLowerCase(), p.id as string]))
  const seen = new Set<string>()
  const results: BulkRowResult[] = []
  const leaders: { id: string; podId: string }[] = []

  for (const raw of rows) {
    const parsed = bulkRowSchema.safeParse(raw)
    const email = String(raw?.email ?? "").trim().toLowerCase()
    if (!parsed.success) {
      results.push({ email, status: "error", message: firstError(parsed.error) })
      continue
    }
    const r = parsed.data
    if (seen.has(r.email)) {
      results.push({ email: r.email, status: "error", message: "This email appears twice in the sheet." })
      continue
    }
    seen.add(r.email)
    if (onTeam.has(r.email)) {
      results.push({ email: r.email, status: "exists", message: "Already on the team – skipped." })
      continue
    }

    let podId: string | null = null
    if (r.pod_name) {
      podId = podIds.get(r.pod_name.toLowerCase()) ?? null
      if (!podId) {
        const { data: pod, error } = await supabase
          .from("pods")
          .insert({ name: r.pod_name, colour: POD_COLOURS[podIds.size % POD_COLOURS.length] })
          .select("id")
          .single()
        if (error) {
          results.push({ email: r.email, status: "error", message: `Couldn’t create pod “${r.pod_name}”: ${error.message}` })
          continue
        }
        podId = pod.id
        podIds.set(r.pod_name.toLowerCase(), pod.id)
      }
    }

    const created = await createMember({ ...r, pod_id: podId }, me.profile.id)
    if ("error" in created) {
      results.push({ email: r.email, status: "error", message: created.error })
      continue
    }
    if (r.role === "leader" && podId) leaders.push({ id: created.id, podId })
    results.push({
      email: r.email,
      status: "created",
      message: r.role === "leader" && !podId ? "Added as intern – give them a pod, then mark them leader." : undefined,
    })
  }

  // Leaders last, once everyone is in their pod. A later row for the same pod wins.
  for (const l of leaders) await applyLeader(l.id, "leader", l.podId)

  refresh()
  return { ok: true, data: results }
}

/** Records that login links went out, so the Team page can show it. */
export async function markLinksSent(emails: string[]): Promise<ActionResult> {
  await requireAdmin()
  const clean = emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  if (clean.length === 0) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase.from("invites").update({ link_sent_at: new Date().toISOString() }).in("email", clean)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/team")
  return { ok: true }
}

export async function updateMember(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin()
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const { id, full_name, phone, role, pod_id, referral_code } = parsed.data
  if (role === "leader" && !pod_id) return { ok: false, error: "A pod leader needs a pod." }
  if (id === me.profile.id && role !== "admin") return { ok: false, error: "You can’t remove your own admin role." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone, role: role === "admin" ? "admin" : "intern", pod_id, referral_code })
    .eq("id", id)
  if (error) {
    if (error.code === "23505") return { ok: false, error: `Referral code “${referral_code}” is already taken.` }
    return { ok: false, error: error.message }
  }
  const leaderError = await applyLeader(id, role, pod_id)
  if (leaderError) return { ok: false, error: leaderError }

  refresh()
  return { ok: true }
}

export async function setMemberActive(id: string, active: boolean): Promise<ActionResult> {
  const me = await requireAdmin()
  if (id === me.profile.id) return { ok: false, error: "You can’t deactivate yourself." }

  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  // Block the login itself too, so a deactivated person can't sign in at all.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  })
  if (banError) return { ok: false, error: `Saved, but couldn’t update the login: ${banError.message}` }

  refresh()
  return { ok: true }
}

export async function deleteMember(id: string): Promise<ActionResult> {
  const me = await requireAdmin()
  if (id === me.profile.id) return { ok: false, error: "You can’t delete yourself." }

  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", id).maybeSingle()
  const { error } = await createAdminClient().auth.admin.deleteUser(id)
  if (error) {
    return {
      ok: false,
      error: /foreign key|violates/i.test(error.message)
        ? "This person has leads or payments. Deactivate them instead."
        : error.message,
    }
  }
  if (profile) await supabase.from("invites").delete().eq("email", profile.email)

  refresh()
  return { ok: true }
}

/**
 * A one-time login link for one team member, for the admin to open in a private
 * window (to see the CRM as that person) or send on WhatsApp while email isn't set up.
 * Works once and expires like any login link.
 */
export async function getLoginLink(id: string, origin: string): Promise<ActionResult<{ link: string; email: string }>> {
  await requireAdmin()
  if (!/^https?:\/\/[^/]+$/.test(origin)) return { ok: false, error: "Couldn’t work out the site address." }
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("email, active").eq("id", id).maybeSingle()
  if (!profile) return { ok: false, error: "Team member not found." }
  if (!profile.active) return { ok: false, error: "This person is deactivated. Reactivate them first." }
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
    options: { redirectTo: `${origin}/auth/confirm` },
  })
  if (error || !data.properties?.action_link) return { ok: false, error: error?.message ?? "Couldn’t create the link." }
  return { ok: true, data: { link: data.properties.action_link, email: profile.email } }
}
