import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays, istDate } from "@/lib/leads"
import {
  PROGRAM_SETTINGS_COLUMNS,
  inRange,
  istStartOfWeek,
  monthFor,
  nextSlab,
  normalizeSettings,
  periodRange,
  type Period,
  type ProgramSettings,
} from "@/lib/program"

export type PersonRow = {
  id: string
  name: string
  podId: string | null
  podName: string | null
  podColour: string | null
  revenue: number
  deals: number
  leads: number
  won: number
  conversion: number | null
  gap: { amount: number; slab: number } | null
  rank: number
}

export type PodRow = {
  id: string
  name: string
  colour: string
  members: number
  revenue: number
  perMember: number
  deals: number
  rank: number
}

export type Highlights = {
  topSeller: { name: string; revenue: number } | null
  climber: { name: string; from: number; to: number } | null
  mostLeads: { name: string; count: number } | null
}

type Pay = { owner_id: string; amount: number; paid_on: string; lead_id: string }
type LeadStat = { owner_id: string; created_on: string; won: boolean }

/** Competition ranking: equal revenue shares a rank (1, 2, 2, 4). */
function rankBy<T extends { revenue: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue)
  let rank = 0
  return sorted.map((r, i) => {
    if (i === 0 || sorted[i - 1].revenue !== r.revenue) rank = i + 1
    return { ...r, rank }
  })
}

export async function loadLeaderboardData(supabase: SupabaseClient) {
  const [{ data: payments }, { data: leads }, { data: people }, { data: pods }, { data: settings }] = await Promise.all([
    supabase.rpc("leaderboard_payments"),
    supabase.rpc("leaderboard_leads"),
    supabase.from("profiles").select("id, full_name, pod_id, role, active").eq("active", true).eq("role", "intern"),
    supabase.from("pods").select("id, name, colour").order("name"),
    supabase.from("settings").select(PROGRAM_SETTINGS_COLUMNS).eq("id", 1).single(),
  ])
  return {
    payments: ((payments ?? []) as Pay[]).map((p) => ({ ...p, amount: Number(p.amount) })),
    leads: (leads ?? []) as LeadStat[],
    people: (people ?? []) as { id: string; full_name: string; pod_id: string | null }[],
    pods: (pods ?? []) as { id: string; name: string; colour: string }[],
    settings: normalizeSettings(settings as Record<string, unknown>),
  }
}

export type LeaderboardData = Awaited<ReturnType<typeof loadLeaderboardData>>

export function buildLeaderboard(data: LeaderboardData, period: Period, today = istDate()) {
  const { payments, leads, people, pods, settings } = data
  const range = periodRange(settings, period, today)
  const podById = new Map(pods.map((p) => [p.id, p]))
  const showGap = period !== "all"

  const individuals = rankBy(
    people.map((person) => {
      const mine = payments.filter((p) => p.owner_id === person.id && inRange(p.paid_on, range))
      const revenue = mine.reduce((sum, p) => sum + p.amount, 0)
      const myLeads = leads.filter((l) => l.owner_id === person.id && inRange(l.created_on, range))
      const won = myLeads.filter((l) => l.won).length
      const slab = showGap ? nextSlab(revenue, settings) : null
      const pod = person.pod_id ? podById.get(person.pod_id) : undefined
      return {
        id: person.id,
        name: person.full_name,
        podId: person.pod_id,
        podName: pod?.name ?? null,
        podColour: pod?.colour ?? null,
        revenue,
        deals: new Set(mine.map((p) => p.lead_id)).size,
        leads: myLeads.length,
        won,
        conversion: myLeads.length ? Math.round((won / myLeads.length) * 100) : null,
        gap: slab ? { amount: slab - revenue, slab } : null,
      }
    })
  ).sort((a, b) => a.rank - b.rank || b.deals - a.deals || a.name.localeCompare(b.name)) as PersonRow[]

  const podRows = rankBy(
    pods.map((pod) => {
      const members = individuals.filter((i) => i.podId === pod.id)
      const revenue = members.reduce((s, m) => s + m.revenue, 0)
      return {
        id: pod.id,
        name: pod.name,
        colour: pod.colour,
        members: members.length,
        revenue,
        perMember: members.length ? Math.round(revenue / members.length) : 0,
        deals: members.reduce((s, m) => s + m.deals, 0),
      }
    })
  ).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)) as PodRow[]

  return { individuals, pods: podRows, range }
}

/** Weekly highlights for the current Monday–Sunday week (spec 5.8.4). */
export function weeklyHighlights(data: LeaderboardData, today = istDate()): Highlights {
  const { payments, leads, people, settings } = data
  const weekStart = istStartOfWeek(today)
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? ""
  const interns = new Set(people.map((p) => p.id))

  const weekRevenue = new Map<string, number>()
  for (const p of payments) {
    if (interns.has(p.owner_id) && p.paid_on >= weekStart && p.paid_on <= today) {
      weekRevenue.set(p.owner_id, (weekRevenue.get(p.owner_id) ?? 0) + p.amount)
    }
  }
  const top = [...weekRevenue.entries()].sort((a, b) => b[1] - a[1])[0]

  const weekLeads = new Map<string, number>()
  for (const l of leads) {
    if (interns.has(l.owner_id) && l.created_on >= weekStart && l.created_on <= today) {
      weekLeads.set(l.owner_id, (weekLeads.get(l.owner_id) ?? 0) + 1)
    }
  }
  const most = [...weekLeads.entries()].sort((a, b) => b[1] - a[1])[0]

  // Biggest climber: this month's rank now vs. at the end of last week.
  const month = monthFor(settings, today)
  const range = periodRange(settings, "month", today)
  const rankAsOf = (until: string) =>
    new Map(
      rankBy(
        people.map((p) => ({
          id: p.id,
          revenue: payments
            .filter((x) => x.owner_id === p.id && inRange(x.paid_on, range) && x.paid_on <= until)
            .reduce((s, x) => s + x.amount, 0),
        }))
      ).map((r) => [r.id, r.rank])
    )
  let climber: Highlights["climber"] = null
  if (weekStart > month.start) {
    const before = rankAsOf(addDays(weekStart, -1))
    const now = rankAsOf(today)
    let best = 0
    for (const p of people) {
      const from = before.get(p.id)!
      const to = now.get(p.id)!
      if (from - to > best) {
        best = from - to
        climber = { name: p.full_name, from, to }
      }
    }
  }

  return {
    topSeller: top && top[1] > 0 ? { name: name(top[0]), revenue: top[1] } : null,
    climber,
    mostLeads: most && most[1] > 0 ? { name: name(most[0]), count: most[1] } : null,
  }
}

export type { ProgramSettings }
