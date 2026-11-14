"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin, requirePerm, type CurrentUser } from "@/lib/auth"
import { PHONE_ERROR, normalizePhone, type ActionResult } from "@/lib/format"
import { createJoinLink, joinMessage } from "@/lib/join-links"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_MANAGER_PERMISSIONS, PERMISSIONS, type Permission, type TeamRole } from "@/lib/types"

const phoneField = z.unknown().transform((v, ctx) => {
  const p = normalizePhone(v)
  if (p === "invalid") {
    ctx.addIssue({ code: "custom", message: PHONE_ERROR })
    return z.NEVER
  }
  return p
})

const nameField = z.string().trim().min(2, "Name must be 2–80 characters.").max(80, "Name must be 2–80 characters.")
const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."))
const roleField = z.enum(["admin", "manager", "intern"])
const permKeys = PERMISSIONS.map((p) => p.key) as [Permission, ...Permission[]]

const inviteSchema = z.object({
  full_name: nameField,
  email: emailField,
  phone: phoneField,
  role: roleField,
  pod_id: z.uuid().nullable(),
})

const editSchema = z.object({
  id: z.uuid(),
  full_name: nameField,
  phone: phoneField,
  role: roleField,
  pod_id: z.uuid().nullable(),
  referral_code: z
    .string()
    .trim()
    .regex(/^([A-Za-z0-9]{3,20})?$/, "Referral code: 3–20 letters or digits, no spaces.")
    .transform((c) => c || null),
  permissions: z.array(z.enum(permKeys)).default([]),
  commission_pct: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((v, ctx) => {
      if (v === null || v === "") return null
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        ctx.addIssue({ code: "custom", message: "Share must be between 0 and 100%." })
        return z.NEVER
      }
      return Math.round(n * 100) / 100
    }),
})

const bulkRowSchema = z.object({
  full_name: nameField,
  email: emailField,
  phone: phoneField,
  role: roleField,
  pod_name: z.string().trim().max(40, "Pod name must be up to 40 characters.").transform((v) => v || null),
})

export type BulkRow = z.input<typeof bulkRowSchema>
export type BulkRowResult = {
  email: string
  name?: string
  phone?: string | null
  status: "created" | "exists" | "error"
  message?: string
  /** Joining link and WhatsApp message for people just added. */
  link?: string
  text?: string
}
export type JoinLinkResult = { link: string; text: string; phone: string | null; name: string }

const POD_COLOURS = ["#2346F5", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9", "#EC4899"]

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Check the form and try again."
}

function refresh() {
  revalidatePath("/admin/team")
  revalidatePath("/admin/pods")
  revalidatePath("/pod")
}

/**
 * Who is managing the team. Admins manage everyone; a manager with
 * "add and manage interns" manages the interns of the pod they run.
 */
async function teamActor(): Promise<{ me: CurrentUser; podId: string | null } | { error: string }> {
  const me = await requirePerm("manage_team")
  if (me.isAdmin) return { me, podId: null }
  if (!me.ledPod) return { error: "You don’t run a pod yet. Ask the admin to set you as a pod’s manager." }
  return { me, podId: me.ledPod.id }
}

/** May this actor change this person? Managers: only interns in their own pod. */
async function canManage(actor: { me: CurrentUser; podId: string | null }, id: string) {
  const { data } = await createAdminClient().from("profiles").select("id, role, pod_id").eq("id", id).maybeSingle()
  if (!data) return null
  if (actor.podId === null) return data
  return data.role === "intern" && data.pod_id === actor.podId ? data : null
}

/**
 * A new pod for a manager added without one: "Pranav's team" (made unique if taken).
 * The admin can rename it in Pods.
 */
