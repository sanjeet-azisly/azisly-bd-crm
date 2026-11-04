import Link from "next/link"
import { Chip } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { StageChip, TempChip } from "@/components/leads/chips"
import { requireUser } from "@/lib/auth"
import { TOUCH_LIMIT, formatDateTime, type Stage, type Temperature } from "@/lib/leads"
import { createClient } from "@/lib/supabase/server"
import { ClaimButton } from "./claim-button"

export const metadata = { title: "Pool · Azisly BD CRM" }

type PoolLead = {
  id: string
  name: string
  pod_id: string | null
  owner_name: string
  owner_active: boolean
  stage: string
  temperature: Temperature
  course_short: string | null
  source: string
  touches: number
  last_touched_at: string | null
  created_at: string
}

/** Rule 6.2: leads nobody has touched for the pool hours. Anyone in the pod can claim them. */
export default async function PoolPage() {
  const me = await requireUser()
  const supabase = await createClient()
  const [{ data }, { data: settings }, { data: pods }] = await Promise.all([
    supabase.rpc("pool_leads", { p_pod: null }),
    supabase.from("settings").select("pool_hours").eq("id", 1).single(),
    supabase.from("pods").select("id, name, colour").order("name"),
  ])
  const leads = (data ?? []) as PoolLead[]
  const hours = settings?.pool_hours ?? 72
  const podById = new Map((pods ?? []).map((p) => [p.id, p]))

  return (
    <>
      <PageHeader
        title="Pool"
        description={
          me.isAdmin
            ? `Open leads with no touch for ${hours}h+ (or whose owner left), across all pods.`
            : `Open leads in your pod with no touch for ${hours}h+. Claim one to make it yours.`
        }
      />
      {!me.isAdmin && !me.profile.pod_id && (
        <p className="rounded-2xl bg-surface p-8 text-sm text-muted-foreground">You’re not in a pod yet, so there’s no pool to show.</p>
      )}
      <ul className="divide-y rounded-2xl bg-surface">
        {leads.map((l) => {
          const pod = l.pod_id ? podById.get(l.pod_id) : null
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-medium">
                  {me.isAdmin ? (
                    <Link href={`/leads/${l.id}`} className="hover:underline">
                      {l.name}
                    </Link>
                  ) : (
                    l.name
                  )}
                  {l.course_short && <span className="text-sm font-normal text-muted-foreground"> · {l.course_short}</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <TempChip temperature={l.temperature} />
                  <StageChip stage={l.stage as Stage} />
                  <Chip>
                    {Math.min(l.touches, TOUCH_LIMIT)}/{TOUCH_LIMIT}
                  </Chip>
                  <Chip tone="amber">No touch {hours}h+</Chip>
                  {me.isAdmin && pod && (
                    <Chip>
                      <span className="size-2 rounded-full" style={{ background: pod.colour }} /> {pod.name}
                    </Chip>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  With {l.owner_name}
                  {!l.owner_active && " (no longer on the team)"} · last touched{" "}
                  {l.last_touched_at ? formatDateTime(l.last_touched_at) : "never"}
                </p>
              </div>
              <ClaimButton leadId={l.id} leadName={l.name} />
            </li>
          )
        })}
        {leads.length === 0 && (me.isAdmin || me.profile.pod_id) && (
          <li className="p-6 text-center text-sm text-muted-foreground">The pool is empty. Every lead is being worked. 🎉</li>
        )}
      </ul>
    </>
  )
}
