import { notFound } from "next/navigation"
import { requireUser } from "@/lib/auth"
import type { Lead, LeadEvent } from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"
import type { Course } from "@/lib/types"
import { screenshotLinks } from "@/lib/screenshots"
import { LeadDetail, type LeadPayment } from "./lead-detail"

export const metadata = { title: "Lead · Azisly BD CRM" }

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requireUser()
  const supabase = await createClient()

  const { data: lead } = await supabase
    .from("leads")
    .select("*, owner:profiles!leads_owner_id_fkey(full_name, active), pod:pods(name, colour, leader_id)")
    .eq("id", id)
    .maybeSingle()
  if (!lead) notFound()

  const [{ data: events }, { data: courses }, { data: people }, { data: payments }, { data: helpers }] = await Promise.all([
    supabase
      .from("lead_events")
      .select("*, user:profiles(full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("courses").select("*").order("sort_order"),
    // Who this lead can be handed to: anyone (admin) or the pod's members (pod leader).
    me.isAdmin
      ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")
      : me.ledPod && me.ledPod.id === lead.pod_id
        ? supabase.from("profiles").select("id, full_name").eq("active", true).eq("pod_id", me.ledPod.id).order("full_name")
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase
      .from("payments")
      .select(
        "id, amount, paid_on, txn_ref, status, reason, created_at, screenshot_path, course:courses(name), assisted:profiles!payments_assisted_by_fkey(full_name)"
      )
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    // "Assisted by" choices: this pod's leader and the admins.
    supabase.from("profiles").select("id, full_name, role").eq("active", true).eq("role", "admin"),
  ])
  let assistOptions = (helpers ?? []).map((h) => ({ id: h.id, full_name: h.full_name }))
  if (lead.pod_id) {
    const { data: podRow } = await supabase
      .from("pods")
      .select("leader:profiles!pods_leader_fk(id, full_name)")
      .eq("id", lead.pod_id)
      .maybeSingle()
    const leader = podRow?.leader as unknown as { id: string; full_name: string } | null
    if (leader) assistOptions = [leader, ...assistOptions]
  }
  assistOptions = assistOptions.filter((o) => o.id !== lead.owner_id)
  const links = await screenshotLinks((payments ?? []).map((p) => p.screenshot_path))
  const [{ data: settings }, { data: help }, { count: flagCount }] = await Promise.all([
    supabase.from("settings").select("pool_hours").eq("id", 1).single(),
    supabase
      .from("help_requests")
      .select("id, reason, status, helper:profiles!help_requests_helper_id_fkey(full_name)")
      .eq("lead_id", id)
      .neq("status", "Handled")
      .order("created_at"),
    me.isAdmin
      ? supabase.from("duplicate_attempts").select("id", { count: "exact", head: true }).eq("lead_id", id).is("dismissed_at", null)
      : Promise.resolve({ count: 0 }),
  ])
  const podInfo = lead.pod as { name: string; colour: string; leader_id: string | null } | null

  return (
    <LeadDetail
      lead={lead as Lead}
      ownerName={lead.owner?.full_name ?? ""}
      pod={podInfo}
      ownerActive={lead.owner?.active ?? true}
      poolHours={settings?.pool_hours ?? 72}
      flagCount={flagCount ?? 0}
      // Anyone working a pod lead can ask: members go to their pod leader,
      // the pod leader (also a working intern) goes to the admins.
      canAskHelp={!!lead.pod_id && !me.isAdmin}
      helpGoesTo={podInfo?.leader_id && podInfo.leader_id !== me.profile.id ? "leader" : "admins"}
      openHelp={(help ?? []).map((h) => ({
        id: h.id,
        reason: h.reason,
        status: h.status,
        helper: (h.helper as unknown as { full_name: string } | null)?.full_name ?? null,
      }))}
      events={(events ?? []).map((e) => ({ ...(e as LeadEvent), user_name: e.user?.full_name ?? null }))}
      courses={(courses ?? []) as Course[]}
      me={{
        id: me.profile.id,
        name: me.profile.full_name,
        referralCode: me.profile.referral_code,
        isAdmin: me.isAdmin,
      }}
      reassignTo={people ?? []}
      assistOptions={assistOptions}
      payments={(payments ?? []).map<LeadPayment>((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paid_on: p.paid_on,
        txn_ref: p.txn_ref,
        status: p.status,
        reason: p.reason,
        created_at: p.created_at,
        course_name: (p.course as unknown as { name: string } | null)?.name ?? null,
        assisted_name: (p.assisted as unknown as { full_name: string } | null)?.full_name ?? null,
        screenshot_url: p.screenshot_path ? (links[p.screenshot_path] ?? null) : null,
      }))}
    />
  )
}
