import { requireAdmin } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { createClient } from "@/lib/supabase/server"
import type { Pod, Profile } from "@/lib/types"
import { PodsClient } from "./pods-client"

export const metadata = { title: "Pods · Azisly BD CRM" }

export default async function PodsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ data: pods }, { data: profiles }, { data: settings }] = await Promise.all([
    supabase.from("pods").select("*").order("name"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
    supabase.from("settings").select("milestone_m1").eq("id", 1).maybeSingle(),
  ])

  return (
    <>
      <PageHeader title="Pods" description="Create pods, add members and choose the manager who runs each pod. Make someone a Manager on the Team page first." />
      <PodsClient
        pods={(pods ?? []) as Pod[]}
        people={((profiles ?? []) as Profile[]).filter((p) => p.role !== "admin")}
        defaultMilestone={Number(settings?.milestone_m1 ?? 65000)}
      />
    </>
  )
}
