import { PageHeader } from "@/components/page-header"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Pod, Profile } from "@/lib/types"
import { TeamClient } from "./team-client"

export const metadata = { title: "Team · Azisly BD CRM" }
// Bulk uploads create many accounts in one go.
export const maxDuration = 60

export default async function TeamPage() {
  const me = await requireAdmin()
  const supabase = await createClient()
  const [{ data: profiles }, { data: pods }, { data: invites }] = await Promise.all([
    supabase.from("profiles").select("*").order("active", { ascending: false }).order("full_name"),
    supabase.from("pods").select("*").order("name"),
    supabase.from("invites").select("email, link_sent_at"),
  ])
  const linkSentAt: Record<string, string> = {}
  for (const i of invites ?? []) if (i.link_sent_at) linkSentAt[String(i.email).toLowerCase()] = i.link_sent_at

  return (
    <>
      <PageHeader
        title="Team"
        description="Add people one by one or upload an Excel sheet, set roles and pods, and send login links."
      />
      <TeamClient
        meId={me.profile.id}
        profiles={(profiles ?? []) as Profile[]}
        pods={(pods ?? []) as Pod[]}
        linkSentAt={linkSentAt}
      />
    </>
  )
}
