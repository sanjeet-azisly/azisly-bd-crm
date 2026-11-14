import Link from "next/link"
import { redirect } from "next/navigation"
import { Crown, Hourglass, LifeBuoy, Waves } from "lucide-react"
import { Chip, type ChipTone } from "@/components/chip"
import { PageHeader } from "@/components/page-header"
import { TempChip } from "@/components/leads/chips"
import { NativeSelectNav } from "./pod-select"
import { requireUser } from "@/lib/auth"
import { formatINR } from "@/lib/format"
import { buildLeaderboard, loadLeaderboardData } from "@/lib/leaderboard"
import { OPEN_STAGES, formatDateTime, istDate, istStartOfToday, type Temperature } from "@/lib/leads"
import { milestoneStatus, monthFor } from "@/lib/program"
import { createClient } from "@/lib/supabase/server"
import { HelpActions } from "./help-actions"

export const metadata = { title: "My pod · Azisly BD CRM" }

const STATUS_TONE: Record<string, ChipTone> = { "Milestone hit": "green", "On track": "blue", Behind: "red" }
const STUCK_DAYS = 5

/** Spec 5.9: the pod manager's summary. Admins can look at any pod. */
export default async function PodPage({ searchParams }: { searchParams: Promise<{ pod?: string }> }) {
  const me = await requireUser()
  const { pod: wanted } = await searchParams
  const supabase = await createClient()
  const { data: allPods } = await supabase.from("pods").select("id, name, colour, leader_id, target_override").order("name")
  const pods = allPods ?? []

  const pod = me.isAdmin ? (pods.find((p) => p.id === wanted) ?? pods[0]) : me.ledPod ? pods.find((p) => p.id === me.ledPod!.id) : null
  if (!pod) {
    if (!me.isAdmin) redirect("/today")
    return (
      <>
        <PageHeader title="My pod" />
        <p className="text-sm text-muted-foreground">No pods yet.</p>
      </>
    )
  }

  const today = istDate()
  const data = await loadLeaderboardData(supabase)
  const month = monthFor(data.settings, today)
  const board = buildLeaderboard(data, "month", today)
  const members = board.individuals.filter((i) => i.podId === pod.id)
  const podRank = board.pods.find((p) => p.id === pod.id)
  const target = pod.target_override !== null ? Number(pod.target_override) : month.milestone * members.length
  // Includes the manager's own sales.
  const revenue = podRank?.revenue ?? members.reduce((s, m) => s + m.revenue, 0)
  const manager = data.managers.find((m) => m.id === pod.leader_id)
  const leader = manager ? { id: manager.id, name: manager.full_name } : null

  const stuckBefore = new Date(Date.now() - STUCK_DAYS * 86_400_000).toISOString()
  const [{ data: leads }, { data: events }, { data: help }, { data: settings }, { data: pool }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, owner_id, stage, temperature, next_follow_up, stage_changed_at, course:courses(short_name)")
      .eq("pod_id", pod.id)
      .in("stage", OPEN_STAGES),
    supabase
      .from("lead_events")
      .select("user_id")
      .eq("counts_as", "outreach")
      .gte("created_at", istStartOfToday())
      .in(
        "user_id",
        members.map((m) => m.id)
      ),
    supabase
      .from("help_requests")
      .select(
        "id, reason, note, status, created_at, lead:leads(id, name), asker:profiles!help_requests_requested_by_fkey(full_name), helper:profiles!help_requests_helper_id_fkey(full_name)"
      )
      .eq("pod_id", pod.id)
      .neq("status", "Handled")
      .order("created_at"),
    supabase.from("settings").select("target_outreach").eq("id", 1).single(),
    supabase.rpc("pool_leads", { p_pod: pod.id }),
  ])
  const podLeads = leads ?? []
  const stuck = podLeads
    .filter((l) => (l.stage === "Demo done" || l.stage === "Payment pending") && l.stage_changed_at < stuckBefore)
    .sort((a, b) => a.stage_changed_at.localeCompare(b.stage_changed_at))
  const outreachTarget = settings?.target_outreach ?? 25
  const ownerName = (id: string) => members.find((m) => m.id === id)?.name ?? (leader?.id === id ? leader.name : "–")

  return (
    <>
      <PageHeader
        title={me.isAdmin ? "Pods" : "My pod"}
        action={
          me.isAdmin && pods.length > 1 ? (
            <NativeSelectNav value={pod.id} options={pods.map((p) => ({ value: p.id, label: p.name }))} />
          ) : undefined
        }
      />

      {/* Header (5.9.1) */}
      <section className="mb-8 rounded-2xl bg-surface p-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <span className="size-3 rounded-full" style={{ background: pod.colour }} /> {pod.name}
            </p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Crown className="size-3.5" /> {leader ? leader.name : "No manager yet"}
            </p>
          </div>
          {podRank && (
            <Link href="/leaderboard?view=pods" className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-[#e8e8ed]">
              #{podRank.rank} of {board.pods.length} pods
            </Link>
          )}
        </div>
        <p className="mt-3 font-heading text-3xl font-bold">
          {formatINR(revenue)} <span className="text-base font-normal text-muted-foreground">of {formatINR(target)} this month</span>
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: `${Math.min(100, target ? (revenue / target) * 100 : 0)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {month.key} target {pod.target_override !== null ? "(set by admin)" : `= ${members.length} members × ${formatINR(month.milestone)}`}
        </p>
      </section>

      {/* Members (5.9.2) */}
      <section className="mb-8 overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Member</th>
              <th className="p-3 text-right">Revenue ({month.key})</th>
              <th className="p-3 text-right">Gap to milestone</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Hot leads</th>
              <th className="p-3 text-right">Overdue</th>
              <th className="p-3 text-right">Outreach today</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => {
              const status = milestoneStatus(m.revenue, month, today)
              const mine = podLeads.filter((l) => l.owner_id === m.id)
              const hot = mine.filter((l) => l.temperature === "Hot").length
              const overdue = mine.filter((l) => l.next_follow_up && l.next_follow_up < today).length
              const outreach = (events ?? []).filter((e) => e.user_id === m.id).length
              return (
                <tr key={m.id}>
                  <td className="p-3 font-medium">
                    {m.name} {m.id === pod.leader_id && <Crown className="inline size-3.5 text-brand" />}
                  </td>
                  <td className="p-3 text-right">{formatINR(m.revenue)}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {m.revenue >= month.milestone ? "–" : formatINR(month.milestone - m.revenue)}
                  </td>
                  <td className="p-3">
                    <Chip tone={STATUS_TONE[status]}>{status}</Chip>
                  </td>
                  <td className="p-3 text-right">{hot}</td>
                  <td className={overdue ? "p-3 text-right font-medium text-red-700" : "p-3 text-right"}>{overdue}</td>
                  <td className="p-3 text-right">
                    {outreach}/{outreachTarget}
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No members in this pod yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="-mt-2 mb-4 text-xs text-muted-foreground">
        Behind = below the milestone pro-rated to today ({month.key} milestone {formatINR(month.milestone)} × days so far ÷ 30).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Help queue (5.9.3) */}
        <section className="rounded-2xl bg-surface p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <LifeBuoy className="size-4 text-brand" /> Help queue ({help?.length ?? 0})
          </h2>
          <ul className="divide-y">
            {(help ?? []).map((h) => {
              const lead = h.lead as unknown as { id: string; name: string } | null
              const asker = (h.asker as unknown as { full_name: string } | null)?.full_name
              const helper = (h.helper as unknown as { full_name: string } | null)?.full_name
              return (
                <li key={h.id} className="space-y-1.5 py-2.5 text-sm first:pt-0">
                  <p>
                    <Link href={`/leads/${lead?.id}`} className="font-medium hover:underline">
                      {lead?.name}
                    </Link>{" "}
                    · <span className="text-muted-foreground">{asker}</span>
                  </p>
                  <p>
                    <Chip tone="brand">{h.reason}</Chip>{" "}
                    {h.status === "Taken" && <span className="text-xs text-muted-foreground">Taken by {helper}</span>}
                  </p>
                  {h.note && <p className="text-muted-foreground">{h.note}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                    <HelpActions id={h.id} status={h.status} />
                  </div>
                </li>
              )
            })}
            {(help ?? []).length === 0 && <li className="text-sm text-muted-foreground">No open help requests.</li>}
          </ul>
        </section>

        {/* Stuck deals (5.9.4) */}
        <section className="rounded-2xl bg-surface p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Hourglass className="size-4 text-[#d97706]" /> Stuck deals ({stuck.length})
          </h2>
          <p className="-mt-2 mb-2 text-xs text-muted-foreground">In Demo done or Payment pending for {STUCK_DAYS}+ days.</p>
          <ul className="divide-y">
            {stuck.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {ownerName(l.owner_id)} · {l.stage} since {formatDateTime(l.stage_changed_at)}
                  </span>
                </span>
                <TempChip temperature={l.temperature as Temperature} />
              </li>
            ))}
            {stuck.length === 0 && <li className="text-sm text-muted-foreground">Nothing stuck.</li>}
          </ul>
        </section>
      </div>

      <Link
        href="/pool"
        className="mt-4 flex items-center justify-between rounded-2xl bg-surface p-6 text-sm hover:bg-muted/50"
      >
        <span className="flex items-center gap-2 font-medium">
          <Waves className="size-4 text-brand" /> Pool: {(pool ?? []).length} untouched {(pool ?? []).length === 1 ? "lead" : "leads"}
        </span>
        <span className="text-brand">Open pool →</span>
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">To hand a lead to another pod member, open it and use Reassign.</p>
    </>
  )
}
