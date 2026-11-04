import { PageHeader } from "@/components/page-header"
import { AddLeadButton } from "@/components/leads/add-lead-dialog"
import { requireUser } from "@/lib/auth"
import type { Lead } from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"
import { LeadsClient, type LeadRow } from "./leads-client"

export const metadata = { title: "Leads · Azisly BD CRM" }

export default async function LeadsPage() {
  const me = await requireUser()
  const supabase = await createClient()
  const [{ data: leads }, { data: courses }, { data: people }, { data: pools }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, owner:profiles!leads_owner_id_fkey(full_name), course:courses(short_name), pod:pods(name)")
      .order("next_follow_up", { ascending: true, nullsFirst: false })
      .limit(2000),
    supabase.from("courses").select("id, name, short_name, active").order("sort_order"),
    me.isAdmin
      ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")
      : Promise.resolve({ data: null }),
    supabase.rpc("pool_leads", { p_pod: null }),
  ])
  const rows = (leads ?? []) as (Lead & {
    owner: { full_name: string } | null
    course: { short_name: string } | null
    pod: { name: string } | null
  })[]
  const poolCount = (pools ?? []).length

  return (
    <>
      <PageHeader
        title="Leads"
        description={me.isAdmin ? "All leads in the CRM." : me.ledPod ? "Your leads and your pod’s leads." : "Your leads."}
        action={
          <AddLeadButton
            className="h-10"
            isAdmin={me.isAdmin}
            courses={(courses ?? []).filter((c) => c.active)}
          />
        }
      />
      <LeadsClient
        meId={me.profile.id}
        leads={rows.map<LeadRow>((l) => ({
          ...l,
          owner_name: l.owner?.full_name ?? "",
          course_short: l.course?.short_name ?? null,
          pod_name: l.pod?.name ?? null,
        }))}
        isAdmin={me.isAdmin}
        people={people ?? []}
        poolCount={poolCount}
        courses={(courses ?? []).map((c) => ({ id: c.id, short_name: c.short_name }))}
      />
    </>
  )
}
