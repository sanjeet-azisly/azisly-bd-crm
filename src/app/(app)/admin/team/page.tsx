import { PageHeader } from "@/components/page-header"
import { requirePerm } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Pod, Profile } from "@/lib/types"
import { TeamClient } from "./team-client"

export const metadata = { title: "Team · Azisly BD CRM" }
// Bulk uploads create many accounts in one go.
export const maxDuration = 60

export default async function TeamPage() {
  const me = await requirePerm("manage_team")
  const podId = me.isAdmin ? null : (me.ledPod?.id ?? null)
  if (!me.isAdmin && !podId) {
    return (
      <>
        <PageHeader title="My team" />
        <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground">
          You don’t run a pod yet. Ask the admin to make you a pod’s manager.
        </p>
      </>
    )
  }

  // Server-side read, scoped here: admins see everyone, managers their own pod.
  const db = createAdminClient()
  let people = db.from("profiles").select("*").order("active", { ascending: false }).order("full_name")
  let podQuery = db.from("pods").select("*").order("name")
  if (podId) {
    people = people.eq("pod_id", podId)
    podQuery = podQuery.eq("id", podId)
  }
  const [{ data: profiles }, { data: pods }, { data: invites }] = await Promise.all([
    people,
    podQuery,
    db.from("invites").select("email, link_sent_at"),
  ])
  const linkSentAt: Record<string, string> = {}
  for (const i of invites ?? []) if (i.link_sent_at) linkSentAt[String(i.email).toLowerCase()] = i.link_sent_at

  return (
    <>
      <PageHeader
        title={me.isAdmin ? "Team" : `My team · ${me.ledPod!.name}`}
        description={
          me.isAdmin
            ? "Add people one by one or from an Excel sheet, set roles, pods and manager powers, and share joining links."
            : "Add your interns one by one or from an Excel sheet, then send each their joining link on WhatsApp."
        }
      />
      <TeamClient
        meId={me.profile.id}
        isAdmin={me.isAdmin}
        profiles={(profiles ?? []) as Profile[]}
        pods={(pods ?? []) as Pod[]}
        linkSentAt={linkSentAt}
      />
    </>
  )
}