async function newPodFor(fullName: string): Promise<string> {
  const db = createAdminClient()
  const first = fullName.trim().split(/\s+/)[0].slice(0, 30)
  const { data: pods } = await db.from("pods").select("name")
  const taken = new Set((pods ?? []).map((p) => p.name.toLowerCase()))
  let name = `${first}’s team`
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${first}’s team ${n}`
  const { data, error } = await db
    .from("pods")
    .insert({ name, colour: POD_COLOURS[taken.size % POD_COLOURS.length] })
    .select("id")
    .single()
  if (error) throw new Error(`Couldn’t create a pod for ${first}: ${error.message}`)
  return data.id
}

/** Makes `userId` the manager of `podId`, or clears any pod they run. */
async function applyManager(userId: string, role: TeamRole, podId: string | null) {
  const db = createAdminClient()
  const { error } =
    role === "manager" && podId
      ? await db.from("pods").update({ leader_id: userId }).eq("id", podId)
      : await db.from("pods").update({ leader_id: null }).eq("leader_id", userId)
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
  const db = createAdminClient()
  const { data: created, error: authError } = await db.auth.admin.createUser({
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
  const { error: profileError } = await db.from("profiles").insert({
    id: created.user.id,
    email: m.email,
    full_name: m.full_name,
    phone: m.phone,
    role: m.role,
    pod_id: m.pod_id,
    permissions: m.role === "manager" ? DEFAULT_MANAGER_PERMISSIONS : [],
  })
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id)
    return { error: `Couldn’t save the team member: ${profileError.message}` }
  }
  await db.from("invites").upsert(
    {
      email: m.email,
      full_name: m.full_name,
      phone: m.phone,
      role: m.role === "admin" ? "admin" : "intern",
      pod_id: m.pod_id,
      make_leader: m.role === "manager",
      invited_by: invitedBy,
      accepted_at: null,
      link_sent_at: null,
    },
    { onConflict: "email" }
  )
  return { id: created.user.id }
}

async function linkFor(id: string, name: string, phone: string | null, returning = false): Promise<JoinLinkResult> {
  const { link } = await createJoinLink(id)
  return { link, text: joinMessage(name, link, returning), phone, name }
}

export async function inviteMember(input: unknown): Promise<ActionResult<JoinLinkResult>> {
  const actor = await teamActor()
  if ("error" in actor) return { ok: false, error: actor.error }
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  // Managers add interns to their own pod, whatever the form says.
  const m = actor.podId ? { ...parsed.data, role: "intern" as const, pod_id: actor.podId } : parsed.data

  const db = createAdminClient()
  const { data: existing } = await db.from("profiles").select("full_name").eq("email", m.email).maybeSingle()
  if (existing) return { ok: false, error: `${m.email} is already on the team (${existing.full_name}).` }
  // A manager added without a pod gets their own.
  if (m.role === "manager" && !m.pod_id) {
    try {
      m.pod_id = await newPodFor(m.full_name)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn’t create their pod." }
    }
  }

  const created = await createMember(m, actor.me.profile.id)
  if ("error" in created) return { ok: false, error: created.error }
  const managerError = await applyManager(created.id, m.role, m.pod_id)

  refresh()
  return {
    ok: true,
    data: await linkFor(created.id, m.full_name, m.phone),
    message: managerError ? `Added, but couldn’t make them the pod’s manager: ${managerError}` : undefined,
  }
}

/** Creates everyone in an uploaded sheet. Admins: unknown pod names become new pods. */
export async function bulkImport(rows: BulkRow[]): Promise<ActionResult<BulkRowResult[]>> {
  const actor = await teamActor()
  if ("error" in actor) return { ok: false, error: actor.error }
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "The sheet has no rows." }
  if (rows.length > 300) return { ok: false, error: "Upload up to 300 people at a time." }

  const db = createAdminClient()
  const [{ data: profiles }, { data: pods }] = await Promise.all([
    db.from("profiles").select("email"),
    db.from("pods").select("id, name"),
  ])
  const onTeam = new Set((profiles ?? []).map((p) => String(p.email).toLowerCase()))
  const podIds = new Map((pods ?? []).map((p) => [p.name.toLowerCase(), p.id as string]))
  const seen = new Set<string>()
  const results: BulkRowResult[] = []
  const managers: { id: string; podId: string }[] = []

  for (const raw of rows) {
    const parsed = bulkRowSchema.safeParse(raw)
    const email = String(raw?.email ?? "").trim().toLowerCase()
    if (!parsed.success) {
      results.push({ email, status: "error", message: firstError(parsed.error) })
      continue
    }
    const r = parsed.data
    if (actor.podId && r.role !== "intern") {
      results.push({ email: r.email, status: "error", message: "Only the admin can add managers or admins." })
      continue
    }
    if (seen.has(r.email)) {
      results.push({ email: r.email, status: "error", message: "This email appears twice in the sheet." })
      continue
    }
    seen.add(r.email)
    if (onTeam.has(r.email)) {
      results.push({ email: r.email, status: "exists", message: "Already on the team – skipped." })
      continue
    }

    let podId: string | null = actor.podId
    if (!actor.podId && r.pod_name) {
      podId = podIds.get(r.pod_name.toLowerCase()) ?? null
      if (!podId) {
        const { data: pod, error } = await db
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

    if (r.role === "manager" && !podId) {
      try {
        podId = await newPodFor(r.full_name)
      } catch (e) {
        results.push({ email: r.email, status: "error", message: e instanceof Error ? e.message : "Couldn’t create their pod." })
        continue
      }
    }
    const created = await createMember({ ...r, pod_id: podId }, actor.me.profile.id)
    if ("error" in created) {
      results.push({ email: r.email, status: "error", message: created.error })
      continue
    }
    if (r.role === "manager" && podId) managers.push({ id: created.id, podId })
    const { link, text } = await linkFor(created.id, r.full_name, r.phone)
    results.push({
      email: r.email,
      name: r.full_name,
      phone: r.phone,
      status: "created",
      link,
      text,
      message: undefined,
    })
  }

  // Managers last, once everyone is in their pod. A later row for the same pod wins.
  for (const l of managers) await applyManager(l.id, "manager", l.podId)

  refresh()
  return { ok: true, data: results }
}

/** A fresh joining / new-password link for one person, to send on WhatsApp. */
export async function getJoinLink(id: string): Promise<ActionResult<JoinLinkResult>> {
  const actor = await teamActor()
  if ("error" in actor) return { ok: false, error: actor.error }
  if (!(await canManage(actor, id))) return { ok: false, error: "You can only send links to people in your pod." }
  const { data: p } = await createAdminClient().from("profiles").select("full_name, phone, first_login_at").eq("id", id).single()
  try {
    const result = await linkFor(id, p!.full_name, p!.phone, !!p!.first_login_at)
    revalidatePath("/admin/team")
    return { ok: true, data: result }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn’t create the link." }
  }
}

/** Records that login links went out by email, so the Team page can show it. */
export async function markLinksSent(emails: string[]): Promise<ActionResult> {
  await requirePerm("manage_team")
  const clean = emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  if (clean.length === 0) return { ok: true }
  const { error } = await createAdminClient().from("invites").update({ link_sent_at: new Date().toISOString() }).in("email", clean)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/team")
  return { ok: true }
}

export async function updateMember(input: unknown): Promise<ActionResult> {
  const actor = await teamActor()
  if ("error" in actor) return { ok: false, error: actor.error }
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }
  const { id, full_name, phone, role, pod_id, referral_code, permissions, commission_pct } = parsed.data
  if (!(await canManage(actor, id))) return { ok: false, error: "You can only edit interns in your pod." }

  const db = createAdminClient()
  if (actor.podId) {
    // Managers change contact details only.
    const { error } = await db.from("profiles").update({ full_name, phone }).eq("id", id)
    if (error) return { ok: false, error: error.message }
    refresh()
    return { ok: true }
  }

  let podForRole = pod_id
  if (role === "manager" && !podForRole) {
    try {
      podForRole = await newPodFor(full_name)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn’t create their pod." }
    }
  }
  if (id === actor.me.profile.id && role !== "admin") return { ok: false, error: "You can’t remove your own admin role." }
  const { error } = await db
    .from("profiles")
    .update({
      full_name,
      phone,
      role,
      pod_id: podForRole,
      referral_code,
      permissions: role === "manager" ? permissions : [],
      commission_pct: role === "manager" ? commission_pct : null,
    })
    .eq("id", id)
  if (error) {
    if (error.code === "23505") return { ok: false, error: `Referral code “${referral_code}” is already taken.` }
    return { ok: false, error: error.message }
  }
  const managerError = await applyManager(id, role, podForRole)
  if (managerError) return { ok: false, error: managerError }

  refresh()
  return { ok: true }
}

export async function setMemberActive(id: string, active: boolean): Promise<ActionResult> {
  const actor = await teamActor()
  if ("error" in actor) return { ok: false, error: actor.error }
  if (id === actor.me.profile.id) return { ok: false, error: "You can’t deactivate yourself." }
  if (!(await canManage(actor, id))) return { ok: false, error: "You can only change interns in your pod." }

  const db = createAdminClient()
  const { error } = await db.from("profiles").update({ active }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  // Block the login itself too, so a deactivated person can't sign in at all.
  const { error: banError } = await db.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" })
  if (banError) return { ok: false, error: `Saved, but couldn’t update the login: ${banError.message}` }

  refresh()
  return { ok: true }
}

export async function deleteMember(id: string): Promise<ActionResult> {
  const me = await requireAdmin()
  if (id === me.profile.id) return { ok: false, error: "You can’t delete yourself." }

  const db = createAdminClient()
  const { data: profile } = await db.from("profiles").select("email").eq("id", id).maybeSingle()
  const { error } = await db.auth.admin.deleteUser(id)
  if (error) {
    return {
      ok: false,
      error: /foreign key|violates/i.test(error.message) ? "This person has leads or payments. Deactivate them instead." : error.message,
    }
  }
  if (profile) await db.from("invites").delete().eq("email", profile.email)

  refresh()
  return { ok: true }
}
